import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, ID, inserirEmpresa } from './apoio-testes.ts';
import { estruturaVazia } from './estrutura.ts';
import { arquivarFuncao, criarFuncao, obterFuncao } from './funcoes.ts';
import { arquivarOcupante, criarOcupante, listarOcupantes, niveisDosOutros, ocupantesParaSintese, obterOcupante, salvarOcupante, validarNiveis } from './ocupantes.ts';

function cenario() {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const funcaoId = criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  return { db, a, b, funcaoId };
}

test('cria ocupante com prazo padrão e respeita a empresa', () => {
  const { db, a, b, funcaoId } = cenario();
  const id = criarOcupante(db, a, funcaoId, { apelido: ' Atendente 1 ' });
  const o = obterOcupante(db, a, id);
  assert.deepEqual({ apelido: o.apelido, prazoDias: o.prazoDias, niveis: o.niveis, funcaoId: o.funcaoId, empresaId: o.empresaId }, { apelido: 'Atendente 1', prazoDias: 14, niveis: {}, funcaoId, empresaId: a });
  assert.throws(() => obterOcupante(db, b, id), { status: 404 });
  assert.throws(() => criarOcupante(db, b, funcaoId, { apelido: 'X' }), { status: 404 });
});

test('salva níveis, apelido e prazo validados', () => {
  const { db, a, funcaoId } = cenario();
  const id = criarOcupante(db, a, funcaoId, { apelido: 'A1' });
  salvarOcupante(db, a, id, { apelido: 'A2', niveis: { [ID(1)]: { nivel: 'N1', respostas: [true, false, null] } }, prazoDias: 30 });
  const o = obterOcupante(db, a, id);
  assert.deepEqual({ apelido: o.apelido, prazoDias: o.prazoDias, niveis: o.niveis }, { apelido: 'A2', prazoDias: 30, niveis: { [ID(1)]: { nivel: 'N1', respostas: [true, false, null] } } });
  assert.throws(() => salvarOcupante(db, a, id, { apelido: 'A2', niveis: {}, prazoDias: 0 }), { status: 400 });
  assert.throws(() => salvarOcupante(db, a, id, { apelido: 'A2', niveis: {}, prazoDias: 1.5 }), { status: 400 });
  assert.throws(() => salvarOcupante(db, a, id, { apelido: '', niveis: {}, prazoDias: 14 }), { status: 400 });
});

test('recusa gravar níveis por cima de uma versão mais nova', () => {
  const { db, a, funcaoId } = cenario();
  const agora = Date.UTC(2026, 9, 22, 12);
  const id = criarOcupante(db, a, funcaoId, { apelido: 'A1' }, agora);
  const aberta = obterOcupante(db, a, id).atualizadoEm;
  const nova = salvarOcupante(db, a, id, { apelido: 'A1', niveis: { [ID(1)]: { nivel: 'N2', respostas: null } }, prazoDias: 14, versao: aberta }, agora);
  assert.notEqual(nova, aberta);
  assert.throws(() => salvarOcupante(db, a, id, { apelido: 'A1', niveis: {}, prazoDias: 14, versao: aberta }, agora), { status: 409 });
  assert.equal(obterOcupante(db, a, id).niveis[ID(1)].nivel, 'N2');
});

test('rejeita níveis malformados', () => {
  assert.throws(() => validarNiveis({ [ID(1)]: { nivel: 'N4', respostas: null } }), { status: 400 });
  assert.throws(() => validarNiveis({ 'nao-uuid': { nivel: 'N1', respostas: null } }), { status: 400 });
  assert.throws(() => validarNiveis({ [ID(1)]: { nivel: 'N1', respostas: [true] } }), { status: 400 });
  assert.throws(() => validarNiveis([]), { status: 400 });
  assert.deepEqual(validarNiveis({ [ID(1)]: { nivel: 'N3', respostas: null, extra: 1 } }), { [ID(1)]: { nivel: 'N3', respostas: null } });
});

test('lista ocupantes ativos com níveis preenchidos das competências atuais', () => {
  const { db, a, funcaoId } = cenario();
  const id = criarOcupante(db, a, funcaoId, { apelido: 'A1', niveis: { [ID(99)]: { nivel: 'N1', respostas: null } } });
  const outro = criarOcupante(db, a, funcaoId, { apelido: 'A2' });
  arquivarOcupante(db, a, outro);
  const lista = listarOcupantes(db, a, funcaoId);
  assert.deepEqual(lista.map(o => [o.id, o.apelido, o.niveisPreenchidos, o.trilhas]), [[id, 'A1', 0, 0]]);
  arquivarFuncao(db, a, funcaoId);
  assert.throws(() => obterOcupante(db, a, id), { status: 404 });
});

test('lista os níveis dos outros ocupantes ativos da mesma função', () => {
  const { db, a, b, funcaoId } = cenario();
  const atual = criarOcupante(db, a, funcaoId, { apelido: 'Atual' });
  const outro = criarOcupante(db, a, funcaoId, { apelido: 'Outro', niveis: { [ID(1)]: { nivel: 'N2', respostas: [true, true, false] } } });
  const arquivado = criarOcupante(db, a, funcaoId, { apelido: 'Arquivado' });
  arquivarOcupante(db, a, arquivado);
  assert.deepEqual(niveisDosOutros(db, a, funcaoId, atual), [{ id: outro, apelido: 'Outro', niveis: { [ID(1)]: { nivel: 'N2', respostas: [true, true, false] } } }]);
  assert.throws(() => niveisDosOutros(db, b, funcaoId, atual), { status: 404 });
});

test('síntese lista todos os ocupantes, com a última trilha, e abre função arquivada só quando pedido', () => {
  const { db, a, funcaoId } = cenario();
  const ativo = criarOcupante(db, a, funcaoId, { apelido: 'Ativo' });
  const velho = criarOcupante(db, a, funcaoId, { apelido: 'Velho' });
  arquivarOcupante(db, a, velho);
  arquivarFuncao(db, a, funcaoId);
  assert.throws(() => obterFuncao(db, a, funcaoId), { status: 404 });
  assert.equal(obterFuncao(db, a, funcaoId, true).arquivada, true);
  assert.deepEqual(ocupantesParaSintese(db, a, funcaoId).map(o => [o.id, o.arquivado, o.ultimaTrilha]), [[ativo, false, null], [velho, true, null]]);
});
