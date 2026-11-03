'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';
import type { LojaDoGestor } from '@/lib/empresas';

const VAZIO = { nome: '', cidade: '', segmento: '' };

export default function GerenciarLojas({ lojas, atual }: { lojas: LojaDoGestor[]; atual: string }) {
  const [form, setForm] = useState(VAZIO);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const executar = async (acao: () => Promise<string>) => {
    setErro('');
    setOcupado(true);
    try {
      window.location.assign(await acao());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
      setOcupado(false);
    }
  };
  const entrar = (id: string) => void executar(async () => {
    await chamarApi(`/api/lojas/${id}`, { method: 'POST' });
    return '/';
  });
  const criar = (e: React.FormEvent) => {
    e.preventDefault();
    void executar(async () => {
      await chamarApi('/api/lojas', { method: 'POST', json: form });
      return '/boas-vindas';
    });
  };
  const mudar = (campo: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [campo]: e.target.value });
  return (
    <main className="page">
      <a className="text-button" href="/">← Painel da loja</a>
      <div className="page-heading"><div><p className="eyebrow">LOJAS</p><h1>Com qual loja você vai trabalhar?</h1><p>Use o mesmo login para aplicar a matriz em cada estabelecimento. Os dados de uma loja não aparecem nas outras.</p></div></div>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <div className="cards">{lojas.map(l => (
        <button key={l.id} className="card" disabled={ocupado || l.id === atual} onClick={() => entrar(l.id)}>
          <h2>{l.nome}</h2>
          {(l.cidade || l.segmento) && <p className="helper">{[l.cidade, l.segmento].filter(Boolean).join(' · ')}</p>}
          <span className="text-button">{l.id === atual ? 'Loja atual' : 'Entrar nesta loja →'}</span>
        </button>
      ))}</div>
      <form className="panel form-grid" onSubmit={criar}>
        <h2 className="wide">Nova loja</h2>
        <Campo rotulo="Nome da loja"><input required maxLength={120} value={form.nome} onChange={mudar('nome')} /></Campo>
        <Campo rotulo="Cidade"><input maxLength={120} value={form.cidade} onChange={mudar('cidade')} /></Campo>
        <Campo rotulo="Segmento"><input maxLength={120} value={form.segmento} onChange={mudar('segmento')} placeholder="Ex.: material de construção" /></Campo>
        <div className="wide"><button className="button primary" disabled={ocupado}>Cadastrar loja</button></div>
      </form>
    </main>
  );
}
