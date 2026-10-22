'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';

export default function FormularioLogin() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const { destino } = await chamarApi<{ destino: string }>('/api/auth/login', { method: 'POST', json: { email, senha } });
      window.location.assign(destino);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível entrar.');
      setEnviando(false);
    }
  };
  return (
    <form className="auth-card" onSubmit={enviar}>
      <div className="brand"><span className="brand-mark">M</span><span>MRCC<span className="brand-suffix">/PV</span><small>Redesenho de cargos e competências</small></span></div>
      <h1>Entrar</h1>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <Campo rotulo="E-mail"><input type="email" autoComplete="username" required maxLength={200} value={email} onChange={e => setEmail(e.target.value)} /></Campo>
      <Campo rotulo="Senha"><input type="password" autoComplete="current-password" required maxLength={200} value={senha} onChange={e => setSenha(e.target.value)} /></Campo>
      <button className="button primary" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      <p className="helper">O acesso é criado pela equipe da pesquisa. Esqueceu a senha? Fale com quem cadastrou sua loja.</p>
    </form>
  );
}
