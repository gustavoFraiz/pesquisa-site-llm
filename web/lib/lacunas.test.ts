import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exemploAtendente, ID } from './apoio-testes.ts';
import { calcularLacunas } from './lacunas.ts';

test('reproduz lacunas, scores e ordem do exemplo preenchido (ANALISE_CIENTIFICA.md)', () => {
  const { estrutura, niveis } = exemploAtendente();
  assert.deepEqual(calcularLacunas(estrutura, niveis).map(l => [l.competencia, l.lacuna, l.score, l.prioridade]), [
    ['Letramento em IA', 2, 26, 'Alta'],
    ['Proficiência na ferramenta de orçamento', 1, 16, 'Média'],
    ['Julgamento em situação de atendimento difícil', 1, 15, 'Média'],
    ['Adaptabilidade a novos fluxos de trabalho', 0, 5, 'Nenhuma'],
  ]);
});

test('nível atual acima do alvo vira lacuna zero; sem nível vai para o fim', () => {
  const { estrutura, niveis } = exemploAtendente();
  niveis[ID(11)] = { nivel: 'N3', respostas: null };
  delete niveis[ID(12)];
  const lacunas = calcularLacunas(estrutura, niveis);
  assert.deepEqual(lacunas.find(l => l.competenciaId === ID(11))?.lacuna, 0);
  assert.deepEqual(lacunas.at(-1), { competenciaId: ID(12), competencia: 'Proficiência na ferramenta de orçamento', eixo: 'Proficiência técnica', tarefa: 'Montar orçamento para o cliente', atual: null, alvo: 'N2', lacuna: null, score: null, prioridade: 'Sem nível' });
});
