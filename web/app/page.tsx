'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Row = Record<string, string | number | null>;
type Gap = Row & { id: string; gap: number; score: number; priority: string };
type Input = { tarefas: Row[]; competencias: Row[]; catalogo: Row[]; salvaguardas: Row[]; trilha: Row[]; prazo_dias_proposto?: number; pesos_criticidade?: Record<string, number>; pesos_frequencia?: Record<string, number> };
type Proposal = { competencia_id: string; decisao: string; acao_id: string | null; justificativa: string; responsavel_sugerido: string | null; prazo_dias_sugerido: number | null; criterio_conclusao: string | null; orientacao_ao_gestor: string };
type Result = { diagnostico: { competencias: Row[]; priorizadas: Row[]; catalogo: Row[]; pendencias: string[]; status_ciclo: string }; plano: { resumo: string; recomendacoes: Proposal[] } | null; metadados: { tempo_segundos?: number } };
type Job = { id: string; status: string; error?: string; result: Result | null; mode?: string };
type History = { id: string; createdAt: string };
const steps = ['Tarefas', 'Competências', 'Salvaguardas', 'Trilha de ações'];
const axes = ['Letramento em IA', 'Proficiência técnica', 'Adaptabilidade', 'Relacionais e de julgamento'];
const levels = ['N0 - Não exposto', 'N1 - Usuário assistido', 'N2 - Usuário autônomo', 'N3 - Usuário crítico'];
const value = (v: unknown) => v == null ? '' : String(v);
const weights: Record<string, number> = { Alta: 3, Média: 2, Baixa: 1, Diária: 3, Semanal: 2, Eventual: 1 };

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>; }
function Select({ value: v, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) { return <select value={v} onChange={e => onChange(e.target.value)}>{!options.includes(v) && <option value={v}>Selecione uma tarefa</option>}{options.map(o => <option key={o} value={o}>{o || 'Selecione uma tarefa'}</option>)}</select>; }

export default function Page() {
  const [input, setInput] = useState<Input | null>(null);
  const [step, setStep] = useState(0);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);
  const [history, setHistory] = useState<History[]>([]);
  const [saved, setSaved] = useState(true);
  const [starting, setStarting] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const questionTop = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    questionTop.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [step]);
  const busy = starting || job?.status === 'running';
  const invalidate = () => { setJob(null); setError(''); };
  const newAnalysis = () => {
    if (!input || busy) return;
    invalidate(); setStep(0);
    setInput({ ...input,
      tarefas: [{ funcao: '', tarefa: '', frequencia: 'Diária', criticidade: 'Média', ferramenta: '', efeito_ia: 'I' }],
      competencias: [{ funcao: '', competencia: '', eixo: axes[0], tarefa: '', atual: levels[0], alvo: levels[2] }],
      salvaguardas: input.salvaguardas.map(s => ({ ...s, resposta: 'Não sei', observacao: '', ajuste: '' })), trilha: [] });
  };

  const loadExample = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/seed', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setInput(data); setStep(0); setJob(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar o exemplo.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const response = await fetch('/api/session', { cache: 'no-store' });
        const session = await response.json();
        if (!response.ok) throw new Error(session.error);
        const seed = session.draft || await fetch('/api/seed', { cache: 'no-store' }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });
        if (cancelled) return;
        setInput(session.draft ? seed : { ...seed,
          tarefas: [{ funcao: '', tarefa: '', frequencia: 'Diária', criticidade: 'Média', ferramenta: '', efeito_ia: 'I' }],
          competencias: [{ funcao: '', competencia: '', eixo: axes[0], tarefa: '', atual: levels[0], alvo: levels[2] }],
          salvaguardas: seed.salvaguardas.map((s: Row) => ({ ...s, resposta: 'Não sei', observacao: '', ajuste: '' })), trilha: [] });
        setHistory(session.history);
        if (session.currentJob) { setJob({ id: session.currentJob, status: 'running', result: null }); setStep(3); }
        setSessionReady(true);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível iniciar a sessão.'); }
      finally { if (!cancelled) setLoading(false); }
    };
    void initialize();
    fetch('/api/health').then(r => r.json()).then(d => setReady(d.modelReady)).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!input || !sessionReady) return;
    setSaved(false);
    const timer = setTimeout(() => {
      fetch('/api/session', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, jobId: job?.id || null }) })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); setSaved(true); })
        .catch(e => setError(e instanceof Error ? e.message : 'Falha ao salvar o rascunho.'));
    }, 700);
    return () => clearTimeout(timer);
  }, [input, job?.id, sessionReady]);
  useEffect(() => {
    if (!job?.id || job.status !== 'running') return;
    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${job.id}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) { if (!stopped && response.status === 404) setJob(j => j ? { ...j, status: 'error' } : null); throw new Error(data.error); }
        if (!stopped) { setJob(data); if (data.status === 'error') setError(data.error); }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'Falha ao consultar a geração.'); }
    };
    void poll(); const timer = setInterval(poll, 4000);
    return () => { stopped = true; clearInterval(timer); };
  }, [job?.id, job?.status]);
  useEffect(() => { if (!busy) return; setElapsed(0); const timer = setInterval(() => setElapsed(t => t + 1), 1000); return () => clearInterval(timer); }, [busy]);

  const gaps = useMemo<Gap[]>(() => input?.competencias.map<Gap>((c, i) => {
    const task = input.tarefas.find(t => t.tarefa === c.tarefa && t.funcao === c.funcao);
    const gap = Math.max(0, Number(value(c.alvo)[1]) - Number(value(c.atual)[1]));
    return { ...c, id: `C${i + 2}`, gap, score: gap * 10 + (input.pesos_criticidade?.[value(task?.criticidade)] || weights[value(task?.criticidade)] || 0) + (input.pesos_frequencia?.[value(task?.frequencia)] || weights[value(task?.frequencia)] || 0), priority: gap === 0 ? 'Nenhuma' : gap >= 2 ? 'Alta' : 'Média' };
  }).filter(c => value(c.competencia).trim() && value(c.tarefa).trim() && value(c.funcao).trim() && Number.isFinite(c.gap)).sort((a, b) => b.score - a.score) || [], [input]);
  const prioritized = gaps.filter(c => c.gap > 0);
  const pending = input?.salvaguardas.filter(s => s.resposta !== 'Sim' && !value(s.ajuste).trim()).length || 0;
  const update = (group: 'tarefas' | 'competencias' | 'salvaguardas', index: number, key: string, v: string) => {
    if (!input || busy) return;
    invalidate();
    const next = { ...input, [group]: input[group].map((row, i) => i === index ? { ...row, [key]: v } : row) };
    if (group === 'tarefas' && key === 'tarefa') next.competencias = next.competencias.map(c => c.tarefa === input.tarefas[index].tarefa ? { ...c, tarefa: v } : c);
    setInput(next);
  };
  const setRole = (role: string) => { if (!input || busy) return; invalidate(); setInput({ ...input, tarefas: input.tarefas.map(t => ({ ...t, funcao: role })), competencias: input.competencias.map(c => ({ ...c, funcao: role })) }); };
  const remove = (group: 'tarefas' | 'competencias', index: number) => {
    if (!input || busy) return;
    invalidate();
    const next = { ...input, [group]: input[group].filter((_, i) => i !== index) };
    if (group === 'tarefas') next.competencias = next.competencias.map(c => c.tarefa === input.tarefas[index].tarefa ? { ...c, tarefa: '' } : c);
    setInput(next);
  };
  const generate = useCallback(async (mode: 'analise' | 'llm') => {
    if (!input || busy) return;
    setError(''); setStarting(true);
    try {
      const response = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, mode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setJob({ ...data, result: null }); setStep(3);
      setHistory(h => [{ id: data.id, createdAt: data.createdAt }, ...h].slice(0, 10));
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível iniciar a geração.'); return false; }
    finally { setStarting(false); }
  }, [input, busy]);
  const openHistory = async (id: string) => {
    if (busy) return;
    try {
      const response = await fetch(`/api/jobs/${id}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setInput(data.input); setJob(data); setStep(3); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Análise indisponível.'); }
  };
  const importFile = async (file?: File) => {
    if (!file || busy) return;
    setLoading(true); setError('');
    try {
      const body = new FormData(); body.set('file', file);
      const response = await fetch('/api/import', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      invalidate(); setInput(data); setStep(0);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível importar.'); }
    finally { setLoading(false); if (upload.current) upload.current.value = ''; }
  };

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => Promise<void> | void } }).modelContext;
    if (!context) return;
    const controller = new AbortController();
    const register = (tool: unknown) => { try { Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(() => {}); } catch {} };
    register({ name: 'read_mrcc_diagnosis', description: 'Ler lacunas e pendências do formulário visível.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: (args: unknown) => { if (!args || Object.keys(args as object).length) throw new Error('Sem argumentos.'); return { lacunas: gaps, ajustesPendentes: pending, etapa: steps[step] }; } });
    register({ name: 'start_mrcc_recommendation', description: 'Iniciar geração da trilha para o formulário atual; envia as respostas à VM e muda para a etapa Trilha.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async (args: unknown) => { if (!args || Object.keys(args as object).length || !input || busy) throw new Error('Formulário indisponível ou solicitação inválida.'); if (!await generate('llm')) throw new Error('A geração não iniciou. Consulte o aviso na página.'); return { iniciado: true }; } });
    return () => controller.abort();
  }, [gaps, pending, step, generate, input, busy]);

  const result = job?.result;
  return <>
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">M</span><span>MRCC<span className="brand-suffix">/PV</span><small>Redesenho de cargos e competências</small></span></a><div className="header-actions"><span className="availability">{ready ? 'Recomendações disponíveis' : 'Verificando recomendações'}</span><button className="button secondary" disabled={loading || busy} onClick={newAnalysis}>Nova análise</button><input ref={upload} type="file" accept=".xlsx" hidden onChange={e => void importFile(e.target.files?.[0])} /></div></header>
    <main className="shell"><aside className="sidebar"><p className="eyebrow">SEU CICLO DE ANÁLISE</p><nav aria-label="Etapas da análise">{steps.map((name, i) => <button key={name} className={`step ${step === i ? 'active' : ''}`} onClick={() => setStep(i)}><span className="step-number">0{i + 1}</span><span>{name}<small>{['Impacto da IA no trabalho', 'Nível atual e nível-alvo', 'Qualidade do trabalho', 'Plano de desenvolvimento'][i]}</small></span></button>)}</nav><div className="side-note"><span className="note-icon">↳</span><strong>Uma função por rodada</strong><p>Preencha a matriz aqui no site. As escolhas finais ficam com o gestor.</p><button className="text-button" disabled={busy} onClick={() => void loadExample()}>Carregar exemplo preenchido</button><br/><button className="text-button" disabled={busy} onClick={() => upload.current?.click()} style={{marginTop:14}}>Importar Excel (opcional)</button></div><div className="session-history"><p className="eyebrow">ANÁLISES DESTA SESSÃO</p>{history.length ? history.map((h, i) => <button key={h.id} className="history-item" disabled={busy} onClick={() => void openHistory(h.id)}><span>Análise {history.length - i}</span><small>{new Date(h.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></button>) : <p className="helper">Seu histórico aparecerá aqui.</p>}<p className="helper">Sem login. A sessão dura 30 dias neste navegador; limpar os cookies remove seu acesso.</p></div><div className="side-footer">MRCC-PV · PBL4<br/>Pesquisa aplicada / Pessoas e cultura</div></aside>
    <section className="workspace"><div ref={questionTop} className="page-heading"><div><p className="eyebrow">PASSO 0{step + 1} / 04</p><h1>{['Entenda o trabalho.', 'Encontre as lacunas.', 'Preserve a qualidade.', 'Construa a transição.'][step]}</h1><p>{['Registre as tarefas da função e como a IA participa de cada uma.', 'Relacione cada competência à tarefa e compare os níveis de proficiência.', 'Confira as condições do trabalho com o ocupante da função.', 'Revise as lacunas e gere propostas de desenvolvimento para o gestor.'][step]}</p></div><span className="stage-tag">{['M1 · Diagnóstico', 'M2 + M3 · Competências', 'Salvaguarda · UC7', 'M4 · Trilha'][step]}</span></div>
    {error && <div className="alert error" role="alert">{error}<button onClick={() => setError('')} aria-label="Fechar aviso">×</button></div>}
    {loading || !input ? <div className="loading-panel"><span className="spinner"/>Carregando a matriz…</div> : <>
      {step < 3 && <div className="role-strip"><Field label="Função analisada"><input disabled={busy} value={value(input.tarefas[0]?.funcao)} onChange={e => setRole(e.target.value)} placeholder="Ex.: Atendente de balcão" maxLength={200}/></Field><div className="role-caption">Descreva funções e tarefas.<br/>Evite nomes e dados pessoais.</div></div>}
      <fieldset disabled={busy} className="editor">
      {step === 0 && <><div className="section-title"><h2>Mapa de tarefas <span>{input.tarefas.length}</span></h2><button className="button secondary small" disabled={input.tarefas.length >= 12} onClick={() => { invalidate(); setInput({ ...input, tarefas: [...input.tarefas, { funcao: input.tarefas[0]?.funcao || '', tarefa: '', frequencia: 'Diária', criticidade: 'Média', ferramenta: '', efeito_ia: 'I' }] }); }}>+ Adicionar tarefa</button></div>{input.tarefas.map((t, i) => <article className="entry" key={i}><div className="entry-number">{String(i + 1).padStart(2, '0')}</div><div className="entry-fields"><Field label="Tarefa" wide><input value={value(t.tarefa)} onChange={e => update('tarefas', i, 'tarefa', e.target.value)} placeholder="Descreva uma atividade, começando por um verbo" maxLength={300}/></Field><Field label="Frequência"><Select value={value(t.frequencia)} options={['Diária', 'Semanal', 'Eventual']} onChange={v => update('tarefas', i, 'frequencia', v)}/></Field><Field label="Criticidade"><Select value={value(t.criticidade)} options={['Alta', 'Média', 'Baixa']} onChange={v => update('tarefas', i, 'criticidade', v)}/></Field><Field label="Ferramenta de IA"><input value={value(t.ferramenta)} onChange={e => update('tarefas', i, 'ferramenta', e.target.value)} placeholder="Se houver" maxLength={200}/></Field><Field label="Efeito da IA"><Select value={value(t.efeito_ia)} options={['A', 'P', 'I', 'N']} onChange={v => update('tarefas', i, 'efeito_ia', v)}/></Field></div><button className="remove" disabled={input.tarefas.length <= 1} onClick={() => remove('tarefas', i)} aria-label={`Remover tarefa ${i + 1}`}>×</button></article>)}<div className="legend"><span><b>A</b> Automatizada</span><span><b>P</b> Aprimorada</span><span><b>I</b> Inalterada</span><span><b>N</b> Nova</span></div></>}
      {step === 1 && <><div className="section-title"><h2>Perfil de competências <span>{input.competencias.length}</span></h2><button className="button secondary small" disabled={input.competencias.length >= 8} onClick={() => { invalidate(); setInput({ ...input, competencias: [...input.competencias, { funcao: input.tarefas[0]?.funcao || '', competencia: '', eixo: axes[0], tarefa: input.tarefas[0]?.tarefa || '', atual: levels[0], alvo: levels[2] }] }); }}>+ Adicionar competência</button></div>{input.competencias.map((c, i) => <article className="entry" key={i}><div className="entry-number">{String(i + 1).padStart(2, '0')}</div><div className="entry-fields"><Field label="Competência" wide><input value={value(c.competencia)} onChange={e => update('competencias', i, 'competencia', e.target.value)} maxLength={300}/></Field><Field label="Eixo"><Select value={value(c.eixo)} options={axes} onChange={v => update('competencias', i, 'eixo', v)}/></Field><Field label="Tarefa associada"><Select value={value(c.tarefa)} options={input.tarefas.map(t => value(t.tarefa))} onChange={v => update('competencias', i, 'tarefa', v)}/></Field><Field label="Nível atual"><Select value={value(c.atual)} options={levels} onChange={v => update('competencias', i, 'atual', v)}/></Field><Field label="Nível-alvo"><Select value={value(c.alvo)} options={levels} onChange={v => update('competencias', i, 'alvo', v)}/></Field></div><button className="remove" disabled={input.competencias.length <= 1} onClick={() => remove('competencias', i)} aria-label={`Remover competência ${i + 1}`}>×</button></article>)}<p className="helper">A lacuna considera a diferença entre alvo e atual. Frequência e criticidade refinam a ordem de prioridade.</p></>}
      {step === 2 && <><div className="alert info"><strong>Validação com duas pessoas</strong><p>Esta tela registra uma resposta por âncora. Ela não comprova as respostas separadas e a concordância entre gestor e ocupante previstas em UC7.</p></div>{input.salvaguardas.map((s, i) => <article className="safeguard" key={i}><div className="safeguard-top"><div><span className="eyebrow">ÂNCORA {s.numero}</span><h2>{value(s.ancora)}</h2><p>{value(s.verificacao)}</p></div><Field label="Resposta"><Select value={value(s.resposta)} options={['Sim', 'Não', 'Parcialmente', 'Não sei']} onChange={v => update('salvaguardas', i, 'resposta', v)}/></Field></div><div className="entry-fields"><Field label="Observação"><textarea value={value(s.observacao)} onChange={e => update('salvaguardas', i, 'observacao', e.target.value)} maxLength={1000}/></Field><Field label={s.resposta === 'Sim' ? 'Ajuste registrado (se necessário)' : 'Ajuste registrado — necessário'}><textarea value={value(s.ajuste)} onChange={e => update('salvaguardas', i, 'ajuste', e.target.value)} maxLength={1000} className={s.resposta !== 'Sim' && !value(s.ajuste).trim() ? 'needs-adjustment' : ''}/></Field></div></article>)}</>}
      </fieldset>
      {step === 3 && <><div className="priority-table"><div className="section-title"><h2>Lacunas desta rodada</h2><span className="helper">Maior score primeiro</span></div><div className="table-scroll"><table><thead><tr><th>Competência</th><th>Níveis</th><th>Lacuna</th><th>Score</th><th>Prioridade</th></tr></thead><tbody>{gaps.map(c => <tr key={c.id}><td>{value(c.competencia)}</td><td>{value(c.atual).slice(0, 2)} → {value(c.alvo).slice(0, 2)}</td><td>{c.gap}</td><td>{c.score}</td><td><span className={`badge ${c.priority === 'Alta' ? 'high' : c.priority === 'Média' ? 'medium' : 'none'}`}>{c.priority}</span></td></tr>)}</tbody></table></div></div><Field label="Prazo inicial proposto (dias)"><input type="number" min={1} max={180} step={1} disabled={busy} value={input.prazo_dias_proposto ?? 14} onChange={e => { invalidate(); setInput({ ...input, prazo_dias_proposto: Number(e.target.value) }); }} /></Field><p className="helper">Confirme o prazo com a equipe. Os critérios são referências do protótipo; a LLM seleciona a atividade e justifica a escolha.</p><div className="generation-bar"><div><h2>Propostas para o gestor</h2><p>Escolhas dentro do catálogo, com justificativa e evidência de conclusão.</p></div><button className="button primary" disabled={busy || !ready} onClick={() => void generate('llm')}>{busy ? 'Gerando…' : 'Gerar recomendações'}</button></div>
      {busy && <div className="processing" role="status"><span className="spinner"/><div><strong>{job?.mode === 'analise' ? 'Calculando o diagnóstico' : 'Preparando sua trilha'}</strong><p>A geração pode levar alguns minutos nesta máquina. Você pode manter a página aberta; o pedido continua em segundo plano.</p><span className="helper">Tempo nesta página: {Math.floor(elapsed / 60)} min {elapsed % 60} s</span></div></div>}
      {!busy && !result && <div className="empty-state"><span className="empty-mark">↳</span><h3>O próximo passo é desenvolver.</h3><p>Gere a trilha para transformar as lacunas em propostas de ação.</p><button className="text-button" onClick={() => void generate('analise')}>Conferir diagnóstico sem gerar a trilha</button></div>}
      {result && <><div className="result-heading"><span className="badge review">Proposta · revisão pendente</span><span className="helper">{result.metadados.tempo_segundos ? `Gerada em ${Math.round(result.metadados.tempo_segundos)} segundos` : 'Diagnóstico calculado'}</span></div>{result.plano?.recomendacoes.map(p => {
        const c = result.diagnostico.competencias.find(c => c.id === p.competencia_id);
        const a = result.diagnostico.catalogo.find(a => a.id === p.acao_id);
        return <article className="recommendation" key={p.competencia_id}><div className="recommendation-top"><span className={`badge ${c?.prioridade === 'Alta' ? 'high' : 'medium'}`}>{value(c?.prioridade)}</span><span className="helper">{p.decisao === 'recomendada' ? 'Ação do catálogo' : 'Decisão pendente'}</span></div><h2>{value(c?.competencia)}</h2><h3>{a ? value(a.acao) : p.decisao === 'sem_acao_adequada' ? 'Nenhuma ação adequada disponível' : 'Informações insuficientes'}</h3><p className="justification">{p.justificativa}</p>{a && <div className="action-facts"><div><small>RECURSO</small><strong>{value(a.recurso)}</strong></div><div><small>RESPONSÁVEL SUGERIDO</small><strong>{p.responsavel_sugerido}</strong></div><div><small>PRAZO SUGERIDO</small><strong>{p.prazo_dias_sugerido} dias</strong></div><div><small>CUSTO NO CATÁLOGO</small><strong>{value(a.custo)}</strong></div></div>}{p.criterio_conclusao && <div className="criterion"><span>COMO OBSERVAR A CONCLUSÃO</span><p>{p.criterio_conclusao}</p></div>}<details><summary>Orientação ao gestor e evidências</summary><p>{p.orientacao_ao_gestor}</p><p className="helper">Tarefa: {value(c?.tarefa)} · Fonte: {value(c?.fonte)} · Referências: PBL4, RF09, RF10, RNF08 e UC6.</p></details></article>;
      })}{result.plano?.recomendacoes.length === 0 && <div className="alert info">Não há lacunas positivas nesta rodada. Revise as salvaguardas e acompanhe o trabalho.</div>}<div className="recorded"><h3>Orientações registradas na planilha</h3>{input.salvaguardas.filter(s => value(s.ajuste).trim() || s.ancora === 'Diretriz de uso crítico').map(s => <p key={value(s.ancora)}><strong>{value(s.ancora)}:</strong> {value(s.ajuste) || value(s.observacao)}</p>)}<p className="helper">Estas orientações vêm das respostas, independentemente do texto gerado. Validação bilateral ainda não verificada.</p></div><div className="downloads"><a className="button secondary" href={`/api/jobs/${job?.id}/download?type=${result.plano ? 'excel' : 'input'}`}>Baixar planilha</a><a className="button secondary" href={`/api/jobs/${job?.id}/download?type=report`}>Baixar relatório</a><a className="text-button" href={`/api/jobs/${job?.id}/download?type=json`}>Registro completo (JSON)</a>{result.plano && <a className="text-button" href={`/api/jobs/${job?.id}/download?type=evaluation`}>Ficha de avaliação</a>}</div></>}
      <div className="catalog"><button className="catalog-toggle" onClick={() => setCatalogOpen(!catalogOpen)} aria-expanded={catalogOpen}><span>Catálogo de ações disponíveis <b>{input.catalogo.length}</b></span><span>{catalogOpen ? '−' : '+'}</span></button>{catalogOpen && <div className="catalog-items">{input.catalogo.map((a, i) => <div key={i}><span className="eyebrow">{value(a.eixo)}</span><p>{value(a.acao)}</p><small>{value(a.recurso)} · {value(a.custo)}</small></div>)}</div>}</div></>}
      <footer className="workspace-footer"><span>{step < 3 ? (saved ? 'Rascunho salvo na sua sessão.' : 'Salvando rascunho…') : 'Prazos e critérios precisam de revisão. R$ 0 não inclui o tempo de trabalho.'}</span>{step < 3 && <button className="button primary" onClick={() => setStep(step + 1)}>Continuar</button>}</footer>
    </>}
    </section><aside className="summary-panel"><p className="eyebrow">VISÃO DA RODADA</p><h2>{value(input?.tarefas[0]?.funcao) || 'Sua função'}</h2><div className="summary-stats"><div><strong>{input?.tarefas.length || '—'}</strong><span>tarefas</span></div><div><strong>{prioritized.length}</strong><span>lacunas</span></div></div><div className="summary-divider"/><h3>Prioridades em desenvolvimento</h3>{prioritized.length ? prioritized.map(c => <div className="mini-gap" key={c.id}><div><span>{value(c.competencia)}</span><small>N{value(c.atual)[1]} → N{value(c.alvo)[1]}</small></div><span className={`mini-score ${c.priority === 'Alta' ? 'high' : ''}`}>{c.score}</span></div>) : <p className="helper">Nenhuma lacuna positiva.</p>}<div className="summary-divider"/><div className={`safeguard-status ${pending ? 'pending' : ''}`}><strong>{pending ? `${pending} ajuste${pending > 1 ? 's' : ''} sem registro` : 'Ajustes registrados'}</strong><p>{pending ? 'Complete as respostas na etapa Salvaguardas.' : 'A implementação e a validação com o ocupante continuam pendentes.'}</p></div><p className="summary-footnote">A IA apoia a elaboração. O gestor decide e acompanha o desenvolvimento.</p></aside></main>
  </>;
}
