import type { DatabaseSync } from 'node:sqlite';
import { HttpErro } from './http.ts';

/** Sugestões genéricas para a pergunta de boas-vindas; o gestor escreve o nome real (RNF05). */
export const CATEGORIAS_FERRAMENTA = [
  'Assistente de conversa com IA',
  'Recurso de IA do sistema de vendas',
  'Recurso de IA do sistema de estoque',
  'Atendimento automático por mensagem',
  'Gerador de textos e imagens para divulgação',
];
export const LIMITE_FERRAMENTAS = 30;
export type Ferramenta = { id: string; nome: string };

const chave = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

export function listarFerramentas(db: DatabaseSync, empresaId: string): Ferramenta[] {
  const linhas = db.prepare('SELECT id, nome FROM ferramentas_ia WHERE empresa_id = ?').all(empresaId) as Ferramenta[];
  return linhas.map(l => ({ id: l.id, nome: l.nome })).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
}

export function adicionarFerramenta(db: DatabaseSync, empresaId: string, nome: unknown): Ferramenta {
  const valor = typeof nome === 'string' ? nome.trim().replace(/\s+/g, ' ') : '';
  if (valor.length < 2 || valor.length > 80) throw new HttpErro(400, 'Informe o nome da ferramenta (2 a 80 caracteres).');
  const atuais = listarFerramentas(db, empresaId);
  const existente = atuais.find(f => chave(f.nome) === chave(valor));
  if (existente) return existente;
  if (atuais.length >= LIMITE_FERRAMENTAS) throw new HttpErro(400, `Limite de ${LIMITE_FERRAMENTAS} ferramentas atingido.`);
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO ferramentas_ia (id, empresa_id, nome, criada_em) VALUES (?, ?, ?, ?)').run(id, empresaId, valor, new Date().toISOString());
  return { id, nome: valor };
}

export function removerFerramenta(db: DatabaseSync, empresaId: string, id: string): void {
  const r = db.prepare('DELETE FROM ferramentas_ia WHERE id = ? AND empresa_id = ?').run(id, empresaId);
  if (Number(r.changes) === 0) throw new HttpErro(404, 'Ferramenta não encontrada.');
}
