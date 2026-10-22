'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';
import { useAutosave } from '@/components/useAutosave';
import { useTempoAtivo } from '@/components/useTempoAtivo';
import { pendenciasCompetencias, pendenciasEstrutura, pendenciasTarefas, type Estrutura } from '@/lib/estrutura';
import type { ResumoOcupante } from '@/lib/ocupantes';
import EtapaCompetencias from './EtapaCompetencias';
import EtapaOcupantes from './EtapaOcupantes';
import EtapaSalvaguarda from './EtapaSalvaguarda';
import EtapaTarefas from './EtapaTarefas';

const ETAPAS = [
  { nome: 'Tarefas', detalhe: 'Impacto da IA no trabalho', titulo: 'Entenda o trabalho.', texto: 'Registre as tarefas da função e como a IA participa de cada uma.', tag: 'M1 · Diagnóstico' },
  { nome: 'Competências', detalhe: 'O que a função exige', titulo: 'Defina as competências.', texto: 'Relacione cada competência a uma tarefa e escolha o nível que a função exige.', tag: 'M2 · Competências' },
  { nome: 'Salvaguarda', detalhe: 'Qualidade do trabalho', titulo: 'Preserve a qualidade.', texto: 'Confira as condições do trabalho com quem ocupa a função.', tag: 'Salvaguarda · UC7' },
  { nome: 'Ocupantes', detalhe: 'Níveis e trilhas', titulo: 'Avalie cada pessoa.', texto: 'Para cada ocupante, registre o nível atual e gere a trilha de desenvolvimento.', tag: 'M3 + M4 · Trilha' },
];

type Props = { funcao: { id: string; nome: string; estrutura: Estrutura; atualizadaEm: string }; ocupantes: ResumoOcupante[]; etapaInicial?: number; ferramentas: string[] };

export default function EditorFuncao({ funcao, ocupantes, etapaInicial = 0, ferramentas }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(funcao.nome);
  const [estrutura, setEstrutura] = useState(funcao.estrutura);
  const [etapa, setEtapa] = useState(etapaInicial);
  const [erroAcao, setErroAcao] = useState('');
  const [ferramentasLoja, setFerramentasLoja] = useState(ferramentas);
  const adicionarFerramenta = async (nome: string) => {
    try {
      const nova = await chamarApi<{ nome: string }>('/api/ferramentas', { method: 'POST', json: { nome } });
      setFerramentasLoja(lista => (lista.includes(nova.nome) ? lista : [...lista, nova.nome]));
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível adicionar a ferramenta.');
    }
  };
  const { estado, erro, salvarAgora } = useAutosave(`/api/funcoes/${funcao.id}`, { nome, estrutura }, funcao.atualizadaEm);
  // Voltar pelo navegador reaproveita dados antigos da página: pede a versão atual ao servidor.
  // Se ela mudou, a página do servidor troca a key e o editor remonta com os dados novos.
  useEffect(() => { router.refresh(); }, [router]);
  useTempoAtivo('funcao', funcao.id);
  const pendTarefas = useMemo(() => pendenciasTarefas(estrutura), [estrutura]);
  const pendCompetencias = useMemo(() => pendenciasCompetencias(estrutura), [estrutura]);
  const bloqueio = etapa === 0 ? pendTarefas : etapa === 1 ? pendCompetencias : [];
  const info = ETAPAS[etapa];

  const navegar = async (href: string) => {
    try {
      await salvarAgora();
      router.push(href);
    } catch {
      // O aviso de erro do salvamento já aparece na tela; não sai sem salvar.
    }
  };
  const irPara = (i: number) => { setEtapa(i); window.scrollTo({ top: 0 }); };
  const arquivar = async () => {
    if (!window.confirm(`Arquivar a função "${nome}"? Ela some do painel, mas as trilhas já geradas continuam registradas.`)) return;
    try {
      await chamarApi(`/api/funcoes/${funcao.id}`, { method: 'DELETE' });
      router.push('/');
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível arquivar.');
    }
  };

  return (
    <main className="shell sem-resumo">
      <aside className="sidebar">
        <p className="eyebrow">FUNÇÃO</p>
        <nav aria-label="Etapas da função">{ETAPAS.map((e, i) => (
          <button key={e.nome} className={`step ${etapa === i ? 'active' : ''}`} onClick={() => irPara(i)}>
            <span className="step-number">0{i + 1}</span><span>{e.nome}<small>{e.detalhe}</small></span>
          </button>
        ))}</nav>
        <div className="side-note">
          <button className="text-button" onClick={() => void navegar('/')}>← Voltar ao painel</button><br />
          <button className="text-button" style={{ marginTop: 14 }} onClick={() => void navegar(`/funcoes/${funcao.id}/sintese`)}>Ver síntese da função</button><br />
          <button className="text-button danger" style={{ marginTop: 14 }} onClick={() => void arquivar()}>Arquivar função</button>
        </div>
        <div className="side-footer">MRCC-PV · PBL4<br />Pesquisa aplicada / Pessoas e cultura</div>
      </aside>
      <section className="workspace">
        <div className="page-heading"><div><p className="eyebrow">PASSO 0{etapa + 1} / 04</p><h1>{info.titulo}</h1><p>{info.texto}</p></div><span className="stage-tag">{info.tag}</span></div>
        {(erro || erroAcao) && <div className="alert error" role="alert">{erroAcao || erro}</div>}
        <div className="role-strip">
          <Campo rotulo="Nome da função"><input value={nome} maxLength={120} onChange={e => setNome(e.target.value)} placeholder="Ex.: Atendente de balcão" /></Campo>
          <div className="role-caption">Descreva funções e tarefas.<br />Evite nomes e dados pessoais.</div>
        </div>
        {etapa === 0 && <EtapaTarefas estrutura={estrutura} aoMudar={setEstrutura} ferramentas={ferramentasLoja} aoAdicionarFerramenta={adicionarFerramenta} />}
        {etapa === 1 && <EtapaCompetencias estrutura={estrutura} aoMudar={setEstrutura} />}
        {etapa === 2 && <EtapaSalvaguarda estrutura={estrutura} aoMudar={setEstrutura} />}
        {etapa === 3 && <EtapaOcupantes funcaoId={funcao.id} ocupantes={ocupantes} pendencias={pendenciasEstrutura(estrutura)} totalCompetencias={estrutura.competencias.length} navegar={navegar} />}
        {bloqueio.length > 0 && <div className="alert info"><strong>Antes de continuar</strong>{bloqueio.map(p => <p key={p}>{p}</p>)}</div>}
        <footer className="workspace-footer">
          <span>{estado === 'salvo' ? 'Alterações salvas.' : estado === 'pendente' ? 'Salvando…' : 'Não foi possível salvar. Veja o aviso acima.'}</span>
          {etapa < 3 && <button className="button primary" disabled={bloqueio.length > 0} onClick={() => irPara(etapa + 1)}>Continuar</button>}
        </footer>
      </section>
    </main>
  );
}
