'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { chamarApi } from '@/components/api';
import BotoesOpcao from '@/components/BotoesOpcao';
import { Campo } from '@/components/Campo';

type Sugerida = { tarefa: string; frequencia: string; criticidade: string; ferramenta: string; efeito: string; marcada: boolean };
type Execucao = { id: string; status: 'aguardando' | 'executando' | 'concluida' | 'erro'; posicao: number | null; error?: string; result: { tarefas: Omit<Sugerida, 'marcada'>[] } | null };
const EFEITOS = [{ valor: 'A', rotulo: 'A IA faz por ele (A)' }, { valor: 'P', rotulo: 'A IA ajuda (P)' }, { valor: 'I', rotulo: 'Não mudou (I)' }, { valor: 'N', rotulo: 'Nova por causa da IA (N)' }];
const FALHA = 'Não consegui entender a descrição. Tente um modelo pronto ou comece em branco.';

export default function DescreverComIA({ extracaoInicial }: { extracaoInicial?: string }) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [execucao, setExecucao] = useState<Execucao | null>(extracaoInicial ? { id: extracaoInicial, status: 'aguardando', posicao: null, result: null } : null);
  const [sugeridas, setSugeridas] = useState<Sugerida[]>([]);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(true);
  const [segundos, setSegundos] = useState(0);
  const emAndamento = execucao?.status === 'aguardando' || execucao?.status === 'executando';

  useEffect(() => { chamarApi<{ modelReady?: boolean }>('/api/health').then(d => setPronto(Boolean(d.modelReady))).catch(() => setPronto(false)); }, []);
  useEffect(() => {
    if (!emAndamento || !execucao) return;
    setSegundos(0);
    const relogio = setInterval(() => setSegundos(s => s + 1), 1000);
    const consultar = async () => {
      try {
        const dados = await chamarApi<Execucao>(`/api/execucoes/${execucao.id}`);
        setExecucao(dados);
        if (dados.status === 'concluida' && dados.result) setSugeridas(dados.result.tarefas.map(t => ({ ...t, marcada: true })));
        if (dados.status === 'erro') setErro(dados.error?.includes('Não consegui') ? FALHA : `${FALHA} (${dados.error ?? 'erro desconhecido'})`);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao consultar a extração.');
        setExecucao(null);
      }
    };
    void consultar();
    const timer = setInterval(() => void consultar(), 4000);
    return () => { clearInterval(timer); clearInterval(relogio); };
  }, [emAndamento, execucao?.id]);

  const pedir = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      const dados = await chamarApi<Execucao>('/api/extracoes', { method: 'POST', json: { nome, descricao } });
      setExecucao({ ...dados, result: null });
      router.replace(`/funcoes/nova?extracao=${dados.id}`);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível iniciar.');
    }
  };
  const alterar = (i: number, campos: Partial<Sugerida>) => setSugeridas(lista => lista.map((t, j) => (j === i ? { ...t, ...campos } : t)));
  const marcadas = sugeridas.filter(t => t.marcada && t.tarefa.trim());
  const criar = async () => {
    setErro('');
    try {
      const { id } = await chamarApi<{ id: string }>('/api/funcoes', { method: 'POST', json: { nome: nome || 'Função descrita com IA', tarefasSugeridas: marcadas.map(({ marcada: _m, ...t }) => t) } });
      router.push(`/funcoes/${id}?etapa=competencias`);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível criar a função.');
    }
  };

  if (sugeridas.length) {
    return (
      <section className="panel">
        <h2>Revise as tarefas sugeridas</h2>
        <p className="helper">A IA pode errar. Desmarque o que não faz parte da função e ajuste o resto. As competências vêm depois, sugeridas a partir destas tarefas.</p>
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <Campo rotulo="Nome da função"><input value={nome} maxLength={120} onChange={e => setNome(e.target.value)} placeholder="Ex.: Atendente de balcão" /></Campo>
        {sugeridas.map((t, i) => (
          <article className={`entry ${t.marcada ? '' : 'desmarcada'}`} key={i}>
            <input type="checkbox" checked={t.marcada} onChange={e => alterar(i, { marcada: e.target.checked })} aria-label={`Usar a tarefa ${i + 1}`} />
            <div className="entry-fields">
              <Campo rotulo="Tarefa" largo><input value={t.tarefa} maxLength={300} onChange={e => alterar(i, { tarefa: e.target.value })} /></Campo>
              <BotoesOpcao rotulo="Frequência" valor={t.frequencia} opcoes={['Diária', 'Semanal', 'Eventual']} aoMudar={v => alterar(i, { frequencia: v })} />
              <BotoesOpcao rotulo="Criticidade" valor={t.criticidade} opcoes={['Alta', 'Média', 'Baixa']} aoMudar={v => alterar(i, { criticidade: v })} />
              <Campo rotulo="Ferramenta de IA" largo><input value={t.ferramenta} maxLength={200} onChange={e => alterar(i, { ferramenta: e.target.value })} /></Campo>
              <div className="wide"><BotoesOpcao rotulo="Efeito da IA" valor={t.efeito} opcoes={EFEITOS} aoMudar={v => alterar(i, { efeito: v })} /></div>
            </div>
          </article>
        ))}
        <div className="row-actions">
          <button className="button primary" disabled={!marcadas.length || !nome.trim()} onClick={() => void criar()}>Criar função com {marcadas.length} tarefa(s)</button>
          <button className="text-button" onClick={() => { setSugeridas([]); setExecucao(null); router.replace('/funcoes/nova'); }}>Descrever de novo</button>
        </div>
      </section>
    );
  }

  return (
    <form className="panel" onSubmit={pedir}>
      <h2>Descrever com minhas palavras (IA)</h2>
      <p className="helper">Conte o que a pessoa faz no dia a dia e onde a IA entra. A IA da própria VM sugere as tarefas; você revisa antes de usar. Evite nomes de pessoas.</p>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <Campo rotulo="Nome da função"><input required maxLength={120} value={nome} disabled={emAndamento} onChange={e => setNome(e.target.value)} placeholder="Ex.: Atendente de balcão" /></Campo>
      <Campo rotulo={`Descrição (${descricao.trim().length}/2000, mínimo 40)`}>
        <textarea required minLength={40} maxLength={2000} value={descricao} disabled={emAndamento} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: O atendente consulta preço e estoque no assistente da loja, monta orçamentos com ajuda da IA e negocia prazo quando o cliente reclama." />
      </Campo>
      {emAndamento ? (
        <div className="processing" role="status"><span className="spinner" /><div>
          <strong>{execucao?.status === 'aguardando' && (execucao.posicao ?? 0) > 0 ? `Na fila · posição ${execucao.posicao}` : 'Lendo a descrição'}</strong>
          <p>Leva de 1 a 2 minutos nesta máquina. Pode deixar a página aberta ou voltar depois por este mesmo endereço.</p>
          <span className="helper">Tempo: {Math.floor(segundos / 60)} min {segundos % 60} s</span>
        </div></div>
      ) : (
        <div><button className="button primary" disabled={!pronto || descricao.trim().length < 40}>Sugerir tarefas</button>{!pronto && <p className="helper">A IA está indisponível no momento. Use um modelo pronto ou comece em branco.</p>}</div>
      )}
    </form>
  );
}
