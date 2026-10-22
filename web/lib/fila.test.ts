import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Fila } from './fila.ts';

function adiado() {
  let resolver!: () => void;
  let rejeitar!: (e: Error) => void;
  const promessa = new Promise<void>((ok, falha) => { resolver = ok; rejeitar = falha; });
  return { promessa, resolver, rejeitar };
}
const esperarCiclo = () => new Promise(r => setImmediate(r));
const nunca = () => new Promise<void>(() => undefined);

test('executa um item por vez, na ordem de chegada, e informa a posição', async () => {
  const fila = new Fila(6);
  const ordem: string[] = [];
  const a = adiado();
  const b = adiado();
  assert.equal(fila.enfileirar({ id: 'a', empresaId: 'e1', executar: async () => { ordem.push('a'); await a.promessa; } }), 0);
  assert.equal(fila.enfileirar({ id: 'b', empresaId: 'e2', executar: async () => { ordem.push('b'); await b.promessa; } }), 1);
  assert.deepEqual(ordem, ['a']);
  a.resolver();
  await esperarCiclo();
  assert.deepEqual(ordem, ['a', 'b']);
  assert.equal(fila.posicao('b'), 0);
  assert.equal(fila.posicao('a'), null);
  b.resolver();
});

test('aceita só um pedido por loja e no máximo N aguardando', () => {
  const fila = new Fila(2);
  fila.enfileirar({ id: 'a', empresaId: 'e1', executar: nunca });
  assert.throws(() => fila.enfileirar({ id: 'a2', empresaId: 'e1', executar: nunca }), { status: 429, message: /desta loja/ });
  fila.enfileirar({ id: 'b', empresaId: 'e2', executar: nunca });
  fila.enfileirar({ id: 'c', empresaId: 'e3', executar: nunca });
  assert.throws(() => fila.enfileirar({ id: 'd', empresaId: 'e4', executar: nunca }), { status: 429, message: /Muitas solicitações/ });
  assert.equal(fila.posicao('c'), 2);
});

test('falha de um item não trava a fila', async () => {
  const fila = new Fila(6);
  const a = adiado();
  let rodouB = false;
  fila.enfileirar({ id: 'a', empresaId: 'e1', executar: () => a.promessa });
  fila.enfileirar({ id: 'b', empresaId: 'e2', executar: async () => { rodouB = true; } });
  a.rejeitar(new Error('python caiu'));
  await esperarCiclo();
  assert.equal(rodouB, true);
});
