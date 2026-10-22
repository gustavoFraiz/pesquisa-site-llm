import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exemploAtendente, ID } from './apoio-testes.ts';
import { novaCompetencia, validarEstrutura, type Estrutura } from './estrutura.ts';
import { aceitarSugestoes, ignorarSugestao, sugerir } from './regras.ts';

function semCompetencias(): Estrutura {
  return { ...exemploAtendente().estrutura, competencias: [] };
}
const resumo = (e: Estrutura) => sugerir(e).competencias.map(s => [s.chave, s.competencia.eixo, s.competencia.tarefa_id, s.competencia.alvo]);

test('reproduz as 4 competências da planilha de exemplo (eixo, tarefa e nível-alvo)', () => {
  assert.deepEqual(resumo(semCompetencias()), [
    ['R1', 'Letramento em IA', ID(4), 'N2'],
    ['R2:assistente de ia interno (catálogo)', 'Proficiência técnica', ID(2), 'N2'],
    ['R4:' + ID(3), 'Relacionais e de julgamento', ID(3), 'N3'],
    ['R3', 'Adaptabilidade', ID(1), 'N2'],
  ]);
  const [letramento] = sugerir(semCompetencias()).competencias;
  assert.equal(letramento.competencia.competencia, 'Letramento em IA');
  assert.equal(letramento.competencia.origem, 'regra');
  assert.match(letramento.competencia.motivo ?? '', /Revisar o orçamento gerado pela IA/);
});

test('com as competências da planilha não sugere nada repetido; só a perda de centralidade', () => {
  const { estrutura } = exemploAtendente();
  const s = sugerir(estrutura);
  assert.deepEqual(s.competencias, []);
  assert.deepEqual(s.perdem_centralidade.map(p => [p.chave, p.perda.descricao, p.perda.tarefa_id]), [['R7:' + ID(1), 'Executar manualmente: Consultar preço e estoque', ID(1)]]);
});

test('letramento cai para tarefa P quando não há tarefa nova; tarefa sem efeito é ignorada', () => {
  const e = semCompetencias();
  e.tarefas = e.tarefas.filter(t => t.efeito_ia !== 'N');
  e.tarefas.push({ ...e.tarefas[0], id: ID(9), tarefa: 'Tarefa sem classificação', efeito_ia: null });
  assert.deepEqual(resumo(e)[0], ['R1', 'Letramento em IA', ID(2), 'N2']);
  assert.equal(resumo(e).some(r => r[2] === ID(9)), false);
});

test('ignorar uma sugestão a remove da lista', () => {
  const e = ignorarSugestao(semCompetencias(), 'R3');
  assert.deepEqual(e.sugestoes_ignoradas, ['R3']);
  assert.equal(sugerir(e).competencias.some(s => s.chave === 'R3'), false);
  assert.deepEqual(ignorarSugestao(e, 'R3').sugestoes_ignoradas, ['R3']);
});

test('aceitar todas respeita o limite de 8 e avisa quais ficaram de fora', () => {
  const e = semCompetencias();
  // 6 competências de letramento ligadas a "Montar orçamento": nenhuma bloqueia as 4 sugestões da regra.
  e.competencias = Array.from({ length: 6 }, (_, i) => ({ ...novaCompetencia(ID(2)), competencia: `Outra ${i}` }));
  const chaves = sugerir(e).competencias.map(s => s.chave);
  const { estrutura, recusadas } = aceitarSugestoes(e, chaves);
  assert.equal(estrutura.competencias.length, 8);
  assert.equal(recusadas.length, chaves.length - 2);
  assert.ok(recusadas.every(n => typeof n === 'string' && n.length > 0));
});

test('aceitar inclui perda de centralidade e ignora chave desconhecida', () => {
  const { estrutura } = exemploAtendente();
  const { estrutura: nova, recusadas } = aceitarSugestoes(estrutura, ['R7:' + ID(1), 'R99']);
  assert.deepEqual(nova.perdem_centralidade.map(p => [p.tarefa_id, p.origem]), [[ID(1), 'regra']]);
  assert.deepEqual(recusadas, []);
  assert.deepEqual(sugerir(nova).perdem_centralidade, []);
});

test('textos longos de tarefa e ferramenta continuam dentro dos limites de validação', () => {
  const e = semCompetencias();
  const longa = 'Tarefa longa '.repeat(30).slice(0, 300);
  const ferramenta = 'F'.repeat(200);
  e.tarefas = e.tarefas.map(t => ({ ...t, tarefa: `${t.tarefa} ${longa}`.slice(0, 300), ferramenta: t.ferramenta ? ferramenta : '' }));
  const chaves = [...sugerir(e).competencias, ...sugerir(e).perdem_centralidade].map(s => s.chave);
  let aceita = aceitarSugestoes(e, chaves).estrutura;
  for (const chave of chaves) aceita = ignorarSugestao(aceita, chave);
  assert.deepEqual(validarEstrutura(aceita), aceita);
});
