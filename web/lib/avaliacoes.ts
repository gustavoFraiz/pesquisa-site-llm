import type { DatabaseSync } from 'node:sqlite';
import { obterFuncao } from './funcoes.ts';
import { HttpErro } from './http.ts';

export function registrarAvaliacao(db: DatabaseSync, empresaId: string, funcaoId: string, dados: { nota: unknown; comentario: unknown }): void {
  obterFuncao(db, empresaId, funcaoId);
  if (typeof dados.nota !== 'number' || !Number.isInteger(dados.nota) || dados.nota < 1 || dados.nota > 5) throw new HttpErro(400, 'Escolha uma nota de 1 a 5.');
  const comentario = typeof dados.comentario === 'string' ? dados.comentario.trim().slice(0, 500) : '';
  db.prepare(`INSERT INTO avaliacoes_uso (funcao_id, nota, comentario, criada_em) VALUES (?, ?, ?, ?)
    ON CONFLICT(funcao_id) DO UPDATE SET nota = excluded.nota, comentario = excluded.comentario, criada_em = excluded.criada_em`)
    .run(funcaoId, dados.nota, comentario, new Date().toISOString());
}

export const avaliacaoPendente = (db: DatabaseSync, funcaoId: string): boolean =>
  !db.prepare('SELECT 1 FROM avaliacoes_uso WHERE funcao_id = ?').get(funcaoId);

export const notasDaFuncao = (db: DatabaseSync, funcaoId: string): number[] =>
  (db.prepare('SELECT nota FROM avaliacoes_uso WHERE funcao_id = ?').all(funcaoId) as { nota: number }[]).map(l => Number(l.nota));
