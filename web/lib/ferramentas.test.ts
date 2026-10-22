import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { adicionarFerramenta, CATEGORIAS_FERRAMENTA, LIMITE_FERRAMENTAS, listarFerramentas, removerFerramenta } from './ferramentas.ts';

test('adiciona, lista em ordem e não repete ferramenta', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  const primeira = adicionarFerramenta(db, a, ' Sistema de vendas com IA ');
  adicionarFerramenta(db, a, 'Assistente de conversa com IA');
  assert.deepEqual(adicionarFerramenta(db, a, 'sistema DE vendas com ia'), primeira);
  assert.deepEqual(listarFerramentas(db, a).map(f => f.nome), ['Assistente de conversa com IA', 'Sistema de vendas com IA']);
  assert.equal(Object.getPrototypeOf(listarFerramentas(db, a)[0]), Object.prototype);
});

test('valida nome, limite e escopo da empresa', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  assert.throws(() => adicionarFerramenta(db, a, 'x'), { status: 400 });
  assert.throws(() => adicionarFerramenta(db, a, 'y'.repeat(81)), { status: 400 });
  const f = adicionarFerramenta(db, a, 'Ferramenta da loja A');
  assert.deepEqual(listarFerramentas(db, b), []);
  assert.throws(() => removerFerramenta(db, b, f.id), { status: 404 });
  removerFerramenta(db, a, f.id);
  assert.deepEqual(listarFerramentas(db, a), []);
  for (let i = 0; i < LIMITE_FERRAMENTAS; i++) adicionarFerramenta(db, a, `Ferramenta ${i}`);
  assert.throws(() => adicionarFerramenta(db, a, 'Uma a mais'), { status: 400 });
});

test('categorias sugeridas são genéricas, sem marca', () => {
  assert.ok(CATEGORIAS_FERRAMENTA.length >= 4);
  assert.ok(CATEGORIAS_FERRAMENTA.every(c => !/chatgpt|gemini|copilot|whatsapp/i.test(c)));
});
