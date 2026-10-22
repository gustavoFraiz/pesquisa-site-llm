'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { chamarApi } from '@/components/api';
import { Campo, Selecao } from '@/components/Campo';
import type { ResumoModelo } from '@/lib/modelos';
import DescreverComIA from './DescreverComIA';

type Props = { modelos: ResumoModelo[]; funcoes: { id: string; nome: string }[]; extracaoInicial?: string };

export default function NovaFuncao({ modelos, funcoes, extracaoInicial }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [copiarDe, setCopiarDe] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const criar = async (corpo: Record<string, string>) => {
    setErro('');
    setOcupado(true);
    try {
      const { id } = await chamarApi<{ id: string }>('/api/funcoes', { method: 'POST', json: corpo });
      router.push(`/funcoes/${id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a função.');
      setOcupado(false);
    }
  };
  const importar = async (selecionado?: File) => {
    if (!selecionado) return;
    setErro('');
    setOcupado(true);
    try {
      const corpo = new FormData();
      corpo.set('file', selecionado);
      const { funcaoId } = await chamarApi<{ funcaoId: string }>('/api/import', { method: 'POST', body: corpo });
      router.push(`/funcoes/${funcaoId}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível importar.');
      setOcupado(false);
    } finally {
      if (arquivo.current) arquivo.current.value = '';
    }
  };
  return (
    <main className="page">
      <a className="text-button" href="/">← Painel da loja</a>
      <div className="page-heading"><div><p className="eyebrow">NOVA FUNÇÃO</p><h1>Como você quer começar?</h1><p>O jeito mais rápido é partir de um modelo e só ajustar o que for diferente na sua loja.</p></div></div>
      {erro && <div className="alert error" role="alert">{erro}</div>}

      <h2>Modelo pronto</h2>
      <p className="helper">Tarefas e competências típicas do varejo, já preenchidas. Você revisa tudo depois.</p>
      <div className="cards">{modelos.map(m => (
        <button key={m.id} className="card" disabled={ocupado} onClick={() => void criar({ modeloId: m.id })}>
          <h2>{m.nome}</h2>
          <p className="helper">{m.tarefas} tarefa(s) · {m.competencias} competência(s)</p>
          {m.descricao && <p className="helper">{m.descricao}</p>}
          <span className="text-button">Usar este modelo →</span>
        </button>
      ))}</div>

      <DescreverComIA extracaoInicial={extracaoInicial} />

      <div className="form-grid">
        {funcoes.length > 0 && (
          <form className="panel" onSubmit={e => { e.preventDefault(); if (copiarDe) void criar({ copiarDe }); }}>
            <h2>Copiar uma função da loja</h2>
            <p className="helper">Útil quando duas funções são parecidas. Os ocupantes não são copiados.</p>
            <Campo rotulo="Função de origem"><Selecao valor={copiarDe} vazio="Escolha a função" opcoes={funcoes.map(f => ({ valor: f.id, rotulo: f.nome }))} aoMudar={setCopiarDe} /></Campo>
            <div><button className="button secondary" disabled={ocupado || !copiarDe}>Copiar</button></div>
          </form>
        )}
        <form className="panel" onSubmit={e => { e.preventDefault(); void criar({ nome }); }}>
          <h2>Em branco</h2>
          <p className="helper">Para uma função que não se parece com nenhum modelo.</p>
          <Campo rotulo="Nome da função"><input required maxLength={120} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Atendente de balcão" /></Campo>
          <div><button className="button secondary" disabled={ocupado}>Começar em branco</button></div>
        </form>
      </div>
      <p className="helper">Já tem a planilha MRCC-PV preenchida? <button type="button" className="text-button" disabled={ocupado} onClick={() => arquivo.current?.click()}>Importar planilha (.xlsx)</button></p>
      <input ref={arquivo} type="file" accept=".xlsx" hidden onChange={e => void importar(e.target.files?.[0])} />
    </main>
  );
}
