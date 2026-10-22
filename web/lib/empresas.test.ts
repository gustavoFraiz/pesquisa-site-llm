import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste } from './apoio-testes.ts';
import { entrar, usuarioPorToken } from './auth.ts';
import { criarEmpresaComGestor, definirEmpresaAtiva, listarEmpresas, redefinirSenhaGestor } from './empresas.ts';

test('cria empresa com gestor e senha temporária que exige troca', async () => {
  const db = bancoDeTeste();
  const r = await criarEmpresaComGestor(db, { nome: ' Loja Azul ', cidade: 'Curitiba', segmento: 'Material de construção', email: 'Dono@Azul.com' });
  assert.equal(r.email, 'dono@azul.com');
  assert.match(r.senhaTemporaria, /^[A-Za-z2-9]{12}$/);
  const { usuario } = await entrar(db, 'dono@azul.com', r.senhaTemporaria);
  assert.equal(usuario.trocarSenha, true);
  assert.equal(usuario.empresaNome, 'Loja Azul');
  assert.equal(usuario.empresaId, r.empresaId);
});

test('recusa e-mail repetido sem deixar empresa sem gestor', async () => {
  const db = bancoDeTeste();
  await criarEmpresaComGestor(db, { nome: 'A', email: 'x@x.com' });
  await assert.rejects(criarEmpresaComGestor(db, { nome: 'B', email: 'X@x.com' }), { status: 409 });
  assert.equal(listarEmpresas(db).length, 1);
});

test('exige nome e e-mail válidos', async () => {
  const db = bancoDeTeste();
  await assert.rejects(criarEmpresaComGestor(db, { nome: '  ', email: 'x@x.com' }), { status: 400 });
  await assert.rejects(criarEmpresaComGestor(db, { nome: 'A', email: 'sem-arroba' }), { status: 400 });
  await assert.rejects(criarEmpresaComGestor(db, { nome: 'A'.repeat(121), email: 'x@x.com' }), { status: 400 });
});

test('desativar derruba a sessão do gestor; redefinir senha troca a credencial', async () => {
  const db = bancoDeTeste();
  const r = await criarEmpresaComGestor(db, { nome: 'A', email: 'x@x.com' });
  const { token } = await entrar(db, 'x@x.com', r.senhaTemporaria);
  definirEmpresaAtiva(db, r.empresaId, false);
  assert.equal(usuarioPorToken(db, token), null);
  assert.equal(listarEmpresas(db)[0].ativa, false);
  definirEmpresaAtiva(db, r.empresaId, true);
  const nova = await redefinirSenhaGestor(db, r.empresaId);
  await assert.rejects(entrar(db, 'x@x.com', r.senhaTemporaria), { status: 401 });
  assert.equal((await entrar(db, 'x@x.com', nova)).usuario.trocarSenha, true);
});

test('empresa inexistente responde 404', async () => {
  const db = bancoDeTeste();
  assert.throws(() => definirEmpresaAtiva(db, crypto.randomUUID(), false), { status: 404 });
  await assert.rejects(redefinirSenhaGestor(db, crypto.randomUUID()), { status: 404 });
});

test('lista com gestor e contagens de funções, ocupantes e trilhas ativos', async () => {
  const db = bancoDeTeste();
  const r = await criarEmpresaComGestor(db, { nome: 'Loja', email: 'g@l.com' });
  const gestor = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('g@l.com') as { id: string };
  const agora = new Date().toISOString();
  const funcao = (id: string, arquivada: number) => db.prepare("INSERT INTO funcoes (id, empresa_id, nome, estrutura, origem, arquivada, criada_em, atualizada_em) VALUES (?, ?, 'F', '{}', 'branco', ?, ?, ?)").run(id, r.empresaId, arquivada, agora, agora);
  const f1 = crypto.randomUUID();
  funcao(f1, 0);
  funcao(crypto.randomUUID(), 1);
  const o1 = crypto.randomUUID();
  db.prepare("INSERT INTO ocupantes (id, funcao_id, apelido, criado_em, atualizado_em) VALUES (?, ?, 'A1', ?, ?)").run(o1, f1, agora, agora);
  db.prepare("INSERT INTO execucoes (id, tipo, empresa_id, funcao_id, ocupante_id, criada_por, criada_em) VALUES (?, 'trilha', ?, ?, ?, ?, ?)").run(crypto.randomUUID(), r.empresaId, f1, o1, gestor.id, agora);
  db.prepare("INSERT INTO execucoes (id, tipo, empresa_id, funcao_id, ocupante_id, criada_por, criada_em) VALUES (?, 'diagnostico', ?, ?, ?, ?, ?)").run(crypto.randomUUID(), r.empresaId, f1, o1, gestor.id, agora);
  const [e] = listarEmpresas(db);
  assert.deepEqual({ email: e.emailGestor, funcoes: e.funcoes, ocupantes: e.ocupantes, trilhas: e.trilhas, ultimoAcesso: e.ultimoAcesso }, { email: 'g@l.com', funcoes: 1, ocupantes: 1, trilhas: 1, ultimoAcesso: null });
  assert.equal(Object.getPrototypeOf(e), Object.prototype);
});
