import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, exemploAtendente, inserirEmpresa } from './apoio-testes.ts';
import { criarFuncao, obterFuncao } from './funcoes.ts';
import { listarModelos } from './modelos.ts';
import { criarFuncaoAPartirDe, estruturaDeTarefasSugeridas } from './nova-funcao.ts';

test('cria função a partir de modelo, de cópia da própria loja ou em branco', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const modelo = listarModelos(db, false).find(m => m.nome === 'Operador(a) de caixa');
  assert.ok(modelo);
  const doModelo = obterFuncao(db, a, criarFuncaoAPartirDe(db, a, { modeloId: modelo.id }));
  assert.deepEqual([doModelo.nome, doModelo.origem, doModelo.estrutura.tarefas[0].origem], ['Operador(a) de caixa', `modelo:${modelo.id}`, 'modelo']);
  const { estrutura } = exemploAtendente();
  const original = criarFuncao(db, a, { nome: 'Atendente', estrutura, origem: 'planilha' });
  const copia = obterFuncao(db, a, criarFuncaoAPartirDe(db, a, { copiarDe: original }));
  assert.deepEqual([copia.nome, copia.origem, copia.estrutura.salvaguardas[2].resposta], ['Atendente (cópia)', `copia:${original}`, 'Não']);
  assert.throws(() => criarFuncaoAPartirDe(db, b, { copiarDe: original }), { status: 404 });
  assert.equal(obterFuncao(db, b, criarFuncaoAPartirDe(db, b, { nome: 'Nova' })).origem, 'branco');
  assert.throws(() => criarFuncaoAPartirDe(db, b, { nome: ' ' }), { status: 400 });
});

const sugerida = { tarefa: 'Montar orçamento para o cliente', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Assistente', efeito: 'P' };

test('tarefas revisadas da IA viram estrutura com origem ia', () => {
  const e = estruturaDeTarefasSugeridas([sugerida, { ...sugerida, tarefa: 'Negociar prazo', ferramenta: '', efeito: 'I' }]);
  assert.deepEqual(e.tarefas.map(t => [t.tarefa, t.efeito_ia, t.origem, t.editada]), [['Montar orçamento para o cliente', 'P', 'ia', false], ['Negociar prazo', 'I', 'ia', false]]);
  assert.equal(e.competencias.length, 0);
  assert.throws(() => estruturaDeTarefasSugeridas([]), { status: 400 });
  assert.throws(() => estruturaDeTarefasSugeridas(Array.from({ length: 13 }, () => sugerida)), { status: 400 });
  assert.throws(() => estruturaDeTarefasSugeridas([{ ...sugerida, efeito: 'X' }]), { status: 400 });
});

test('cria a função a partir das tarefas revisadas', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  const f = obterFuncao(db, a, criarFuncaoAPartirDe(db, a, { nome: 'Atendente', tarefasSugeridas: [sugerida] }));
  assert.deepEqual([f.nome, f.origem, f.estrutura.tarefas[0].origem], ['Atendente', 'texto', 'ia']);
});
