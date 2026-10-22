'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';

export default function FormularioSenha({ primeiroAcesso }: { primeiroAcesso: boolean }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (nova !== confirmacao) {
      setErro('A confirmação não confere com a nova senha.');
      return;
    }
    setEnviando(true);
    try {
      const { destino } = await chamarApi<{ destino: string }>('/api/auth/senha', { method: 'POST', json: { senhaAtual: atual, novaSenha: nova } });
      window.location.assign(destino);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível trocar a senha.');
      setEnviando(false);
    }
  };
  return (
    <form className="auth-card" onSubmit={enviar}>
      <h1>{primeiroAcesso ? 'Crie sua senha' : 'Trocar senha'}</h1>
      <p className="helper">{primeiroAcesso ? 'A senha que você recebeu é temporária. Escolha uma senha só sua, com pelo menos 8 caracteres.' : 'Use pelo menos 8 caracteres.'}</p>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <Campo rotulo={primeiroAcesso ? 'Senha temporária' : 'Senha atual'}><input type="password" autoComplete="current-password" required maxLength={200} value={atual} onChange={e => setAtual(e.target.value)} /></Campo>
      <Campo rotulo="Nova senha"><input type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={nova} onChange={e => setNova(e.target.value)} /></Campo>
      <Campo rotulo="Repita a nova senha"><input type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={confirmacao} onChange={e => setConfirmacao(e.target.value)} /></Campo>
      <button className="button primary" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar senha'}</button>
    </form>
  );
}
