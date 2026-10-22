'use client';

import { FormEvent, useState } from 'react';

export default function BootstrapAdminPage() {
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const senha = String(form.get('senha') || '');
    const confirmacao = String(form.get('confirmacao') || '');
    if (senha !== confirmacao) {
      setErro(true);
      setMensagem('As senhas não conferem.');
      return;
    }

    setEnviando(true);
    setMensagem('');
    try {
      const resposta = await fetch('/api/bootstrap-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: form.get('token'),
          email: form.get('email'),
          senha,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error || 'Não foi possível criar o admin.');
      setErro(false);
      setMensagem('Admin criado com sucesso. Indo para o login...');
      setTimeout(() => { window.location.href = '/login'; }, 800);
    } catch (e) {
      setErro(true);
      setMensagem(e instanceof Error ? e.message : 'Não foi possível criar o admin.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: '48px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Criar primeiro administrador</h1>
      <p>Esta tela funciona somente enquanto ainda não existir nenhum administrador.</p>
      <form onSubmit={enviar} style={{ display: 'grid', gap: 14 }}>
        <label>
          Token de bootstrap
          <input name="token" required autoComplete="off" style={{ display: 'block', width: '100%', padding: 10, marginTop: 4 }} />
        </label>
        <label>
          E-mail do admin
          <input name="email" type="email" required autoComplete="username" style={{ display: 'block', width: '100%', padding: 10, marginTop: 4 }} />
        </label>
        <label>
          Senha
          <input name="senha" type="password" minLength={8} required autoComplete="new-password" style={{ display: 'block', width: '100%', padding: 10, marginTop: 4 }} />
        </label>
        <label>
          Repetir senha
          <input name="confirmacao" type="password" minLength={8} required autoComplete="new-password" style={{ display: 'block', width: '100%', padding: 10, marginTop: 4 }} />
        </label>
        <button type="submit" disabled={enviando} style={{ padding: 12, fontWeight: 700 }}>
          {enviando ? 'Criando...' : 'Criar administrador'}
        </button>
      </form>
      {mensagem && <p role="alert" style={{ marginTop: 16, fontWeight: 600 }}>{erro ? `Erro: ${mensagem}` : mensagem}</p>}
    </main>
  );
}
