import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { DURACAO_SESSAO_MS, usuarioPorToken, type Papel, type Usuario } from './auth.ts';
import { db } from './db.ts';
import { HttpErro } from './http.ts';

export const COOKIE_SESSAO = 'mrcc_auth';
export type Gestor = Usuario & { empresaId: string; empresaNome: string };
type Opcoes = { papel?: Papel; permitirTrocaPendente?: boolean };

export async function tokenAtual(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_SESSAO)?.value;
}

export async function usuarioAtual(): Promise<Usuario | null> {
  return usuarioPorToken(db(), await tokenAtual());
}

export const destinoInicial = (u: Usuario): string => (u.trocarSenha ? '/trocar-senha' : u.papel === 'admin' ? '/admin' : '/');

export async function exigirUsuario(opcoes: Opcoes = {}): Promise<Usuario> {
  const usuario = await usuarioAtual();
  if (!usuario) throw new HttpErro(401, 'Sua sessão expirou. Entre novamente.');
  if (usuario.trocarSenha && !opcoes.permitirTrocaPendente) throw new HttpErro(403, 'Troque a senha temporária antes de continuar.');
  if (opcoes.papel && usuario.papel !== opcoes.papel) throw new HttpErro(403, 'Acesso não permitido.');
  return usuario;
}

export async function exigirGestor(): Promise<Gestor> {
  return (await exigirUsuario({ papel: 'gestor' })) as Gestor;
}

export async function exigirPagina(opcoes: Opcoes = {}): Promise<Usuario> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/login');
  if (usuario.trocarSenha && !opcoes.permitirTrocaPendente) redirect('/trocar-senha');
  if (opcoes.papel && usuario.papel !== opcoes.papel) redirect(destinoInicial(usuario));
  return usuario;
}

export async function exigirPaginaGestor(): Promise<Gestor> {
  return (await exigirPagina({ papel: 'gestor' })) as Gestor;
}

export async function definirCookieSessao(token: string): Promise<void> {
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.MRCC_SECURE_COOKIE === '1', path: '/', maxAge: DURACAO_SESSAO_MS / 1000,
  });
}

export async function limparCookieSessao(): Promise<void> {
  (await cookies()).delete(COOKIE_SESSAO);
}

/** Em páginas: recurso inexistente ou de outra empresa vira a página 404 do Next. */
export function ou404<T>(f: () => T): T {
  try {
    return f();
  } catch (erro) {
    if (erro instanceof HttpErro && erro.status === 404) notFound();
    throw erro;
  }
}
