import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { criarAcao, definirAcaoAtiva, listarAcoes, listarCatalogoAtivo, LIMITE_ACOES } from './catalogo.ts';
import { CATALOGO_BASE } from './seed.ts';

test('lista catálogo global ativo mais as ações da própria empresa', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const inserir = (empresa: string, acao: string, ativa: number) =>
    db.prepare("INSERT INTO catalogo_acoes (id, empresa_id, eixo, acao, recurso, custo, ativa, criada_em) VALUES (?, ?, 'Geral', ?, 'Interno', 'R$ 0', ?, '2026-10-15')").run(crypto.randomUUID(), empresa, acao, ativa);
  inserir(a, 'Ação da loja A', 1);
  inserir(a, 'Ação desativada', 0);
  inserir(b, 'Ação da loja B', 1);
  const lista = listarCatalogoAtivo(db, a);
  assert.equal(lista.length, CATALOGO_BASE.length + 1);
  assert.deepEqual(lista.slice(0, CATALOGO_BASE.length), CATALOGO_BASE);
  assert.deepEqual(lista.at(-1), { eixo: 'Geral', acao: 'Ação da loja A', recurso: 'Interno', custo: 'R$ 0' });
});

const acao = (texto: string, eixo = 'Geral') => ({ eixo, acao: texto, recurso: 'Prática assistida', custo: 'R$ 0' });

test('gestor cria ação da loja; admin cria ação global; cada um vê o seu escopo', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  criarAcao(db, a, acao('Treinamento com o fornecedor do sistema'));
  criarAcao(db, null, acao('Leitura guiada do manual da ferramenta'));
  assert.deepEqual(listarAcoes(db, a).map(x => x.acao), ['Treinamento com o fornecedor do sistema']);
  assert.equal(listarAcoes(db, null).length, CATALOGO_BASE.length + 1);
  assert.equal(listarCatalogoAtivo(db, a).length, CATALOGO_BASE.length + 2);
});

test('recusa ação repetida do catálogo global, mesmo com maiúsculas e espaços diferentes', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  assert.throws(() => criarAcao(db, a, acao('  rodízio de FUNÇÕES   por uma semana ', 'Adaptabilidade')), { status: 409 });
  assert.throws(() => criarAcao(db, a, { ...acao('Curto'), eixo: 'Inventado' }), { status: 400 });
  assert.throws(() => criarAcao(db, a, acao('abc')), { status: 400 });
});

test('o motor nunca recebe ação repetida, mesmo se a global for criada depois', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  criarAcao(db, a, acao('Visita guiada a outra loja'));
  criarAcao(db, null, acao('visita guiada a outra loja'));
  const ativos = listarCatalogoAtivo(db, a).filter(x => x.acao.toLowerCase() === 'visita guiada a outra loja');
  assert.equal(ativos.length, 1);
});

test('limite de 20 ações ativas por escopo, inclusive ao reativar', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  const ids = Array.from({ length: LIMITE_ACOES }, (_, i) => criarAcao(db, a, acao(`Ação da loja número ${i}`)));
  assert.throws(() => criarAcao(db, a, acao('Ação a mais da loja')), { status: 400 });
  definirAcaoAtiva(db, a, ids[0], false);
  const extra = criarAcao(db, a, acao('Ação a mais da loja'));
  assert.throws(() => definirAcaoAtiva(db, a, ids[0], true), { status: 400 });
  assert.ok(extra);
});

test('não altera ação de outro escopo', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const id = criarAcao(db, a, acao('Ação exclusiva da loja A'));
  assert.throws(() => definirAcaoAtiva(db, b, id, false), { status: 404 });
  assert.throws(() => definirAcaoAtiva(db, null, id, false), { status: 404 });
  const global = listarAcoes(db, null)[0].id;
  assert.throws(() => definirAcaoAtiva(db, a, global, false), { status: 404 });
});
