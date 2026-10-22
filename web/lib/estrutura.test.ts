import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copiarEstrutura, efeitoAutomatico, estruturaVazia, novaCompetencia, novaTarefa, pendenciasCompetencias, pendenciasEstrutura, pendenciasTarefas, validarEstrutura, type Estrutura } from './estrutura.ts';

function completa(): Estrutura {
  const e = estruturaVazia();
  e.tarefas[0] = { ...e.tarefas[0], tarefa: 'Montar orçamento para o cliente', efeito_ia: 'P' };
  e.competencias = [{ ...novaCompetencia(e.tarefas[0].id), competencia: 'Proficiência na ferramenta' }];
  return e;
}

test('estrutura vazia é válida e tem uma tarefa e seis salvaguardas', () => {
  const e = validarEstrutura(estruturaVazia());
  assert.equal(e.tarefas.length, 1);
  assert.equal(e.tarefas[0].efeito_ia, null);
  assert.deepEqual(e.salvaguardas.map(s => s.numero), [1, 2, 3, 4, 5, 6]);
});

test('remove campos desconhecidos', () => {
  const e = completa() as Estrutura & { extra?: string };
  e.extra = 'x';
  (e.tarefas[0] as unknown as Record<string, unknown>).intruso = 1;
  const v = validarEstrutura(e) as unknown as Record<string, unknown>;
  assert.equal('extra' in v, false);
  assert.equal('intruso' in (v.tarefas as Record<string, unknown>[])[0], false);
});

test('rejeita valores fora das opções e limites', () => {
  const e = completa();
  assert.throws(() => validarEstrutura({ ...e, tarefas: [{ ...e.tarefas[0], frequencia: 'Mensal' }] }), /frequência/);
  assert.throws(() => validarEstrutura({ ...e, tarefas: Array.from({ length: 13 }, novaTarefa) }), /tarefas/);
  assert.throws(() => validarEstrutura({ ...e, salvaguardas: e.salvaguardas.slice(0, 5) }), /salvaguardas/);
  assert.throws(() => validarEstrutura({ ...e, versao: 2 }), /versão/);
  assert.throws(() => validarEstrutura(null), /estrutura/);
});

test('competência só aponta para tarefa existente ou para vazio', () => {
  const e = completa();
  assert.throws(() => validarEstrutura({ ...e, competencias: [{ ...e.competencias[0], tarefa_id: novaTarefa().id }] }), /tarefa associada/);
  assert.equal(validarEstrutura({ ...e, competencias: [{ ...e.competencias[0], tarefa_id: '' }] }).competencias[0].tarefa_id, '');
});

test('estrutura completa não tem pendências', () => {
  assert.deepEqual(pendenciasEstrutura(completa()), []);
});

test('aponta tarefa sem texto, sem efeito e repetida', () => {
  const e = completa();
  e.tarefas.push({ ...novaTarefa(), tarefa: '  montar ORÇAMENTO para o cliente ', efeito_ia: 'I' }, novaTarefa());
  assert.deepEqual(pendenciasTarefas(e), [
    'Tarefa 2: já existe outra tarefa com o mesmo texto.',
    'Tarefa 3: descreva a atividade.',
    'Tarefa 3: indique o efeito da IA.',
  ]);
});

test('aponta competência sem nome e sem tarefa (ex.: tarefa removida)', () => {
  const e = completa();
  e.competencias.push(novaCompetencia(''));
  assert.deepEqual(pendenciasCompetencias(e), ['Competência 2: informe o nome.', 'Competência 2: escolha a tarefa associada.']);
  assert.deepEqual(pendenciasCompetencias({ ...e, competencias: [] }), ['Cadastre ao menos uma competência.']);
});

test('aceita sugestões ignoradas opcionais e valida o formato', () => {
  const e = completa();
  assert.equal('sugestoes_ignoradas' in validarEstrutura(e), false);
  assert.deepEqual(validarEstrutura({ ...e, sugestoes_ignoradas: ['R1', 'R3'] }).sugestoes_ignoradas, ['R1', 'R3']);
  assert.throws(() => validarEstrutura({ ...e, sugestoes_ignoradas: [1] }), /sugestões ignoradas/);
});

test('copia a estrutura com IDs novos e origem marcada', () => {
  const e = completa();
  e.salvaguardas[0] = { ...e.salvaguardas[0], resposta: 'Sim' };
  e.sugestoes_ignoradas = ['R1'];
  e.tarefas[0].editada = true;
  const c = copiarEstrutura(e, 'modelo', false);
  assert.notEqual(c.tarefas[0].id, e.tarefas[0].id);
  assert.equal(c.competencias[0].tarefa_id, c.tarefas[0].id);
  assert.deepEqual([c.tarefas[0].origem, c.tarefas[0].editada, c.competencias[0].origem], ['modelo', false, 'modelo']);
  assert.equal(c.salvaguardas[0].resposta, 'Não sei');
  assert.equal('sugestoes_ignoradas' in c, false);
  assert.equal(copiarEstrutura(e, 'copia', true).salvaguardas[0].resposta, 'Sim');
  assert.deepEqual(validarEstrutura(c), c);
});

test('tarefa sem ferramenta e sem efeito passa a "não mudou"', () => {
  const t = { ...novaTarefa(), tarefa: 'Organizar o estoque' };
  assert.equal(efeitoAutomatico(t).efeito_ia, 'I');
  assert.equal(efeitoAutomatico({ ...t, ferramenta: 'Sistema com IA' }).efeito_ia, null);
  assert.equal(efeitoAutomatico({ ...t, efeito_ia: 'N' }).efeito_ia, 'N');
  assert.equal(efeitoAutomatico({ ...t, tarefa: '  ' }).efeito_ia, null);
});
