import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { BLOQUEIO_MS, DURACAO_SESSAO_MS, MENSAGEM_LOGIN, criarUsuario, encerrarSessao, entrar, trocarSenha, usuarioPorToken } from './auth.ts';

async function cenario() {
  const db = bancoDeTeste();
  const empresaId = inserirEmpresa(db);
  await criarUsuario(db, { email: 'Gestor@Loja.com ', senha: 'senha-temporaria', papel: 'gestor', empresaId, trocarSenha: true });
  return { db, empresaId };
}

test('entra sem diferenciar maiúsculas e recupera o usuário pelo token', async () => {
  const { db, empresaId } = await cenario();
  const { token, usuario } = await entrar(db, ' GESTOR@loja.com', 'senha-temporaria');
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.deepEqual(usuario, { id: usuario.id, email: 'gestor@loja.com', papel: 'gestor', empresaId, empresaNome: 'Loja Teste', trocarSenha: true });
  assert.deepEqual(usuarioPorToken(db, token), usuario);
});

test('senha errada e e-mail inexistente recebem a mesma resposta', async () => {
  const { db } = await cenario();
  await assert.rejects(entrar(db, 'gestor@loja.com', 'errada'), { status: 401, message: MENSAGEM_LOGIN });
  await assert.rejects(entrar(db, 'ninguem@loja.com', 'senha-temporaria'), { status: 401, message: MENSAGEM_LOGIN });
  await assert.rejects(entrar(db, 'sem-arroba', 'senha-temporaria'), { status: 401, message: MENSAGEM_LOGIN });
});

test('bloqueia por 15 minutos após 5 falhas, mesmo com a senha correta', async () => {
  const { db } = await cenario();
  const agora = Date.UTC(2026, 9, 15, 12);
  for (let i = 0; i < 5; i++) await assert.rejects(entrar(db, 'gestor@loja.com', 'errada', agora), { status: 401 });
  await assert.rejects(entrar(db, 'gestor@loja.com', 'senha-temporaria', agora + 1000), { status: 401, message: MENSAGEM_LOGIN });
  const { usuario } = await entrar(db, 'gestor@loja.com', 'senha-temporaria', agora + BLOQUEIO_MS + 1);
  assert.equal(usuario.email, 'gestor@loja.com');
});

test('tentativas erradas em paralelo também bloqueiam a conta', async () => {
  const { db } = await cenario();
  const agora = Date.UTC(2026, 9, 15, 12);
  const tentativas = Array.from({ length: 20 }, () => entrar(db, 'gestor@loja.com', 'errada', agora).catch(e => e));
  await Promise.all(tentativas);
  await assert.rejects(entrar(db, 'gestor@loja.com', 'senha-temporaria', agora + 1000), { status: 401, message: MENSAGEM_LOGIN });
});

test('sessão expira em 14 dias e some no logout', async () => {
  const { db } = await cenario();
  const agora = Date.UTC(2026, 9, 15);
  const { token } = await entrar(db, 'gestor@loja.com', 'senha-temporaria', agora);
  assert.ok(usuarioPorToken(db, token, agora + DURACAO_SESSAO_MS - 1));
  assert.equal(usuarioPorToken(db, token, agora + DURACAO_SESSAO_MS + 1), null);
  encerrarSessao(db, token);
  assert.equal(usuarioPorToken(db, token, agora), null);
});

test('empresa desativada impede login e derruba sessões abertas', async () => {
  const { db, empresaId } = await cenario();
  const { token } = await entrar(db, 'gestor@loja.com', 'senha-temporaria');
  db.prepare('UPDATE empresas SET ativa = 0 WHERE id = ?').run(empresaId);
  assert.equal(usuarioPorToken(db, token), null);
  await assert.rejects(entrar(db, 'gestor@loja.com', 'senha-temporaria'), { status: 401 });
});

test('trocar a senha exige a atual, desliga a troca pendente e encerra as outras sessões', async () => {
  const { db } = await cenario();
  const a = await entrar(db, 'gestor@loja.com', 'senha-temporaria');
  const b = await entrar(db, 'gestor@loja.com', 'senha-temporaria');
  await assert.rejects(trocarSenha(db, a.usuario.id, 'errada', 'nova-senha-123', a.token), { status: 400 });
  await assert.rejects(trocarSenha(db, a.usuario.id, 'senha-temporaria', 'senha-temporaria', a.token), { status: 400 });
  await trocarSenha(db, a.usuario.id, 'senha-temporaria', 'nova-senha-123', a.token);
  assert.equal(usuarioPorToken(db, a.token)?.trocarSenha, false);
  assert.equal(usuarioPorToken(db, b.token), null);
  await assert.rejects(entrar(db, 'gestor@loja.com', 'senha-temporaria'), { status: 401 });
  assert.ok((await entrar(db, 'gestor@loja.com', 'nova-senha-123')).token);
});

test('e-mail repetido é recusado com 409', async () => {
  const { db, empresaId } = await cenario();
  await assert.rejects(criarUsuario(db, { email: 'gestor@loja.com', senha: 'outra-senha', papel: 'admin', empresaId: null, trocarSenha: false }), { status: 409 });
  assert.ok(empresaId);
});

test('token malformado ou ausente não autentica', () => {
  const db = bancoDeTeste();
  assert.equal(usuarioPorToken(db, 'abc'), null);
  assert.equal(usuarioPorToken(db, undefined), null);
});
