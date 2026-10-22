'use client';
import { useMemo, useState } from 'react';
import { Campo, Selecao } from '@/components/Campo';
import { EIXOS, LIMITES, NIVEIS, ROTULOS_NIVEL, novaCompetencia, novoId, type Competencia, type Estrutura } from '@/lib/estrutura';
import { aceitarSugestoes, ignorarSugestao, sugerir } from '@/lib/regras';

export default function EtapaCompetencias({ estrutura, aoMudar }: { estrutura: Estrutura; aoMudar: (e: Estrutura) => void }) {
  const [aviso, setAviso] = useState('');
  const sugestoes = useMemo(() => sugerir(estrutura), [estrutura]);
  const alterar = (id: string, campos: Partial<Competencia>) =>
    aoMudar({ ...estrutura, competencias: estrutura.competencias.map(c => (c.id === id ? { ...c, ...campos, editada: true } : c)) });
  const aceitar = (chaves: string[]) => {
    const { estrutura: nova, recusadas } = aceitarSugestoes(estrutura, chaves);
    setAviso(recusadas.length ? `Limite de ${LIMITES.competencias} competências atingido. Ficaram de fora: ${recusadas.join(', ')}.` : '');
    aoMudar(nova);
  };
  const tarefas = estrutura.tarefas.map((t, i) => ({ valor: t.id, rotulo: t.tarefa.trim() || `Tarefa ${i + 1} (sem descrição)` }));
  const textoTarefa = (id: string) => tarefas.find(t => t.valor === id)?.rotulo ?? 'tarefa removida';
  const niveis = NIVEIS.map(n => ({ valor: n, rotulo: ROTULOS_NIVEL[n] }));
  const [perdaManual, setPerdaManual] = useState({ descricao: '', tarefa_id: '' });

  return (
    <>
      {sugestoes.competencias.length > 0 && (
        <section className="suggestions" aria-label="Competências sugeridas">
          <div className="section-title">
            <h2>Sugeridas a partir das tarefas <span>{sugestoes.competencias.length}</span></h2>
            <button className="button primary small" onClick={() => aceitar(sugestoes.competencias.map(s => s.chave))}>Aceitar todas</button>
          </div>
          {sugestoes.competencias.map(s => (
            <div className="suggestion" key={s.chave}>
              <div>
                <strong>{s.competencia.competencia}</strong>
                <p className="helper">{s.competencia.eixo} · nível-alvo {ROTULOS_NIVEL[s.competencia.alvo]} · tarefa: {textoTarefa(s.competencia.tarefa_id)}</p>
                <p className="helper">Por quê: {s.competencia.motivo}</p>
              </div>
              <div className="row-actions">
                <button className="button secondary small" onClick={() => aceitar([s.chave])}>Aceitar</button>
                <button className="text-button" onClick={() => aoMudar(ignorarSugestao(estrutura, s.chave))}>Ignorar</button>
              </div>
            </div>
          ))}
        </section>
      )}
      {aviso && <div className="alert info" role="status">{aviso}</div>}

      <div className="section-title">
        <h2>Perfil de competências <span>{estrutura.competencias.length}</span></h2>
        <button className="button secondary small" disabled={estrutura.competencias.length >= LIMITES.competencias}
          onClick={() => aoMudar({ ...estrutura, competencias: [...estrutura.competencias, novaCompetencia(estrutura.tarefas[0]?.id ?? '')] })}>+ Adicionar competência</button>
      </div>
      {estrutura.competencias.length === 0 && <p className="helper">Nenhuma competência ainda. Aceite as sugestões acima ou adicione uma.</p>}
      {estrutura.competencias.map((c, i) => (
        <article className="entry" key={c.id}>
          <div className="entry-number">{String(i + 1).padStart(2, '0')}</div>
          <div className="entry-fields">
            <Campo rotulo="Competência" largo><input value={c.competencia} maxLength={LIMITES.texto} onChange={e => alterar(c.id, { competencia: e.target.value })} placeholder="Ex.: Revisar o resultado da IA antes de enviar ao cliente" /></Campo>
            <Campo rotulo="Eixo"><Selecao valor={c.eixo} opcoes={EIXOS} aoMudar={v => alterar(c.id, { eixo: v as Competencia['eixo'] })} /></Campo>
            <Campo rotulo="Tarefa associada"><Selecao valor={c.tarefa_id} vazio="Escolha a tarefa" opcoes={tarefas} aoMudar={v => alterar(c.id, { tarefa_id: v })} /></Campo>
            <Campo rotulo="Nível-alvo da função"><Selecao valor={c.alvo} opcoes={niveis} aoMudar={v => alterar(c.id, { alvo: v as Competencia['alvo'] })} /></Campo>
            {c.motivo && c.origem === 'regra' && <p className="helper wide">Sugerida porque: {c.motivo}</p>}
          </div>
          <button className="remove" onClick={() => aoMudar({ ...estrutura, competencias: estrutura.competencias.filter(x => x.id !== c.id) })} aria-label={`Remover competência ${i + 1}`}>×</button>
        </article>
      ))}
      <p className="helper">O nível atual é registrado por ocupante, na última etapa. Aqui você define o nível que a função exige.</p>

      <section className="panel" aria-label="Competências que deixam de ser centrais">
        <h2>Deixam de ser centrais</h2>
        <p className="helper">O que a IA passou a fazer e a pessoa não precisa mais executar sozinha (RF07). Serve para conversar com a equipe sobre a mudança.</p>
        {estrutura.perdem_centralidade.map(p => (
          <div className="suggestion" key={p.id}>
            <div><strong>{p.descricao}</strong><p className="helper">Tarefa: {textoTarefa(p.tarefa_id)}</p></div>
            <button className="text-button danger" onClick={() => aoMudar({ ...estrutura, perdem_centralidade: estrutura.perdem_centralidade.filter(x => x.id !== p.id) })}>Remover</button>
          </div>
        ))}
        {sugestoes.perdem_centralidade.map(s => (
          <div className="suggestion sugerida" key={s.chave}>
            <div><strong>{s.perda.descricao}</strong><p className="helper">Sugestão: a IA passou a fazer esta tarefa.</p></div>
            <div className="row-actions">
              <button className="button secondary small" onClick={() => aceitar([s.chave])}>Aceitar</button>
              <button className="text-button" onClick={() => aoMudar(ignorarSugestao(estrutura, s.chave))}>Ignorar</button>
            </div>
          </div>
        ))}
        <form className="form-grid" onSubmit={e => {
          e.preventDefault();
          if (!perdaManual.descricao.trim() || !perdaManual.tarefa_id) return;
          aoMudar({ ...estrutura, perdem_centralidade: [...estrutura.perdem_centralidade, { id: novoId(), descricao: perdaManual.descricao.trim(), tarefa_id: perdaManual.tarefa_id, origem: 'manual' }] });
          setPerdaManual({ descricao: '', tarefa_id: '' });
        }}>
          <Campo rotulo="Outra competência que perde centralidade"><input value={perdaManual.descricao} maxLength={LIMITES.texto} onChange={e => setPerdaManual({ ...perdaManual, descricao: e.target.value })} placeholder="Ex.: Calcular o orçamento à mão" /></Campo>
          <Campo rotulo="Tarefa"><Selecao valor={perdaManual.tarefa_id} vazio="Escolha a tarefa" opcoes={tarefas} aoMudar={v => setPerdaManual({ ...perdaManual, tarefa_id: v })} /></Campo>
          <div className="wide"><button className="button secondary small" disabled={estrutura.perdem_centralidade.length >= LIMITES.tarefas}>Incluir</button></div>
        </form>
      </section>
    </>
  );
}
