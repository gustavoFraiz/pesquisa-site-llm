import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { estruturaVazia } from './estrutura.ts';
import { criarFuncao } from './funcoes.ts';
import { criarOcupante } from './ocupantes.ts';
import { registrarTempo } from './tempo.ts';

function cenario() {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const funcaoId = criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  const ocupanteId = criarOcupante(db, a, funcaoId, { apelido: 'Caixa 1' });
  return { db, a, b, funcaoId, ocupanteId };
}
const segundos = (db: ReturnType<typeof bancoDeTeste>, tabela: string, id: string) =>
  Number((db.prepare(`SELECT tempo_ativo_s AS s FROM ${tabela} WHERE id = ?`).get(id) as { s: number }).s);

test('soma 30 s por batida e ignora batidas muito próximas', () => {
  const { db, a, funcaoId } = cenario();
  const mapa = new Map<string, number>();
  const t0 = 1_000_000;
  assert.equal(registrarTempo(db, { tipo: 'funcao', id: funcaoId }, a, mapa, t0), true);
  assert.equal(registrarTempo(db, { tipo: 'funcao', id: funcaoId }, a, mapa, t0 + 10_000), false);
  assert.equal(registrarTempo(db, { tipo: 'funcao', id: funcaoId }, a, mapa, t0 + 30_000), true);
  assert.equal(segundos(db, 'funcoes', funcaoId), 60);
});

test('registra o tempo do ocupante separado do tempo da função', () => {
  const { db, a, funcaoId, ocupanteId } = cenario();
  registrarTempo(db, { tipo: 'ocupante', id: ocupanteId }, a, new Map());
  assert.equal(segundos(db, 'ocupantes', ocupanteId), 30);
  assert.equal(segundos(db, 'funcoes', funcaoId), 0);
});

test('outra empresa recebe 404 mesmo logo depois de uma batida legítima', () => {
  const { db, a, b, ocupanteId } = cenario();
  const mapa = new Map<string, number>();
  registrarTempo(db, { tipo: 'ocupante', id: ocupanteId }, a, mapa, 1_000_000);
  assert.throws(() => registrarTempo(db, { tipo: 'ocupante', id: ocupanteId }, b, mapa, 1_005_000), { status: 404 });
});

test('não registra tempo em função ou ocupante de outra empresa', () => {
  const { db, b, funcaoId, ocupanteId } = cenario();
  assert.throws(() => registrarTempo(db, { tipo: 'funcao', id: funcaoId }, b, new Map()), { status: 404 });
  assert.throws(() => registrarTempo(db, { tipo: 'ocupante', id: ocupanteId }, b, new Map()), { status: 404 });
});
