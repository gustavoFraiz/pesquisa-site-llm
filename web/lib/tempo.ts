import type { DatabaseSync } from 'node:sqlite';
import { HttpErro } from './http.ts';

export const INTERVALO_S = 30;
const MIN_INTERVALO_MS = 25_000;
const LIMPEZA_MS = 60 * 60 * 1000;

export type AlvoTempo = { tipo: 'funcao' | 'ocupante'; id: string };

/** Soma tempo ativo de preenchimento (indicador de RNF01). `ultimos` guarda a última batida aceita por alvo. */
export function registrarTempo(db: DatabaseSync, alvo: AlvoTempo, empresaId: string, ultimos: Map<string, number>, agora = Date.now()): boolean {
  // A empresa faz parte da chave: um pedido de outra loja nunca cai no atalho e sempre passa pela checagem do banco.
  const chave = `${empresaId}:${alvo.tipo}:${alvo.id}`;
  const anterior = ultimos.get(chave);
  if (anterior !== undefined && agora - anterior < MIN_INTERVALO_MS) return false;
  const sql = alvo.tipo === 'funcao'
    ? 'UPDATE funcoes SET tempo_ativo_s = tempo_ativo_s + ? WHERE id = ? AND empresa_id = ? AND arquivada = 0'
    : 'UPDATE ocupantes SET tempo_ativo_s = tempo_ativo_s + ? WHERE id = ? AND arquivado = 0 AND funcao_id IN (SELECT id FROM funcoes WHERE empresa_id = ? AND arquivada = 0)';
  const r = db.prepare(sql).run(INTERVALO_S, alvo.id, empresaId);
  if (Number(r.changes) === 0) throw new HttpErro(404, 'Registro não encontrado.');
  if (ultimos.size > 1000) for (const [k, v] of ultimos) if (agora - v > LIMPEZA_MS) ultimos.delete(k);
  ultimos.set(chave, agora);
  return true;
}
