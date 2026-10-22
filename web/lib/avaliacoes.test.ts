import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { avaliacaoPendente, notasDaFuncao, registrarAvaliacao } from './avaliacoes.ts';
import { estruturaVazia } from './estrutura.ts';
import { criarFuncao } from './funcoes.ts';

test('registra uma avaliação por função, valida nota e respeita a empresa', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const f = criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  assert.equal(avaliacaoPendente(db, f), true);
  assert.throws(() => registrarAvaliacao(db, a, f, { nota: 7, comentario: '' }), { status: 400 });
  assert.throws(() => registrarAvaliacao(db, a, f, { nota: 3.5, comentario: '' }), { status: 400 });
  assert.throws(() => registrarAvaliacao(db, b, f, { nota: 4, comentario: '' }), { status: 404 });
  registrarAvaliacao(db, a, f, { nota: 3, comentario: 'Achei longo' });
  registrarAvaliacao(db, a, f, { nota: 5, comentario: '' });
  assert.equal(avaliacaoPendente(db, f), false);
  assert.deepEqual(notasDaFuncao(db, f), [5]);
});
