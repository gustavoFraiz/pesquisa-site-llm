import type { DatabaseSync } from 'node:sqlite';
import { transacao } from './db.ts';
import { copiarEstrutura, estruturaVazia, type Estrutura } from './estrutura.ts';
import { estruturaValida, obterFuncao, validarNomeFuncao } from './funcoes.ts';
import { HttpErro } from './http.ts';
import { MODELOS_BASE, estruturaDoModelo } from './seed-modelos.ts';

export type Modelo = { id: string; nome: string; descricao: string; estrutura: Estrutura; ativo: boolean; atualizadoEm: string };
export type ResumoModelo = { id: string; nome: string; descricao: string; tarefas: number; competencias: number; ativo: boolean };
type Linha = { id: string; nome: string; descricao: string; estrutura: string; ativo: number; atualizado_em: string };

function descricaoValida(v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string' || v.trim().length > 300) throw new HttpErro(400, 'A descrição pode ter até 300 caracteres.');
  return v.trim();
}

export function semearModelos(db: DatabaseSync): void {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM modelos_funcao').get() as { n: number };
  if (Number(n) > 0) return;
  const agora = new Date().toISOString();
  const inserir = db.prepare('INSERT INTO modelos_funcao (id, nome, descricao, estrutura, ativo, atualizado_em) VALUES (?, ?, ?, ?, 1, ?)');
  transacao(db, () => {
    for (const m of MODELOS_BASE) inserir.run(crypto.randomUUID(), m.nome, m.descricao, JSON.stringify(estruturaDoModelo(m)), agora);
  });
}

export function listarModelos(db: DatabaseSync, incluirInativos: boolean): ResumoModelo[] {
  semearModelos(db);
  const linhas = db.prepare(`SELECT id, nome, descricao, estrutura, ativo FROM modelos_funcao ${incluirInativos ? '' : 'WHERE ativo = 1'} ORDER BY nome COLLATE NOCASE`).all() as Linha[];
  return linhas.map(l => {
    const e = JSON.parse(l.estrutura) as Estrutura;
    return { id: l.id, nome: l.nome, descricao: l.descricao, tarefas: e.tarefas.length, competencias: e.competencias.length, ativo: Number(l.ativo) === 1 };
  });
}

export function obterModelo(db: DatabaseSync, id: string, apenasAtivo: boolean): Modelo {
  semearModelos(db);
  const l = db.prepare('SELECT id, nome, descricao, estrutura, ativo, atualizado_em FROM modelos_funcao WHERE id = ?').get(id) as Linha | undefined;
  if (!l || (apenasAtivo && Number(l.ativo) !== 1)) throw new HttpErro(404, 'Modelo não encontrado ou desativado.');
  return { id: l.id, nome: l.nome, descricao: l.descricao, estrutura: JSON.parse(l.estrutura) as Estrutura, ativo: Number(l.ativo) === 1, atualizadoEm: l.atualizado_em };
}

export function criarModelo(db: DatabaseSync, dados: { nome: unknown; descricao: unknown; estrutura: unknown }): string {
  semearModelos(db);
  const id = crypto.randomUUID();
  const estrutura = dados.estrutura === undefined ? estruturaVazia() : estruturaValida(dados.estrutura);
  db.prepare('INSERT INTO modelos_funcao (id, nome, descricao, estrutura, ativo, atualizado_em) VALUES (?, ?, ?, ?, 1, ?)')
    .run(id, validarNomeFuncao(dados.nome), descricaoValida(dados.descricao), JSON.stringify(estrutura), new Date().toISOString());
  return id;
}

export function salvarModelo(db: DatabaseSync, id: string, dados: { nome: unknown; descricao: unknown; estrutura: unknown }): void {
  obterModelo(db, id, false);
  const nome = validarNomeFuncao(dados.nome);
  const descricao = descricaoValida(dados.descricao);
  const estrutura = estruturaValida(dados.estrutura);
  db.prepare('UPDATE modelos_funcao SET nome = ?, descricao = ?, estrutura = ?, atualizado_em = ? WHERE id = ?')
    .run(nome, descricao, JSON.stringify(estrutura), new Date().toISOString(), id);
}

export function definirModeloAtivo(db: DatabaseSync, id: string, ativo: boolean): void {
  obterModelo(db, id, false);
  db.prepare('UPDATE modelos_funcao SET ativo = ?, atualizado_em = ? WHERE id = ?').run(ativo ? 1 : 0, new Date().toISOString(), id);
}

export function promoverFuncao(db: DatabaseSync, funcaoId: string): string {
  const funcao = obterFuncao(db, null, funcaoId);
  return criarModelo(db, { nome: funcao.nome, descricao: 'Criado a partir de uma função cadastrada; revise antes de oferecer às lojas.', estrutura: copiarEstrutura(funcao.estrutura, 'modelo', false) });
}
