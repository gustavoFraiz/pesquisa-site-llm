'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';
import type { ResumoOcupante } from '@/lib/ocupantes';

type Props = { funcaoId: string; ocupantes: ResumoOcupante[]; pendencias: string[]; totalCompetencias: number; navegar: (href: string) => Promise<void> };

export default function EtapaOcupantes({ funcaoId, ocupantes, pendencias, totalCompetencias, navegar }: Props) {
  const [apelido, setApelido] = useState('');
  const [erro, setErro] = useState('');
  const [criando, setCriando] = useState(false);
  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCriando(true);
    try {
      const { id } = await chamarApi<{ id: string }>(`/api/funcoes/${funcaoId}/ocupantes`, { method: 'POST', json: { apelido } });
      await navegar(`/funcoes/${funcaoId}/ocupantes/${id}`);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível adicionar.');
      setCriando(false);
    }
  };
  return (
    <>
      {pendencias.length > 0 && <div className="alert info"><strong>Complete a função para gerar trilhas</strong>{pendencias.map(p => <p key={p}>{p}</p>)}</div>}
      <div className="section-title"><h2>Ocupantes <span>{ocupantes.length}</span></h2></div>
      {ocupantes.length ? (
        <div className="cards">{ocupantes.map(o => (
          <button key={o.id} className="card" onClick={() => void navegar(`/funcoes/${funcaoId}/ocupantes/${o.id}`)}>
            <h2>{o.apelido}</h2>
            <p className="helper">Níveis informados: {o.niveisPreenchidos}/{totalCompetencias} · {o.trilhas} trilha(s)</p>
          </button>
        ))}</div>
      ) : <p className="helper">Nenhum ocupante ainda. Adicione cada pessoa que exerce esta função.</p>}
      <form className="panel" onSubmit={adicionar}>
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <Campo rotulo="Apelido do ocupante"><input required maxLength={60} value={apelido} onChange={e => setApelido(e.target.value)} placeholder="Ex.: Atendente 1" /></Campo>
        <div><button className="button primary" disabled={criando}>Adicionar ocupante</button></div>
        <p className="helper">Use um apelido. Não registre nome completo, CPF ou outros dados pessoais.</p>
      </form>
    </>
  );
}
