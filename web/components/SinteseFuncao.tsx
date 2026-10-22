import { ROTULOS_NIVEL, type Estrutura, type Niveis } from '@/lib/estrutura';
import { calcularLacunas } from '@/lib/lacunas';
import { SALVAGUARDAS } from '@/lib/seed';

const EFEITO: Record<string, string> = { A: 'A IA faz por ele', P: 'A IA ajuda', I: 'Não mudou', N: 'Nova por causa da IA' };
type OcupanteSintese = { id: string; apelido: string; niveis: Niveis; arquivado: boolean; ultimaTrilha: string | null };
type Props = { funcao: { nome: string; estrutura: Estrutura; arquivada: boolean }; ocupantes: OcupanteSintese[] };

export default function SinteseFuncao({ funcao, ocupantes }: Props) {
  const e = funcao.estrutura;
  const tarefa = (id: string) => e.tarefas.find(t => t.id === id)?.tarefa ?? '—';
  return (
    <div className="sintese">
      <div className="page-heading"><div><p className="eyebrow">SÍNTESE DA FUNÇÃO (RF12)</p><h1>{funcao.nome}</h1><p>Mapa de efeitos, competências, salvaguarda e trilhas, em uma página para conversar com a equipe.</p></div>{funcao.arquivada && <span className="badge none">Arquivada</span>}</div>
      <div className="priority-table"><div className="section-title"><h2>Tarefas e efeito da IA</h2></div><div className="table-scroll"><table>
        <thead><tr><th>Tarefa</th><th>Frequência</th><th>Criticidade</th><th>Ferramenta</th><th>Efeito</th></tr></thead>
        <tbody>{e.tarefas.map(t => <tr key={t.id}><td>{t.tarefa}</td><td>{t.frequencia}</td><td>{t.criticidade}</td><td>{t.ferramenta || '—'}</td><td>{t.efeito_ia ? EFEITO[t.efeito_ia] : 'Não classificada'}</td></tr>)}</tbody>
      </table></div></div>
      <div className="priority-table"><div className="section-title"><h2>Competências exigidas</h2></div><div className="table-scroll"><table>
        <thead><tr><th>Competência</th><th>Eixo</th><th>Tarefa</th><th>Nível-alvo</th></tr></thead>
        <tbody>{e.competencias.map(c => <tr key={c.id}><td>{c.competencia}</td><td>{c.eixo}</td><td>{tarefa(c.tarefa_id)}</td><td>{ROTULOS_NIVEL[c.alvo]}</td></tr>)}</tbody>
      </table></div></div>
      {e.perdem_centralidade.length > 0 && <div className="panel"><h2>Deixam de ser centrais</h2>{e.perdem_centralidade.map(p => <p key={p.id}>{p.descricao} <span className="helper">({tarefa(p.tarefa_id)})</span></p>)}</div>}
      <div className="priority-table"><div className="section-title"><h2>Salvaguarda</h2></div><div className="table-scroll"><table>
        <thead><tr><th>Âncora</th><th>Resposta</th><th>Observação</th><th>Ajuste</th></tr></thead>
        <tbody>{SALVAGUARDAS.map(a => { const s = e.salvaguardas[a.numero - 1]; return <tr key={a.numero}><td>{a.ancora}</td><td>{s.resposta}</td><td>{s.observacao || '—'}</td><td>{s.ajuste || '—'}</td></tr>; })}</tbody>
      </table></div></div>
      {ocupantes.map(o => (
        <div className="priority-table" key={o.id}>
          <div className="section-title"><h2>{o.apelido}{o.arquivado ? ' (arquivado)' : ''}</h2>
            {o.ultimaTrilha ? <span className="row-actions"><a className="text-button" href={`/api/execucoes/${o.ultimaTrilha}/download?type=report`}>Última trilha (PDF)</a><a className="text-button" href={`/api/execucoes/${o.ultimaTrilha}/download?type=json`}>JSON</a></span> : <span className="helper">Sem trilha concluída</span>}
          </div>
          <div className="table-scroll"><table>
            <thead><tr><th>Competência</th><th>Níveis</th><th>Lacuna</th><th>Prioridade</th></tr></thead>
            <tbody>{calcularLacunas(e, o.niveis).map(l => <tr key={l.competenciaId}><td>{l.competencia}</td><td>{l.atual ?? '—'} → {l.alvo}</td><td>{l.lacuna ?? '—'}</td><td>{l.prioridade}</td></tr>)}</tbody>
          </table></div>
        </div>
      ))}
    </div>
  );
}
