import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { HttpErro } from './http.ts';
import { hashSenha, validarNovaSenha, verificarSenha } from './senha.ts';

export type Papel = 'admin' | 'gestor';
export type Usuario = { id: string; email: string; papel: Papel; empresaId: string | null; empresaNome: string | null; trocarSenha: boolean };

export const DURACAO_SESSAO_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_FALHAS = 5;
export const BLOQUEIO_MS = 15 * 60 * 1000;
export const MENSAGEM_LOGIN = 'E-mail ou senha incorretos. Após várias tentativas, aguarde 15 minutos.';

type Linha = {
  id: string; email: string; senha_hash: string; papel: Papel; empresa_id: string | null; trocar_senha: number;
  falhas: number; bloqueado_ate: number; empresa_nome: string | null; empresa_ativa: number | null;
};
const SELECIONAR = `SELECT u.id, u.email, u.senha_hash, u.papel, u.empresa_id, u.trocar_senha, u.falhas, u.bloqueado_ate,
  e.nome AS empresa_nome, e.ativa AS empresa_ativa FROM usuarios u LEFT JOIN empresas e ON e.id = u.empresa_id`;

const paraUsuario = (l: Linha): Usuario => ({
  id: l.id, email: l.email, papel: l.papel, empresaId: l.empresa_id, empresaNome: l.empresa_nome, trocarSenha: Number(l.trocar_senha) === 1,
});
const empresaBloqueada = (l: Linha) => l.papel === 'gestor' && Number(l.empresa_ativa) !== 1;

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export function normalizarEmail(email: unknown): string {
  const valor = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (valor.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) throw new HttpErro(400, 'Informe um e-mail válido.');
  return valor;
}

let hashFicticio: Promise<string> | undefined;

function criarSessao(db: DatabaseSync, usuarioId: string, agora: number): string {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO auth_sessoes (token_hash, usuario_id, expira, criada_em) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), usuarioId, agora + DURACAO_SESSAO_MS, new Date(agora).toISOString());
  return token;
}

export async function entrar(db: DatabaseSync, emailInformado: unknown, senha: unknown, agora = Date.now()): Promise<{ token: string; usuario: Usuario }> {
  const negar = () => new HttpErro(401, MENSAGEM_LOGIN);
  let email: string;
  try { email = normalizarEmail(emailInformado); } catch { throw negar(); }
  if (typeof senha !== 'string' || senha.length > 200) throw negar();
  const linha = db.prepare(`${SELECIONAR} WHERE u.email = ?`).get(email) as Linha | undefined;
  if (!linha) {
    // Mesmo custo de uma conta existente, para não revelar quais e-mails estão cadastrados.
    await verificarSenha(senha, await (hashFicticio ??= hashSenha('senha-ficticia-para-equalizar-tempo')));
    throw negar();
  }
  // Conta a tentativa antes do scrypt, num único UPDATE (síncrono): pedidos em paralelo não leem o mesmo contador.
  // Conta bloqueada não é reservada (changes = 0). Um acerto zera o contador logo abaixo.
  const reserva = db.prepare(`UPDATE usuarios
      SET falhas = CASE WHEN falhas + 1 >= ? THEN 0 ELSE falhas + 1 END,
          bloqueado_ate = CASE WHEN falhas + 1 >= ? THEN ? ELSE bloqueado_ate END
    WHERE id = ? AND bloqueado_ate <= ?`).run(MAX_FALHAS, MAX_FALHAS, agora + BLOQUEIO_MS, linha.id, agora);
  // A senha é sempre verificada, para conta bloqueada e livre levarem o mesmo tempo.
  const correta = await verificarSenha(senha, linha.senha_hash);
  if (Number(reserva.changes) === 0 || !correta || empresaBloqueada(linha)) throw negar();
  db.prepare('UPDATE usuarios SET falhas = 0, bloqueado_ate = 0, ultimo_acesso = ? WHERE id = ?').run(new Date(agora).toISOString(), linha.id);
  return { token: criarSessao(db, linha.id, agora), usuario: paraUsuario(linha) };
}

export function usuarioPorToken(db: DatabaseSync, token: string | undefined, agora = Date.now()): Usuario | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const linha = db.prepare(`${SELECIONAR} JOIN auth_sessoes s ON s.usuario_id = u.id WHERE s.token_hash = ? AND s.expira > ?`)
    .get(hashToken(token), agora) as Linha | undefined;
  if (!linha || empresaBloqueada(linha)) return null;
  return paraUsuario(linha);
}

export function encerrarSessao(db: DatabaseSync, token: string | undefined): void {
  if (token) db.prepare('DELETE FROM auth_sessoes WHERE token_hash = ?').run(hashToken(token));
}

export function inserirUsuario(db: DatabaseSync, dados: { email: string; senhaHash: string; papel: Papel; empresaId: string | null; trocarSenha: boolean }, agora = Date.now()): string {
  const email = normalizarEmail(dados.email);
  if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email)) throw new HttpErro(409, 'Já existe um usuário com este e-mail.');
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO usuarios (id, email, senha_hash, papel, empresa_id, trocar_senha, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, email, dados.senhaHash, dados.papel, dados.empresaId, dados.trocarSenha ? 1 : 0, new Date(agora).toISOString());
  return id;
}

export async function criarUsuario(db: DatabaseSync, dados: { email: string; senha: string; papel: Papel; empresaId: string | null; trocarSenha: boolean }, agora = Date.now()): Promise<string> {
  const senhaHash = await hashSenha(validarNovaSenha(dados.senha));
  return inserirUsuario(db, { email: dados.email, senhaHash, papel: dados.papel, empresaId: dados.empresaId, trocarSenha: dados.trocarSenha }, agora);
}

export async function definirSenha(db: DatabaseSync, usuarioId: string, novaSenha: string, trocarSenha: boolean, manterToken?: string): Promise<void> {
  const hash = await hashSenha(validarNovaSenha(novaSenha));
  db.prepare('UPDATE usuarios SET senha_hash = ?, trocar_senha = ?, falhas = 0, bloqueado_ate = 0 WHERE id = ?').run(hash, trocarSenha ? 1 : 0, usuarioId);
  db.prepare('DELETE FROM auth_sessoes WHERE usuario_id = ? AND token_hash <> ?').run(usuarioId, manterToken ? hashToken(manterToken) : '');
}

export async function trocarSenha(db: DatabaseSync, usuarioId: string, senhaAtual: unknown, novaSenha: unknown, tokenAtual: string): Promise<void> {
  const linha = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(usuarioId) as { senha_hash: string } | undefined;
  if (!linha || typeof senhaAtual !== 'string' || !(await verificarSenha(senhaAtual, linha.senha_hash))) throw new HttpErro(400, 'Senha atual incorreta.');
  const nova = validarNovaSenha(novaSenha);
  if (nova === senhaAtual) throw new HttpErro(400, 'A nova senha precisa ser diferente da atual.');
  await definirSenha(db, usuarioId, nova, false, tokenAtual);
}
