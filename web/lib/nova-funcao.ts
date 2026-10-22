import type { DatabaseSync } from 'node:sqlite';
import { copiarEstrutura, CRITICIDADES, EFEITOS, estruturaVazia, FREQUENCIAS, LIMITES, novoId, type Estrutura } from './estrutura.ts';
import { HttpErro } from './http.ts';
import { criarFuncao, obterFuncao } from './funcoes.ts';
import { obterModelo } from './modelos.ts';

/** Nova função em branco, a partir de um modelo ativo ou como cópia de uma função da própria loja. */
export function criarFuncaoAPartirDe(db: DatabaseSync, empresaId: string, dados: { nome?: unknown; modeloId?: unknown; copiarDe?: unknown; tarefasSugeridas?: unknown }): string {
  const nomeInformado = typeof dados.nome === 'string' && dados.nome.trim() ? dados.nome : undefined;
  if (typeof dados.modeloId === 'string') {
    const modelo = obterModelo(db, dados.modeloId, true);
    return criarFuncao(db, empresaId, { nome: nomeInformado ?? modelo.nome, estrutura: copiarEstrutura(modelo.estrutura, 'modelo', false), origem: `modelo:${modelo.id}` });
  }
  if (typeof dados.copiarDe === 'string') {
    const original = obterFuncao(db, empresaId, dados.copiarDe);
    return criarFuncao(db, empresaId, { nome: nomeInformado ?? `${original.nome} (cópia)`.slice(0, 120), estrutura: copiarEstrutura(original.estrutura, 'copia', true), origem: `copia:${original.id}` });
  }
  if (dados.tarefasSugeridas !== undefined) {
    return criarFuncao(db, empresaId, { nome: dados.nome, estrutura: estruturaDeTarefasSugeridas(dados.tarefasSugeridas), origem: 'texto' });
  }
  return criarFuncao(db, empresaId, { nome: dados.nome, estrutura: estruturaVazia(), origem: 'branco' });
}

export function estruturaDeTarefasSugeridas(lista: unknown): Estrutura {
  if (!Array.isArray(lista) || lista.length < 1 || lista.length > LIMITES.tarefas) throw new HttpErro(400, `Marque de 1 a ${LIMITES.tarefas} tarefas.`);
  const opcao = <T extends string>(v: unknown, opcoes: readonly T[]): T => {
    if (typeof v !== 'string' || !(opcoes as readonly string[]).includes(v)) throw new HttpErro(400, 'Tarefa sugerida inválida.');
    return v as T;
  };
  const tarefas = lista.map(item => {
    const t = (item ?? {}) as Record<string, unknown>;
    if (typeof t.tarefa !== 'string' || !t.tarefa.trim() || t.tarefa.length > LIMITES.texto) throw new HttpErro(400, 'Tarefa sugerida inválida.');
    if (typeof t.ferramenta !== 'string' || t.ferramenta.length > LIMITES.ferramenta) throw new HttpErro(400, 'Tarefa sugerida inválida.');
    return { id: novoId(), tarefa: t.tarefa.trim(), frequencia: opcao(t.frequencia, FREQUENCIAS), criticidade: opcao(t.criticidade, CRITICIDADES),
      ferramenta: t.ferramenta.trim(), efeito_ia: opcao(t.efeito, EFEITOS), origem: 'ia' as const, editada: false };
  });
  return { ...estruturaVazia(), tarefas };
}
