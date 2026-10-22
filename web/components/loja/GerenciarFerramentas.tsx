'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';
import type { Ferramenta } from '@/lib/ferramentas';

export default function GerenciarFerramentas({ iniciais, categorias }: { iniciais: Ferramenta[]; categorias: string[] }) {
  const [ferramentas, setFerramentas] = useState(iniciais);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const executar = async (acao: () => Promise<unknown>) => {
    setErro('');
    setOcupado(true);
    try {
      await acao();
      setFerramentas((await chamarApi<{ ferramentas: Ferramenta[] }>('/api/ferramentas')).ferramentas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  };
  const adicionar = (valor: string) => executar(() => chamarApi('/api/ferramentas', { method: 'POST', json: { nome: valor } }));
  const ja = new Set(ferramentas.map(f => f.nome.toLocaleLowerCase('pt-BR')));
  return (
    <div className="panel">
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <div className="chips">{ferramentas.length ? ferramentas.map(f => (
        <span className="chip ativo" key={f.id}>{f.nome}<button type="button" disabled={ocupado} aria-label={`Remover ${f.nome}`} onClick={() => void executar(() => chamarApi(`/api/ferramentas/${f.id}`, { method: 'DELETE' }))}>×</button></span>
      )) : <p className="helper">Nenhuma ferramenta cadastrada ainda.</p>}</div>
      <p className="helper">Sugestões (toque para incluir e depois ajuste o nome, se quiser):</p>
      <div className="chips">{categorias.filter(c => !ja.has(c.toLocaleLowerCase('pt-BR'))).map(c => (
        <button type="button" className="chip" key={c} disabled={ocupado} onClick={() => void adicionar(c)}>+ {c}</button>
      ))}</div>
      <form className="role-strip" onSubmit={e => { e.preventDefault(); void adicionar(nome).then(() => setNome('')); }}>
        <Campo rotulo="Outra ferramenta"><input value={nome} minLength={2} maxLength={80} onChange={e => setNome(e.target.value)} placeholder="Escreva o nome que a equipe usa" /></Campo>
        <button className="button secondary" disabled={ocupado || nome.trim().length < 2}>Incluir</button>
      </form>
    </div>
  );
}
