'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { chamarApi } from '@/components/api';
import { Campo, Selecao } from '@/components/Campo';
import { useAutosave } from '@/components/useAutosave';
import { useTempoAtivo } from '@/components/useTempoAtivo';
import { ROTULOS_NIVEL, pendenciasEstrutura, type Estrutura, type NivelOcupante, type Niveis } from '@/lib/estrutura';
import { calcularLacunas } from '@/lib/lacunas';
import type { AcaoCatalogo } from '@/lib/seed';
import AvaliacaoUso from './AvaliacaoUso';
import PerguntasNivel from './PerguntasNivel';
import ResultadoTrilha, { type ResultadoAnalise } from './ResultadoTrilha';

type Execucao = { id: string; tipo: 'trilha' | 'diagnostico'; status: 'aguardando' | 'executando' | 'concluida' | 'erro'; criadaEm: string; error?: string; posicao: number | null; result: ResultadoAnalise | null };
type Historico = { id: string; tipo: string; criadaEm: string };
type Props = {
  funcao: { id: string; nome: string; estrutura: Estrutura };
  ocupante: { id: string; apelido: string; niveis: Niveis; prazoDias: number; atualizadoEm: string };
  execucaoInicial: string | null;
  historico: Historico[];
  catalogo: AcaoCatalogo[];
  outros: { id: string; apelido: string; niveis: Niveis }[];
  avaliacaoPendente: boolean;
};

export default function PaginaOcupante({ funcao, ocupante, historico: historicoInicial, catalogo, execucaoInicial, outros, avaliacaoPendente }: Props) {
  const router = useRouter();
  const [apelido, setApelido] = useState(ocupante.apelido);
  const [niveis, setNiveis] = useState<Niveis>(ocupante.niveis);
  const [prazoDias, setPrazoDias] = useState(ocupante.prazoDias);
  const [execucao, setExecucao] = useState<Execucao | null>(null);
  const [historico, setHistorico] = useState(historicoInicial);
  const [erro, setErro] = useState('');
  const [iniciando, setIniciando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [copias, setCopias] = useState(0);
  const { estado, erro: erroSalvar, salvarAgora } = useAutosave(`/api/ocupantes/${ocupante.id}`, { apelido, niveis, prazoDias }, ocupante.atualizadoEm);
  useTempoAtivo('ocupante', ocupante.id);
  const emAndamento = execucao?.status === 'aguardando' || execucao?.status === 'executando';
  const ocupado = iniciando || emAndamento;
  const { estrutura } = funcao;
  const lacunas = useMemo(() => calcularLacunas(estrutura, niveis), [estrutura, niveis]);
  const pendencias = useMemo(() => [
    ...pendenciasEstrutura(estrutura),
    ...estrutura.competencias.filter(c => !niveis[c.id]).map(c => `Informe o nível atual de "${c.competencia.trim() || 'competência sem nome'}".`),
  ], [estrutura, niveis]);

  useEffect(() => {
    chamarApi<{ modelReady?: boolean }>('/api/health').then(d => setPronto(Boolean(d.modelReady))).catch(() => setPronto(false));
  }, []);
  // Voltar pelo navegador reaproveita dados antigos: pede ao servidor a versão atual (a key remonta se mudou).
  useEffect(() => { router.refresh(); }, [router]);
  useEffect(() => { setHistorico(historicoInicial); }, [historicoInicial]);
  // Ao abrir ou recarregar, mostra a última geração (e continua acompanhando se ainda estiver na fila).
  useEffect(() => {
    if (!execucaoInicial) return;
    let cancelado = false;
    chamarApi<Execucao>(`/api/execucoes/${execucaoInicial}`)
      .then(dados => {
        if (cancelado) return;
        setExecucao(dados);
        if (dados.status === 'erro') setErro(dados.error ?? 'A geração falhou.');
      })
      .catch(() => undefined);
    return () => { cancelado = true; };
  }, [execucaoInicial]);

  const idEmAndamento = emAndamento ? execucao?.id : undefined;
  useEffect(() => {
    if (!idEmAndamento) return;
    let parado = false;
    const consultar = async () => {
      try {
        const dados = await chamarApi<Execucao>(`/api/execucoes/${idEmAndamento}`);
        if (parado) return;
        setExecucao(dados);
        if (dados.status === 'erro') setErro(dados.error ?? 'A geração falhou.');
      } catch (e) {
        if (!parado) setErro(e instanceof Error ? e.message : 'Falha ao consultar a geração.');
      }
    };
    const timer = setInterval(() => void consultar(), 4000);
    return () => { parado = true; clearInterval(timer); };
  }, [idEmAndamento]);

  useEffect(() => {
    if (!ocupado) return;
    setSegundos(0);
    const timer = setInterval(() => setSegundos(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [ocupado]);

  const gerar = async (tipo: 'trilha' | 'diagnostico') => {
    if (ocupado) return;
    setErro('');
    setIniciando(true);
    try {
      await salvarAgora();
      const dados = await chamarApi<Execucao>(`/api/ocupantes/${ocupante.id}/execucoes`, { method: 'POST', json: { tipo } });
      setExecucao({ ...dados, result: null });
      setHistorico(h => [{ id: dados.id, tipo, criadaEm: dados.criadaEm }, ...h].slice(0, 10));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível iniciar.');
    } finally {
      setIniciando(false);
    }
  };
  const abrir = async (id: string) => {
    if (ocupado) return;
    try {
      const dados = await chamarApi<Execucao>(`/api/execucoes/${id}`);
      setExecucao(dados);
      setErro(dados.status === 'erro' ? dados.error ?? 'A geração falhou.' : '');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Análise indisponível.');
    }
  };
  const mudarNivel = (competenciaId: string, valor: NivelOcupante | null) => {
    setExecucao(null);
    setNiveis(n => {
      const novo = { ...n };
      if (valor) novo[competenciaId] = valor;
      else delete novo[competenciaId];
      return novo;
    });
  };
  const copiarNiveis = (outroId: string) => {
    const origem = outros.find(o => o.id === outroId);
    if (!origem) return;
    // Remonta as perguntas só quando os níveis vêm de fora; respostas parciais sobrevivem às correções.
    setCopias(n => n + 1);
    setExecucao(null);
    setNiveis(n => {
      const novo = { ...n };
      for (const c of estrutura.competencias) if (origem.niveis[c.id]) novo[c.id] = origem.niveis[c.id];
      return novo;
    });
  };
  const voltar = async () => {
    try {
      await salvarAgora();
      router.push(`/funcoes/${funcao.id}?etapa=ocupantes`);
    } catch {
      // O aviso de erro do salvamento já aparece na tela.
    }
  };
  const arquivar = async () => {
    if (!window.confirm(`Arquivar ${apelido}? As trilhas já geradas continuam registradas.`)) return;
    try {
      await chamarApi(`/api/ocupantes/${ocupante.id}`, { method: 'DELETE' });
      router.push(`/funcoes/${funcao.id}?etapa=ocupantes`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível arquivar.');
    }
  };
  const resultado = execucao?.status === 'concluida' ? execucao.result : null;
  const naFila = execucao?.status === 'aguardando' && (execucao.posicao ?? 0) > 0;

  return (
    <main className="page">
      <button className="text-button" onClick={() => void voltar()}>← {funcao.nome}</button>
      <div className="page-heading">
        <div><p className="eyebrow">OCUPANTE DA FUNÇÃO</p><h1>{apelido.trim() || 'Ocupante'}</h1><p>Registre o nível atual em cada competência. A lacuna é a distância até o nível que a função exige.</p></div>
        <span className="stage-tag">M3 + M4 · Trilha</span>
      </div>
      {(erro || erroSalvar) && <div className="alert error" role="alert">{erro || erroSalvar}<button onClick={() => setErro('')} aria-label="Fechar aviso">×</button></div>}
      <div className="role-strip">
        <Campo rotulo="Apelido"><input value={apelido} maxLength={60} disabled={ocupado} onChange={e => setApelido(e.target.value)} /></Campo>
        <div className="role-caption">Use um apelido.<br />Não registre dados pessoais.</div>
      </div>
      {outros.length > 0 && (
        <div className="role-strip">
          <Campo rotulo="Copiar níveis de outro ocupante"><Selecao valor="" vazio="Escolha um ocupante" opcoes={outros.map(o => ({ valor: o.id, rotulo: o.apelido }))} aoMudar={copiarNiveis} /></Campo>
          <div className="role-caption">Útil quando as pessoas estão no mesmo estágio.<br />Depois ajuste o que for diferente.</div>
        </div>
      )}
      <fieldset className="editor" disabled={ocupado}>
        <div className="section-title"><h2>Nível atual <span>{estrutura.competencias.length}</span></h2></div>
        {estrutura.competencias.map((c, i) => {
          const tarefa = estrutura.tarefas.find(t => t.id === c.tarefa_id);
          return (
            <article className="entry" key={c.id}>
              <div className="entry-number">{String(i + 1).padStart(2, '0')}</div>
              <div className="entry-fields">
                <div className="wide"><strong>{c.competencia.trim() || 'Competência sem nome'}</strong><p className="helper">{c.eixo} · Tarefa: {tarefa?.tarefa || 'não associada'} · A função exige: {ROTULOS_NIVEL[c.alvo]}</p></div>
                <div className="wide"><PerguntasNivel key={`${c.id}-${copias}`} competencia={c} valor={niveis[c.id]} aoMudar={v => mudarNivel(c.id, v)} desabilitado={ocupado} /></div>
              </div>
            </article>
          );
        })}
      </fieldset>
      <div className="priority-table">
        <div className="section-title"><h2>Lacunas deste ocupante</h2><span className="helper">Maior score primeiro</span></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Competência</th><th>Níveis</th><th>Lacuna</th><th>Score</th><th>Prioridade</th></tr></thead>
          <tbody>{lacunas.map(l => (
            <tr key={l.competenciaId}>
              <td>{l.competencia}</td><td>{l.atual ?? '—'} → {l.alvo}</td><td>{l.lacuna ?? '—'}</td><td>{l.score ?? '—'}</td>
              <td><span className={`badge ${l.prioridade === 'Alta' ? 'high' : l.prioridade === 'Média' ? 'medium' : 'none'}`}>{l.prioridade}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      <Campo rotulo="Prazo inicial proposto (dias)">
        <input type="number" min={1} max={180} step={1} disabled={ocupado} value={prazoDias} onChange={e => { setExecucao(null); setPrazoDias(Number(e.target.value)); }} />
      </Campo>
      <p className="helper">Confirme o prazo com a equipe. Os critérios são referências do protótipo; a IA escolhe a atividade e justifica a escolha.</p>
      {pendencias.length > 0 && <div className="alert info"><strong>Para gerar a trilha</strong>{pendencias.map(p => <p key={p}>{p}</p>)}</div>}
      <div className="generation-bar">
        <div><h2>Propostas para o gestor</h2><p>Escolhas dentro do catálogo, com justificativa e evidência de conclusão.</p></div>
        <button className="button primary" disabled={ocupado || !pronto || pendencias.length > 0} onClick={() => void gerar('trilha')}>{ocupado ? 'Gerando…' : 'Gerar recomendações'}</button>
      </div>
      {!pronto && <p className="helper">As recomendações estão indisponíveis no momento (modelo de IA não carregado). O diagnóstico continua disponível.</p>}
      {ocupado && (
        <div className="processing" role="status"><span className="spinner" /><div>
          <strong>{naFila ? `Na fila · posição ${execucao?.posicao}` : execucao?.tipo === 'diagnostico' ? 'Calculando o diagnóstico' : 'Preparando a trilha'}</strong>
          <p>A geração pode levar alguns minutos nesta máquina. Você pode manter a página aberta; o pedido continua em segundo plano.</p>
          <span className="helper">Tempo nesta página: {Math.floor(segundos / 60)} min {segundos % 60} s</span>
        </div></div>
      )}
      {!ocupado && !resultado && (
        <div className="empty-state"><span className="empty-mark">↳</span><h3>O próximo passo é desenvolver.</h3><p>Gere a trilha para transformar as lacunas em propostas de ação.</p>
          <button className="text-button" disabled={pendencias.length > 0} onClick={() => void gerar('diagnostico')}>Conferir diagnóstico sem gerar a trilha</button></div>
      )}
      {resultado && execucao && <ResultadoTrilha resultado={resultado} execucaoId={execucao.id} />}
      {resultado && execucao?.tipo === 'trilha' && avaliacaoPendente && <AvaliacaoUso funcaoId={funcao.id} />}
      <div className="catalog">
        <button className="catalog-toggle" onClick={() => setCatalogoAberto(!catalogoAberto)} aria-expanded={catalogoAberto}><span>Catálogo de ações disponíveis <b>{catalogo.length}</b></span><span>{catalogoAberto ? '−' : '+'}</span></button>
        {catalogoAberto && <div className="catalog-items">{catalogo.map(a => <div key={`${a.eixo}|${a.acao}`}><span className="eyebrow">{a.eixo}</span><p>{a.acao}</p><small>{a.recurso} · {a.custo}</small></div>)}</div>}
      </div>
      <div className="session-history">
        <p className="eyebrow">ANÁLISES DESTE OCUPANTE</p>
        {historico.length ? historico.map((h, i) => (
          <button key={h.id} className="history-item" disabled={ocupado} onClick={() => void abrir(h.id)}>
            <span>{h.tipo === 'trilha' ? 'Trilha' : 'Diagnóstico'} {historico.length - i}</span>
            <small>{new Date(h.criadaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
          </button>
        )) : <p className="helper">O histórico aparecerá aqui.</p>}
      </div>
      <footer className="workspace-footer">
        <span>{estado === 'salvo' ? 'Alterações salvas.' : estado === 'pendente' ? 'Salvando…' : 'Não foi possível salvar. Veja o aviso acima.'} Prazos e critérios precisam de revisão. R$ 0 não inclui o tempo de trabalho.</span>
        <button className="text-button danger" disabled={ocupado} onClick={() => void arquivar()}>Arquivar ocupante</button>
      </footer>
    </main>
  );
}
