import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste } from './apoio-testes.ts';
import { inicioDaBase, semearBaseApresentacao } from './seed-apresentacao.ts';

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

test('usa a data informada e mantém os intervalos entre os registros', () => {
  const db = bancoDeTeste();
  semearBaseApresentacao(db, '2027-03-01');
  const { min, max } = db.prepare('SELECT MIN(criada_em) AS min, MAX(ultimo_acesso) AS max FROM empresas e JOIN usuarios u ON u.empresa_id = e.id').get() as { min: string; max: string };
  assert.equal(min, '2027-03-01T13:20:00.000Z');
  assert.equal(max, '2027-03-22T12:06:00.000Z');
});

test('sem data definida, a base termina no dia atual', () => {
  const agora = Date.parse('2027-05-30T10:00:00.000Z');
  assert.equal(new Date(inicioDaBase('', agora)).toISOString(), '2027-05-09T00:00:00.000Z');
});

test('recusa data em formato inválido', () => {
  assert.throws(() => inicioDaBase('01/03/2027'), /AAAA-MM-DD/);
  assert.throws(() => semearBaseApresentacao(bancoDeTeste(), '2027-13-40'), /AAAA-MM-DD/);
});
