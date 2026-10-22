import type { DatabaseSync } from 'node:sqlite';
import { EIXOS } from './estrutura.ts';
import { HttpErro } from './http.ts';
import type { AcaoCatalogo } from './seed.ts';

export const EIXOS_CATALOGO = [...EIXOS, 'Geral'] as const;
export const LIMITE_ACOES = 20;
export type AcaoRegistrada = AcaoCatalogo & { id: string; ativa: boolean };

type Linha = { id: string; empresa_id: string | null; eixo: string; acao: string; recurso: string; custo: string; ativa: number };
const chave = (a: { eixo: string; acao: string }) => `${a.eixo.trim().toLocaleLowerCase('pt-BR')}|${a.acao.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')}`;
const ORDEM = 'ORDER BY criada_em, rowid';

/** Catálogo enviado ao motor: global + loja, ativos, sem repetir eixo + ação (a global prevalece). */
export function listarCatalogoAtivo(db: DatabaseSync, empresaId: string): AcaoCatalogo[] {
  const linhas = db.prepare(`SELECT eixo, acao, recurso, custo FROM catalogo_acoes
    WHERE ativa = 1 AND (empresa_id IS NULL OR empresa_id = ?)
    ORDER BY empresa_id IS NOT NULL, criada_em, rowid`).all(empresaId) as AcaoCatalogo[];
  const vistas = new Set<string>();
  return linhas.filter(l => !vistas.has(chave(l)) && vistas.add(chave(l))).map(l => ({ eixo: l.eixo, acao: l.acao, recurso: l.recurso, custo: l.custo }));
}

export function listarAcoes(db: DatabaseSync, escopo: string | null): AcaoRegistrada[] {
  const linhas = (escopo === null
    ? db.prepare(`SELECT id, empresa_id, eixo, acao, recurso, custo, ativa FROM catalogo_acoes WHERE empresa_id IS NULL ${ORDEM}`).all()
    : db.prepare(`SELECT id, empresa_id, eixo, acao, recurso, custo, ativa FROM catalogo_acoes WHERE empresa_id = ? ${ORDEM}`).all(escopo)) as Linha[];
  return linhas.map(l => ({ id: l.id, eixo: l.eixo, acao: l.acao, recurso: l.recurso, custo: l.custo, ativa: Number(l.ativa) === 1 }));
}

function texto(v: unknown, campo: string, min: number, max: number): string {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) throw new HttpErro(400, `Informe ${campo} (${min} a ${max} caracteres).`);
  return v.trim();
}

function conferirLimite(db: DatabaseSync, escopo: string | null): void {
  if (listarAcoes(db, escopo).filter(a => a.ativa).length >= LIMITE_ACOES) {
    throw new HttpErro(400, `Limite de ${LIMITE_ACOES} ações ativas atingido. Desative uma ação antes de incluir outra.`);
  }
}

export function criarAcao(db: DatabaseSync, escopo: string | null, dados: Record<string, unknown>): string {
  if (typeof dados.eixo !== 'string' || !(EIXOS_CATALOGO as readonly string[]).includes(dados.eixo)) throw new HttpErro(400, 'Escolha um eixo válido.');
  const nova = { eixo: dados.eixo, acao: texto(dados.acao, 'a ação', 5, 300), recurso: texto(dados.recurso, 'o recurso', 2, 120), custo: texto(dados.custo, 'o custo', 1, 40) };
  const existentes = [...listarAcoes(db, null), ...(escopo === null ? [] : listarAcoes(db, escopo))].filter(a => a.ativa);
  if (existentes.some(a => chave(a) === chave(nova))) throw new HttpErro(409, 'Esta ação já existe no catálogo.');
  conferirLimite(db, escopo);
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO catalogo_acoes (id, empresa_id, eixo, acao, recurso, custo, ativa, criada_em) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
    .run(id, escopo, nova.eixo, nova.acao, nova.recurso, nova.custo, new Date().toISOString());
  return id;
}

export function definirAcaoAtiva(db: DatabaseSync, escopo: string | null, id: string, ativa: boolean): void {
  const acao = listarAcoes(db, escopo).find(a => a.id === id);
  if (!acao) throw new HttpErro(404, 'Ação não encontrada.');
  if (ativa && !acao.ativa) conferirLimite(db, escopo);
  db.prepare('UPDATE catalogo_acoes SET ativa = ? WHERE id = ?').run(ativa ? 1 : 0, id);
}
