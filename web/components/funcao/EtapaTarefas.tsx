'use client';
import BotoesOpcao from '@/components/BotoesOpcao';
import { Campo } from '@/components/Campo';
import { CRITICIDADES, EFEITOS, FREQUENCIAS, LIMITES, efeitoAutomatico, novaTarefa, type Estrutura, type Tarefa } from '@/lib/estrutura';

const ROTULO_EFEITO: Record<string, string> = { A: 'A IA faz por ele (A)', P: 'A IA ajuda (P)', I: 'Não mudou (I)', N: 'Nova por causa da IA (N)' };
const EFEITOS_SIMPLES = EFEITOS.map(e => ({ valor: e, rotulo: ROTULO_EFEITO[e] }));

type Props = { estrutura: Estrutura; aoMudar: (e: Estrutura) => void; ferramentas: string[]; aoAdicionarFerramenta?: (nome: string) => Promise<void> };

export default function EtapaTarefas({ estrutura, aoMudar, ferramentas, aoAdicionarFerramenta }: Props) {
  const conhecidas = new Set(ferramentas.map(f => f.toLocaleLowerCase('pt-BR')));
  const alterar = (id: string, campos: Partial<Tarefa>) =>
    aoMudar({ ...estrutura, tarefas: estrutura.tarefas.map(t => (t.id === id ? { ...t, ...campos, editada: true } : t)) });
  const aoSairDaFerramenta = (t: Tarefa) => {
    const ajustada = efeitoAutomatico(t);
    if (ajustada !== t) alterar(t.id, { efeito_ia: ajustada.efeito_ia });
  };
  // Competências da tarefa removida ficam "sem tarefa" e aparecem como pendência.
  const remover = (id: string) => aoMudar({
    ...estrutura,
    tarefas: estrutura.tarefas.filter(t => t.id !== id),
    competencias: estrutura.competencias.map(c => (c.tarefa_id === id ? { ...c, tarefa_id: '' } : c)),
    perdem_centralidade: estrutura.perdem_centralidade.filter(p => p.tarefa_id !== id),
  });
  return (
    <>
      <div className="section-title">
        <h2>Mapa de tarefas <span>{estrutura.tarefas.length}</span></h2>
        <button className="button secondary small" disabled={estrutura.tarefas.length >= LIMITES.tarefas} onClick={() => aoMudar({ ...estrutura, tarefas: [...estrutura.tarefas, novaTarefa()] })}>+ Adicionar tarefa</button>
      </div>
      <datalist id="ferramentas-loja">{ferramentas.map(f => <option key={f} value={f} />)}</datalist>
      {estrutura.tarefas.map((t, i) => {
        const nova = t.ferramenta.trim() && !conhecidas.has(t.ferramenta.trim().toLocaleLowerCase('pt-BR'));
        return (
          <article className="entry" key={t.id}>
            <div className="entry-number">{String(i + 1).padStart(2, '0')}</div>
            <div className="entry-fields">
              <Campo rotulo="Tarefa" largo><input value={t.tarefa} maxLength={LIMITES.texto} onChange={e => alterar(t.id, { tarefa: e.target.value })} placeholder="Descreva uma atividade, começando por um verbo" /></Campo>
              <BotoesOpcao rotulo="Frequência" valor={t.frequencia} opcoes={FREQUENCIAS} aoMudar={v => alterar(t.id, { frequencia: v as Tarefa['frequencia'] })} />
              <BotoesOpcao rotulo="Criticidade" valor={t.criticidade} opcoes={CRITICIDADES} aoMudar={v => alterar(t.id, { criticidade: v as Tarefa['criticidade'] })} />
              <Campo rotulo="Ferramenta de IA" largo>
                <input list="ferramentas-loja" value={t.ferramenta} maxLength={LIMITES.ferramenta} onChange={e => alterar(t.id, { ferramenta: e.target.value })} onBlur={() => aoSairDaFerramenta(t)} placeholder="Deixe em branco se a IA não participa" />
              </Campo>
              {nova && aoAdicionarFerramenta && <button type="button" className="text-button inline-action wide" onClick={() => void aoAdicionarFerramenta(t.ferramenta.trim())}>+ Adicionar "{t.ferramenta.trim()}" à lista da loja</button>}
              <div className="wide"><BotoesOpcao rotulo="Efeito da IA" valor={t.efeito_ia ?? ''} opcoes={EFEITOS_SIMPLES} aoMudar={v => alterar(t.id, { efeito_ia: v as Tarefa['efeito_ia'] })} /></div>
            </div>
            <button className="remove" disabled={estrutura.tarefas.length <= 1} onClick={() => remover(t.id)} aria-label={`Remover tarefa ${i + 1}`}>×</button>
          </article>
        );
      })}
      <p className="helper">Efeito da IA: escolha o que mudou na tarefa por causa da ferramenta. Sem ferramenta, marcamos "Não mudou" para você.</p>
    </>
  );
}
