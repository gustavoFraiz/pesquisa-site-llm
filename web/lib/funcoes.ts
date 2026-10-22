import type { DatabaseSync } from 'node:sqlite';
import { pendenciasEstrutura, validarEstrutura, type Estrutura } from './estrutura.ts';
import { HttpErro } from './http.ts';

export type Funcao = { id: string; empresaId: string; nome: string; estrutura: Estrutura; origem: string; criadaEm: string; atualizadaEm: string; arquivada: boolean };
export type ResumoFuncao = {
  id: string; nome: string; atualizadaEm: string; tarefas: number; competencias: number;
  salvaguardasRespondidas: number; pendencias: number; ocupantes: number; trilhas: number;
};
type Linha = { id: string; empresa_id: string; nome: string; estrutura: string; origem: string; criada_em: string; atualizada_em: string; arquivada: number };

export function validarNomeFuncao(v: unknown): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > 120) throw new HttpErro(400, 'Informe o nome da função (até 120 caracteres).');
  return v.trim();
}

export function estruturaValida(v: unknown): Estrutura {
  try {
    return validarEstrutura(v);
  } catch (erro) {
    throw new HttpErro(400, (erro as Error).message);
  }
}

export function criarFuncao(db: DatabaseSync, empresaId: string, dados: { nome: unknown; estrutura: unknown; origem: string }, agora = Date.now()): string {
  const id = crypto.randomUUID();
  const momento = new Date(agora).toISOString();
  db.prepare('INSERT INTO funcoes (id, empresa_id, nome, estrutura, origem, criada_em, atualizada_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, empresaId, validarNomeFuncao(dados.nome), JSON.stringify(estruturaValida(dados.estrutura)), dados.origem, momento, momento);
  return id;
}

export function obterFuncao(db: DatabaseSync, empresaId: string | null, id: string, incluirArquivada = false): Funcao {
  const l = db.prepare(`SELECT id, empresa_id, nome, estrutura, origem, criada_em, atualizada_em, arquivada FROM funcoes WHERE id = ?${incluirArquivada ? '' : ' AND arquivada = 0'}`).get(id) as Linha | undefined;
  if (!l || (empresaId !== null && l.empresa_id !== empresaId)) throw new HttpErro(404, 'Função não encontrada.');
  return { id: l.id, empresaId: l.empresa_id, nome: l.nome, estrutura: JSON.parse(l.estrutura) as Estrutura, origem: l.origem, criadaEm: l.criada_em, atualizadaEm: l.atualizada_em, arquivada: Number(l.arquivada) === 1 };
}

export const MENSAGEM_VERSAO = 'Esta página está desatualizada: houve um salvamento depois que você a abriu (por exemplo, ao voltar pelo navegador ou em outra aba). Recarregue a página para continuar.';

/** Confere a versão que o cliente abriu (data do último salvamento) e devolve a próxima, sempre diferente. */
export function proximaVersao(atual: string, versao: unknown, agora: number): string {
  if (versao !== undefined && versao !== atual) throw new HttpErro(409, MENSAGEM_VERSAO);
  return new Date(Math.max(agora, Date.parse(atual) + 1)).toISOString();
}

export function salvarFuncao(db: DatabaseSync, empresaId: string, id: string, dados: { nome: unknown; estrutura: unknown; versao?: unknown }, agora = Date.now()): string {
  const atual = obterFuncao(db, empresaId, id);
  const nome = validarNomeFuncao(dados.nome);
  const estrutura = estruturaValida(dados.estrutura);
  const versao = proximaVersao(atual.atualizadaEm, dados.versao, agora);
  db.prepare('UPDATE funcoes SET nome = ?, estrutura = ?, atualizada_em = ? WHERE id = ?').run(nome, JSON.stringify(estrutura), versao, id);
  return versao;
}

export function arquivarFuncao(db: DatabaseSync, empresaId: string, id: string): void {
  obterFuncao(db, empresaId, id);
  db.prepare('UPDATE funcoes SET arquivada = 1 WHERE id = ?').run(id);
}

export function listarFuncoes(db: DatabaseSync, empresaId: string): ResumoFuncao[] {
  const linhas = db.prepare(`SELECT f.id, f.nome, f.estrutura, f.atualizada_em,
      (SELECT COUNT(*) FROM ocupantes o WHERE o.funcao_id = f.id AND o.arquivado = 0) AS ocupantes,
      (SELECT COUNT(*) FROM execucoes x WHERE x.funcao_id = f.id AND x.tipo = 'trilha') AS trilhas
    FROM funcoes f WHERE f.empresa_id = ? AND f.arquivada = 0 ORDER BY f.atualizada_em DESC`).all(empresaId) as
    { id: string; nome: string; estrutura: string; atualizada_em: string; ocupantes: number; trilhas: number }[];
  return linhas.map(l => {
    const e = JSON.parse(l.estrutura) as Estrutura;
    return {
      id: l.id, nome: l.nome, atualizadaEm: l.atualizada_em, tarefas: e.tarefas.length, competencias: e.competencias.length,
      salvaguardasRespondidas: e.salvaguardas.filter(s => s.resposta !== 'Não sei').length, pendencias: pendenciasEstrutura(e).length,
      ocupantes: Number(l.ocupantes), trilhas: Number(l.trilhas),
    };
  });
}

export function listarFuncoesDeTodas(db: DatabaseSync): { id: string; nome: string; empresa: string }[] {
  const linhas = db.prepare(`SELECT f.id, f.nome, e.nome AS empresa FROM funcoes f JOIN empresas e ON e.id = f.empresa_id
    WHERE f.arquivada = 0 ORDER BY e.nome COLLATE NOCASE, f.nome COLLATE NOCASE`).all() as { id: string; nome: string; empresa: string }[];
  return linhas.map(l => ({ id: l.id, nome: l.nome, empresa: l.empresa }));
}
