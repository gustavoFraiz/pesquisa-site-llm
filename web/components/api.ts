'use client';

/** Chama a API do próprio site; lança Error com a mensagem do servidor. */
export async function chamarApi<T = Record<string, unknown>>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...resto } = init;
  const opcoes: RequestInit = json === undefined ? resto : { ...resto, headers: { 'Content-Type': 'application/json', ...resto.headers }, body: JSON.stringify(json) };
  const resposta = await fetch(url, { cache: 'no-store', ...opcoes });
  const dados = (await resposta.json().catch(() => null)) as (T & { error?: string }) | null;
  if (resposta.status === 401 && !url.startsWith('/api/auth/')) {
    window.location.assign('/login');
    throw new Error('Sua sessão expirou. Entre novamente.');
  }
  if (!resposta.ok) {
    throw new Error(dados?.error || (resposta.status === 429 ? 'Muitas solicitações. Aguarde um minuto e tente novamente.' : 'Não foi possível concluir a operação.'));
  }
  return (dados ?? {}) as T;
}
