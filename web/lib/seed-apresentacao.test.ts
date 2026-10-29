import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste } from './apoio-testes.ts';
import { semearBaseApresentacao } from './seed-apresentacao.ts';

const contar = (db: ReturnType<typeof bancoDeTeste>, tabela: string): number =>
  Number((db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get() as { n: number }).n);

test('carrega a base de apresentação de forma idempotente', () => {
  const db = bancoDeTeste();
  semearBaseApresentacao(db);

  assert.equal(contar(db, 'empresas'), 5);
  assert.equal(contar(db, 'funcoes'), 8);
  assert.equal(contar(db, 'ocupantes'), 13);
  assert.equal(contar(db, 'avaliacoes_uso'), 8);
  assert.ok(contar(db, 'execucoes') >= 13);

  const antes = contar(db, 'execucoes');
  semearBaseApresentacao(db);
  assert.equal(contar(db, 'empresas'), 5);
  assert.equal(contar(db, 'funcoes'), 8);
  assert.equal(contar(db, 'ocupantes'), 13);
  assert.equal(contar(db, 'execucoes'), antes);
});
