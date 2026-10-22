import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, exemploAtendente, inserirEmpresa } from './apoio-testes.ts';
import { validarEstrutura } from './estrutura.ts';
import { sugerir } from './regras.ts';
import { criarFuncao } from './funcoes.ts';
import { criarModelo, definirModeloAtivo, listarModelos, obterModelo, promoverFuncao, salvarModelo, semearModelos } from './modelos.ts';

test('semeia os 5 modelos uma única vez, todos com estrutura válida', () => {
  const db = bancoDeTeste();
  semearModelos(db);
  const lista = listarModelos(db, false);
  assert.deepEqual(lista.map(m => m.nome), ['Atendente de balcão', 'Atendimento online/WhatsApp', 'Estoquista/Repositor', 'Operador(a) de caixa', 'Vendedor(a) de loja']);
  for (const m of lista) {
    const e = obterModelo(db, m.id, true).estrutura;
    assert.deepEqual(validarEstrutura(e), e);
    assert.ok(e.tarefas.length >= 4 && e.competencias.length >= 3);
    assert.ok(e.competencias.every(c => e.tarefas.some(t => t.id === c.tarefa_id)));
  }
  assert.equal(lista.find(m => m.nome === 'Atendente de balcão')?.competencias, 4);
  assert.equal(Object.getPrototypeOf(lista[0]), Object.prototype);
});

test('modelo desativado some para o gestor e responde 404 ao ser usado', () => {
  const db = bancoDeTeste();
  const [m] = listarModelos(db, false);
  definirModeloAtivo(db, m.id, false);
  assert.equal(listarModelos(db, false).some(x => x.id === m.id), false);
  assert.equal(listarModelos(db, true).find(x => x.id === m.id)?.ativo, false);
  assert.throws(() => obterModelo(db, m.id, true), { status: 404 });
  assert.equal(obterModelo(db, m.id, false).id, m.id);
});

test('cria modelo em branco e salva com validação', () => {
  const db = bancoDeTeste();
  const id = criarModelo(db, { nome: 'Caixa rápido', descricao: '', estrutura: undefined });
  const m = obterModelo(db, id, true);
  assert.deepEqual([m.nome, m.estrutura.tarefas.length], ['Caixa rápido', 1]);
  assert.throws(() => salvarModelo(db, id, { nome: '', descricao: '', estrutura: m.estrutura }), { status: 400 });
  assert.throws(() => salvarModelo(db, id, { nome: 'X', descricao: '', estrutura: { versao: 1 } }), { status: 400 });
  salvarModelo(db, id, { nome: 'Caixa expresso', descricao: 'Para lojas pequenas', estrutura: m.estrutura });
  assert.deepEqual([obterModelo(db, id, true).nome, obterModelo(db, id, true).descricao], ['Caixa expresso', 'Para lojas pequenas']);
});

test('promove função a modelo sem salvaguardas nem dados da empresa', () => {
  const db = bancoDeTeste();
  const empresa = inserirEmpresa(db);
  const { nome, estrutura } = exemploAtendente();
  const funcaoId = criarFuncao(db, empresa, { nome, estrutura, origem: 'planilha' });
  const m = obterModelo(db, promoverFuncao(db, funcaoId), true);
  assert.equal(m.nome, 'Atendente de balcão');
  assert.deepEqual(m.estrutura.tarefas.map(t => t.tarefa), estrutura.tarefas.map(t => t.tarefa));
  assert.ok(m.estrutura.salvaguardas.every(s => s.resposta === 'Não sei' && !s.observacao && !s.ajuste));
  assert.notEqual(m.estrutura.tarefas[0].id, estrutura.tarefas[0].id);
  assert.throws(() => promoverFuncao(db, crypto.randomUUID()), { status: 404 });
});

test('modelos semeados não nascem sugerindo competência repetida (R1, R2, R3)', () => {
  const db = bancoDeTeste();
  for (const m of listarModelos(db, false)) {
    const repetidas = sugerir(obterModelo(db, m.id, true).estrutura).competencias.filter(s => !s.chave.startsWith('R4:'));
    assert.deepEqual(repetidas.map(s => `${m.nome}: ${s.competencia.competencia}`), []);
  }
});
