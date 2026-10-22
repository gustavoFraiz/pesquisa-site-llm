import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITE_EXECUCAO_MS, normalizarStatus, type StatusExecucao } from './status-execucao.ts';

const base: StatusExecucao = { id: 'x', tipo: 'trilha', status: 'aguardando', criadaEm: '2026-10-15T12:00:00.000Z', runnerId: 'r1' };

test('pedido aguardando ou executando de outro processo vira erro de reinício', () => {
  for (const status of ['aguardando', 'executando'] as const) {
    const r = normalizarStatus({ ...base, status }, 'r2');
    assert.equal(r.alterado, true);
    assert.equal(r.status.status, 'erro');
    assert.match(r.status.error ?? '', /reinício do serviço/);
  }
});

test('execução acima do limite expira; dentro do limite continua', () => {
  const iniciadaEm = '2026-10-15T12:00:00.000Z';
  const inicio = Date.parse(iniciadaEm);
  const executando: StatusExecucao = { ...base, status: 'executando', iniciadaEm };
  assert.equal(normalizarStatus(executando, 'r1', inicio + LIMITE_EXECUCAO_MS - 1).status.status, 'executando');
  const expirada = normalizarStatus(executando, 'r1', inicio + LIMITE_EXECUCAO_MS + 1);
  assert.deepEqual([expirada.status.status, expirada.alterado], ['erro', false]);
});

test('concluída e erro não mudam', () => {
  for (const status of ['concluida', 'erro'] as const) assert.deepEqual(normalizarStatus({ ...base, status }, 'r2'), { status: { ...base, status }, alterado: false });
});

test('extração interrompida por reinício também vira erro visível', () => {
  const r = normalizarStatus({ ...base, tipo: 'extracao', status: 'aguardando' }, 'r2');
  assert.deepEqual([r.status.status, r.alterado], ['erro', true]);
});
