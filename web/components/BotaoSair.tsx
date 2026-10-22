'use client';

export default function BotaoSair() {
  const sair = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/login');
  };
  return <button className="button secondary small" onClick={() => void sair()}>Sair</button>;
}
