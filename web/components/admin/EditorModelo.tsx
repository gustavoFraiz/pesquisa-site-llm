'use client';
import { useState } from 'react';
import { Campo } from '@/components/Campo';
import EtapaCompetencias from '@/components/funcao/EtapaCompetencias';
import EtapaTarefas from '@/components/funcao/EtapaTarefas';
import { useAutosave } from '@/components/useAutosave';
import { pendenciasEstrutura, type Estrutura } from '@/lib/estrutura';

type Props = { modelo: { id: string; nome: string; descricao: string; estrutura: Estrutura } };

export default function EditorModelo({ modelo }: Props) {
  const [nome, setNome] = useState(modelo.nome);
  const [descricao, setDescricao] = useState(modelo.descricao);
  const [estrutura, setEstrutura] = useState(modelo.estrutura);
  const { estado, erro } = useAutosave(`/api/admin/modelos/${modelo.id}`, { nome, descricao, estrutura });
  const pendencias = pendenciasEstrutura(estrutura);
  return (
    <main className="page">
      <a className="text-button" href="/admin/modelos">← Modelos</a>
      <div className="page-heading"><div><p className="eyebrow">MODELO DE CARGO</p><h1>{nome || 'Modelo sem nome'}</h1><p>Tarefas e competências que o gestor recebe ao escolher este modelo. As salvaguardas são respondidas por cada loja.</p></div></div>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <div className="panel form-grid">
        <Campo rotulo="Nome do cargo"><input value={nome} maxLength={120} onChange={e => setNome(e.target.value)} /></Campo>
        <Campo rotulo="Descrição (aparece no cartão)"><input value={descricao} maxLength={300} onChange={e => setDescricao(e.target.value)} /></Campo>
      </div>
      <EtapaTarefas estrutura={estrutura} aoMudar={setEstrutura} ferramentas={[]} />
      <EtapaCompetencias estrutura={estrutura} aoMudar={setEstrutura} />
      {pendencias.length > 0 && <div className="alert info"><strong>O gestor verá estas pendências</strong>{pendencias.map(p => <p key={p}>{p}</p>)}</div>}
      <footer className="workspace-footer"><span>{estado === 'salvo' ? 'Alterações salvas.' : estado === 'pendente' ? 'Salvando…' : 'Não foi possível salvar. Veja o aviso acima.'}</span></footer>
    </main>
  );
}
