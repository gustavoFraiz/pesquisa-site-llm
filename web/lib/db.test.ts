import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { prepararBanco, transacao } from './db.ts';
import { CATALOGO_BASE, SALVAGUARDAS } from './seed.ts';

const contar = (db: ReturnType<typeof bancoDeTeste>, sql: string) => Number((db.prepare(sql).get() as { n: number }).n);

test('prepara o esquema de forma idempotente e semeia o catálogo uma única vez', () => {
  const db = bancoDeTeste();
  prepararBanco(db);
  assert.equal(contar(db, 'SELECT COUNT(*) AS n FROM catalogo_acoes WHERE empresa_id IS NULL'), CATALOGO_BASE.length);
  assert.equal(CATALOGO_BASE.length, 8);
  assert.deepEqual(SALVAGUARDAS.map(s => s.numero), [1, 2, 3, 4, 5, 6]);
  assert.equal(SALVAGUARDAS[5].ancora, 'Diretriz de uso crítico');
});

test('aceita um único gestor por empresa e exige empresa só para gestor', () => {
  const db = bancoDeTeste();
  const empresaId = inserirEmpresa(db);
  const inserir = (email: string, papel: string, empresa: string | null) =>
    db.prepare("INSERT INTO usuarios (id, email, senha_hash, papel, empresa_id, criado_em) VALUES (?, ?, 'x', ?, ?, '2026-10-15')").run(crypto.randomUUID(), email, papel, empresa);
  inserir('a@loja.com', 'gestor', empresaId);
  assert.throws(() => inserir('b@loja.com', 'gestor', empresaId), /UNIQUE/);
  assert.throws(() => inserir('c@loja.com', 'gestor', null), /CHECK/);
  assert.throws(() => inserir('d@loja.com', 'admin', empresaId), /CHECK/);
  inserir('admin@pesquisa.com', 'admin', null);
});

test('transação desfaz tudo quando há erro', () => {
  const db = bancoDeTeste();
  assert.throws(() => transacao(db, () => {
    inserirEmpresa(db, 'Primeira');
    throw new Error('falhou');
  }), /falhou/);
  assert.equal(contar(db, 'SELECT COUNT(*) AS n FROM empresas'), 0);
  assert.equal(transacao(db, () => inserirEmpresa(db, 'Segunda')).length, 36);
});
