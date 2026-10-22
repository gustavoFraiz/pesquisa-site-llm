'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { chamarApi } from '@/components/api';
import { Campo, Selecao } from '@/components/Campo';
import type { ResumoModelo } from '@/lib/modelos';

type Props = { modelos: ResumoModelo[]; funcoes: { id: string; nome: string; empresa: string }[] };

export default function ListaModelos({ modelos, funcoes }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [funcaoId, setFuncaoId] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const executar = async (acao: () => Promise<void>) => {
    setErro('');
    setOcupado(true);
    try { await acao(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível concluir.'); } finally { setOcupado(false); }
  };
  const criar = (corpo: Record<string, string>) => executar(async () => {
    const { id } = await chamarApi<{ id: string }>('/api/admin/modelos', { method: 'POST', json: corpo });
    router.push(`/admin/modelos/${id}`);
  });
  return (
    <main className="page">
      <div className="page-heading"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Modelos de cargo</h1><p>Os gestores começam uma função a partir destes modelos. Desative em vez de apagar.</p></div></div>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <div className="priority-table">
        <div className="section-title"><h2>Modelos <span>{modelos.length}</span></h2></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Modelo</th><th>Tarefas</th><th>Competências</th><th>Situação</th><th></th></tr></thead>
          <tbody>{modelos.map(m => (
            <tr key={m.id}>
              <td><strong>{m.nome}</strong><br /><span className="helper">{m.descricao}</span></td>
              <td>{m.tarefas}</td><td>{m.competencias}</td>
              <td><span className={`badge ${m.ativo ? 'medium' : 'none'}`}>{m.ativo ? 'Ativo' : 'Desativado'}</span></td>
              <td><div className="row-actions">
                <a className="text-button" href={`/admin/modelos/${m.id}`}>Editar</a>
                <button className="text-button danger" disabled={ocupado} onClick={() => void executar(async () => {
                  await chamarApi(`/api/admin/modelos/${m.id}`, { method: 'PATCH', json: { ativo: !m.ativo } });
                  router.refresh();
                })}>{m.ativo ? 'Desativar' : 'Reativar'}</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="form-grid">
        <form className="panel" onSubmit={e => { e.preventDefault(); void criar({ nome }); }}>
          <h2>Novo modelo em branco</h2>
          <Campo rotulo="Nome do cargo"><input required maxLength={120} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Repositor de hortifrúti" /></Campo>
          <div><button className="button primary" disabled={ocupado}>Criar modelo</button></div>
        </form>
        <form className="panel" onSubmit={e => { e.preventDefault(); if (funcaoId) void criar({ funcaoId }); }}>
          <h2>Promover função de uma loja</h2>
          <p className="helper">Copia só tarefas e competências; salvaguardas, ocupantes e nome da loja ficam de fora.</p>
          <Campo rotulo="Função"><Selecao valor={funcaoId} vazio="Escolha a função" opcoes={funcoes.map(f => ({ valor: f.id, rotulo: `${f.empresa} — ${f.nome}` }))} aoMudar={setFuncaoId} /></Campo>
          <div><button className="button secondary" disabled={ocupado || !funcaoId}>Promover a modelo</button></div>
        </form>
      </div>
    </main>
  );
}
