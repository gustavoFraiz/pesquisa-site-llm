import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { estruturaVazia } from './estrutura.ts';
import { arquivarFuncao, criarFuncao, listarFuncoes, listarFuncoesDeTodas, obterFuncao, salvarFuncao } from './funcoes.ts';

test('cria, obtém e salva função dentro da própria empresa', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const id = criarFuncao(db, a, { nome: ' Caixa ', estrutura: estruturaVazia(), origem: 'branco' });
  assert.equal(obterFuncao(db, a, id).nome, 'Caixa');
  assert.throws(() => obterFuncao(db, b, id), { status: 404 });
  assert.equal(obterFuncao(db, null, id).id, id);
  const e = estruturaVazia();
  e.tarefas[0].tarefa = 'Registrar vendas';
  salvarFuncao(db, a, id, { nome: 'Operador de caixa', estrutura: e });
  assert.equal(obterFuncao(db, a, id).estrutura.tarefas[0].tarefa, 'Registrar vendas');
  assert.throws(() => salvarFuncao(db, b, id, { nome: 'Invasão', estrutura: e }), { status: 404 });
});

test('recusa gravar por cima de uma versão mais nova (voltar do navegador, outra aba)', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  const agora = Date.UTC(2026, 9, 22, 12);
  const id = criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' }, agora);
  const aberta = obterFuncao(db, a, id).atualizadaEm;
  const nova = salvarFuncao(db, a, id, { nome: 'Caixa 1', estrutura: estruturaVazia(), versao: aberta }, agora);
  assert.notEqual(nova, aberta);
  assert.throws(() => salvarFuncao(db, a, id, { nome: 'Caixa antiga', estrutura: estruturaVazia(), versao: aberta }, agora), { status: 409 });
  assert.equal(obterFuncao(db, a, id).nome, 'Caixa 1');
  assert.ok(salvarFuncao(db, a, id, { nome: 'Caixa 2', estrutura: estruturaVazia(), versao: nova }, agora));
});

test('rejeita nome vazio e estrutura inválida sem alterar a função', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  assert.throws(() => criarFuncao(db, a, { nome: '  ', estrutura: estruturaVazia(), origem: 'branco' }), { status: 400 });
  const id = criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  assert.throws(() => salvarFuncao(db, a, id, { nome: 'Caixa', estrutura: { versao: 1 } }), { status: 400 });
  assert.equal(obterFuncao(db, a, id).estrutura.tarefas.length, 1);
});

test('lista com contagens e esconde arquivadas', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  const id = criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  const [r] = listarFuncoes(db, a);
  assert.deepEqual({ ...r, atualizadaEm: '' }, { id, nome: 'Caixa', atualizadaEm: '', tarefas: 1, competencias: 0, salvaguardasRespondidas: 0, pendencias: 3, ocupantes: 0, trilhas: 0 });
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
  arquivarFuncao(db, a, id);
  assert.deepEqual(listarFuncoes(db, a), []);
  assert.throws(() => obterFuncao(db, a, id), { status: 404 });
});

test('admin lista funções ativas de todas as empresas com o nome da loja', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'Loja A');
  const b = inserirEmpresa(db, 'Loja B');
  criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  const arquivada = criarFuncao(db, b, { nome: 'Antiga', estrutura: estruturaVazia(), origem: 'branco' });
  criarFuncao(db, b, { nome: 'Estoquista', estrutura: estruturaVazia(), origem: 'branco' });
  arquivarFuncao(db, b, arquivada);
  assert.deepEqual(listarFuncoesDeTodas(db).map(f => [f.empresa, f.nome]), [['Loja A', 'Caixa'], ['Loja B', 'Estoquista']]);
});
