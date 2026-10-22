import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exemploAtendente, ID } from './apoio-testes.ts';
import { estruturaDaEntrada, montarEntrada } from './entrada-motor.ts';
import { CATALOGO_BASE, SALVAGUARDAS } from './seed.ts';

test('monta a entrada do motor no formato da planilha', () => {
  const { nome, estrutura, niveis } = exemploAtendente();
  const entrada = montarEntrada({ nome, estrutura }, { niveis, prazoDias: 30 }, CATALOGO_BASE);
  assert.deepEqual(entrada.tarefas[2], { funcao: 'Atendente de balcão', tarefa: 'Negociar prazo com cliente insatisfeito', frequencia: 'Semanal', criticidade: 'Alta', ferramenta: null, efeito_ia: 'I' });
  assert.deepEqual(entrada.competencias[0], { funcao: 'Atendente de balcão', competencia: 'Letramento em IA', eixo: 'Letramento em IA', tarefa: 'Revisar o orçamento gerado pela IA', atual: 'N0 - Não exposto', alvo: 'N2 - Usuário autônomo' });
  assert.deepEqual(entrada.salvaguardas[2], { numero: 3, ancora: 'Significado da tarefa', verificacao: SALVAGUARDAS[2].verificacao, resposta: 'Não', observacao: estrutura.salvaguardas[2].observacao, ajuste: estrutura.salvaguardas[2].ajuste });
  assert.equal(entrada.salvaguardas[1].ajuste, null);
  assert.deepEqual(entrada.trilha, []);
  assert.equal(entrada.prazo_dias_proposto, 30);
  assert.deepEqual(entrada.catalogo, CATALOGO_BASE);
});

test('bloqueia geração quando a tarefa da competência foi removida', () => {
  const { nome, estrutura, niveis } = exemploAtendente();
  estrutura.competencias[0].tarefa_id = '';
  assert.throws(() => montarEntrada({ nome, estrutura }, { niveis, prazoDias: 14 }, CATALOGO_BASE), { status: 400, message: /Competência 1: escolha a tarefa associada/ });
});

test('bloqueia geração quando falta o nível atual de uma competência', () => {
  const { nome, estrutura, niveis } = exemploAtendente();
  delete niveis[ID(14)];
  assert.throws(() => montarEntrada({ nome, estrutura }, { niveis, prazoDias: 14 }, CATALOGO_BASE), { status: 400, message: /Julgamento em situação de atendimento difícil/ });
});

test('importação da planilha volta à mesma entrada, com IDs novos', () => {
  const { nome, estrutura, niveis } = exemploAtendente();
  const entrada = montarEntrada({ nome, estrutura }, { niveis, prazoDias: 30 }, CATALOGO_BASE);
  const daPlanilha = { ...entrada, tarefas: entrada.tarefas.map(t => (t.ferramenta === null ? { ...t, ferramenta: '—' } : t)) };
  const importada = estruturaDaEntrada(daPlanilha);
  assert.equal(importada.nome, 'Atendente de balcão');
  assert.equal(importada.estrutura.tarefas[2].ferramenta, '');
  assert.notEqual(importada.estrutura.tarefas[0].id, ID(1));
  assert.ok(importada.estrutura.tarefas.every(t => t.origem === 'planilha'));
  assert.deepEqual(montarEntrada({ nome: importada.nome, estrutura: importada.estrutura }, { niveis: importada.niveis, prazoDias: 30 }, CATALOGO_BASE), entrada);
});
