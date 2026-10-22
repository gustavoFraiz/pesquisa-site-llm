import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exemploAtendente } from './apoio-testes.ts';
import { calcularMetrica, COLUNAS, paraCsv, type DadosMetrica } from './metricas.ts';

function dados(extra: Partial<DadosMetrica> = {}): DadosMetrica {
  const { estrutura } = exemploAtendente();
  estrutura.tarefas[0] = { ...estrutura.tarefas[0], origem: 'modelo', editada: true };
  estrutura.tarefas[1] = { ...estrutura.tarefas[1], origem: 'modelo' };
  return {
    empresa: 'Loja; "Central"', funcao: 'Atendente\nde balcão', origem: 'modelo:abc', criadaEm: '2026-10-20T10:00:00.000Z', arquivada: false,
    estrutura, tempoEstruturaS: 1800, tempoPrimeiroOcupanteS: 900, ocupantesAtivos: 2, trilhasGeradas: 3,
    ultimasTrilhas: [
      { ocupante: 'Atendente 1', priorizadas: 3, recomendacoes: [{ decisao: 'recomendada', prazo: 14, criterio: 'x' }, { decisao: 'sem_acao_adequada', prazo: null, criterio: null }] },
      { ocupante: 'Atendente 2', priorizadas: 1, recomendacoes: [{ decisao: 'recomendada', prazo: 14, criterio: 'y' }] },
    ],
    notas: [4, 5], ...extra,
  };
}

test('calcula os indicadores da função de exemplo', () => {
  const m = calcularMetrica(dados());
  assert.deepEqual(
    [m.situacao, m.origem, m.criadaEm, m.tempoEstruturaMin, m.tempoPrimeiroOcupanteMin, m.tempoTotalMin, m.ate90min],
    ['Ativa', 'modelo', '2026-10-20', 30, 15, 45, 'Sim']);
  assert.deepEqual([m.coberturaEfeitoPct, m.tarefas, m.competencias, m.perdemCentralidade], [100, 4, 4, 0]);
  assert.deepEqual([m.lacunasPorOcupante, m.densidadeMinima3, m.completudeTrilhaPct], ['Atendente 1: 3; Atendente 2: 1', 'Não', 67]);
  assert.deepEqual([m.diretrizUsoCritico, m.alertaPreservacao, m.facilidadeMedia, m.avaliacoes], ['Sim', 'Não', 4.5, 2]);
  assert.deepEqual([m.tarefasPorOrigem, m.competenciasPorOrigem, m.tarefasEditadasPct, m.competenciasEditadasPct], ['modelo: 2; planilha: 2', 'planilha: 4', 25, 0]);
  assert.deepEqual([m.ocupantes, m.trilhas], [2, 3]);
});

test('sem ocupante e sem trilha não divide por zero', () => {
  const { estrutura } = exemploAtendente();
  estrutura.tarefas[0].efeito_ia = null;
  estrutura.salvaguardas[0].resposta = 'Não';
  estrutura.salvaguardas[3].resposta = 'Não';
  estrutura.salvaguardas[5] = { ...estrutura.salvaguardas[5], resposta: 'Não sei', ajuste: '' };
  const m = calcularMetrica(dados({ estrutura, tempoPrimeiroOcupanteS: null, ultimasTrilhas: [], notas: [], arquivada: true }));
  assert.deepEqual([m.situacao, m.ate90min, m.tempoTotalMin, m.coberturaEfeitoPct], ['Arquivada', '—', 30, 75]);
  assert.deepEqual([m.lacunasPorOcupante, m.densidadeMinima3, m.completudeTrilhaPct, m.facilidadeMedia], ['—', '—', null, null]);
  assert.deepEqual([m.diretrizUsoCritico, m.alertaPreservacao], ['Não', 'Sim']);
});

test('CSV abre no Excel pt-BR e protege separadores', () => {
  const csv = paraCsv([calcularMetrica(dados())]);
  assert.ok(csv.startsWith('﻿'));
  const [cabecalho, linha] = csv.slice(1).split('\r\n');
  assert.equal(cabecalho.split(';').length, COLUNAS.length);
  assert.ok(linha.startsWith('"Loja; ""Central""";"Atendente\nde balcão";Ativa;modelo;2026-10-20;30;15;45;Sim;'));
  assert.ok(linha.includes(';4,5;2;'));
  assert.equal(paraCsv([]).slice(1).split('\r\n').length, 2);
});

test('CSV neutraliza fórmulas vindas de nomes digitados', () => {
  const csv = paraCsv([calcularMetrica(dados({ funcao: '=1+1', empresa: '@SUM(A1)' }))]);
  const linha = csv.slice(1).split('\r\n')[1];
  assert.ok(linha.startsWith("'@SUM(A1);'=1+1;"));
  assert.ok(paraCsv([calcularMetrica(dados({ funcao: '-x' }))]).includes(";'-x;"));
});
