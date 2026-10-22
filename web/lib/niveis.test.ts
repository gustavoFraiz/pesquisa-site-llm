import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESCRICAO_NIVEL, nivelPorRespostas, perguntasDoEixo, perguntasVisiveis, responder } from './niveis.ts';

test('respostas viram nível do Quadro 4', () => {
  assert.equal(nivelPorRespostas([false, null, null]), 'N0');
  assert.equal(nivelPorRespostas([true, false, null]), 'N1');
  assert.equal(nivelPorRespostas([true, true, false]), 'N2');
  assert.equal(nivelPorRespostas([true, true, true]), 'N3');
  assert.equal(nivelPorRespostas([true, null, null]), null);
  assert.equal(nivelPorRespostas([null, null, null]), null);
});

test('mostra a próxima pergunta só depois de um sim', () => {
  assert.equal(perguntasVisiveis([null, null, null]), 1);
  assert.equal(perguntasVisiveis([false, null, null]), 1);
  assert.equal(perguntasVisiveis([true, null, null]), 2);
  assert.equal(perguntasVisiveis([true, true, false]), 3);
  assert.equal(perguntasVisiveis([true, true, true]), 3);
});

test('mudar uma resposta apaga as seguintes', () => {
  assert.deepEqual(responder([true, true, true], 0, false), [false, null, null]);
  assert.deepEqual(responder([true, false, null], 1, true), [true, true, null]);
  assert.deepEqual(responder([null, null, null], 0, true), [true, null, null]);
});

test('perguntas mudam conforme o eixo e cada nível tem descrição', () => {
  assert.match(perguntasDoEixo('Letramento em IA')[0], /ferramenta/);
  assert.match(perguntasDoEixo('Proficiência técnica')[0], /ferramenta/);
  assert.match(perguntasDoEixo('Relacionais e de julgamento')[0], /dia a dia/);
  assert.match(perguntasDoEixo('Adaptabilidade')[2], /gestor/);
  assert.deepEqual(Object.keys(DESCRICAO_NIVEL), ['N0', 'N1', 'N2', 'N3']);
});
