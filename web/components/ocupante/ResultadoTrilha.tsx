type Linha = Record<string, string | number | null>;
type Proposta = {
  competencia_id: string; decisao: string; acao_id: string | null; justificativa: string; responsavel_sugerido: string | null;
  prazo_dias_sugerido: number | null; criterio_conclusao: string | null; orientacao_ao_gestor: string;
};
export type ResultadoAnalise = {
  diagnostico: { competencias: Linha[]; catalogo: Linha[]; salvaguardas: Linha[] };
  plano: { resumo: string; recomendacoes: Proposta[] } | null;
  metadados: { tempo_segundos?: number };
};

const valor = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export default function ResultadoTrilha({ resultado, execucaoId }: { resultado: ResultadoAnalise; execucaoId: string }) {
  const { diagnostico, plano, metadados } = resultado;
  const base = `/api/execucoes/${execucaoId}/download?type=`;
  return (
    <>
      <div className="result-heading">
        <span className="badge review">Proposta · revisão pendente</span>
        <span className="helper">{metadados.tempo_segundos ? `Gerada em ${Math.round(metadados.tempo_segundos)} segundos` : 'Diagnóstico calculado'}</span>
      </div>
      {plano?.recomendacoes.map(p => {
        const c = diagnostico.competencias.find(x => x.id === p.competencia_id);
        const a = diagnostico.catalogo.find(x => x.id === p.acao_id);
        return (
          <article className="recommendation" key={p.competencia_id}>
            <div className="recommendation-top"><span className={`badge ${c?.prioridade === 'Alta' ? 'high' : 'medium'}`}>{valor(c?.prioridade)}</span><span className="helper">{p.decisao === 'recomendada' ? 'Ação do catálogo' : 'Decisão pendente'}</span></div>
            <h2>{valor(c?.competencia)}</h2>
            <h3>{a ? valor(a.acao) : p.decisao === 'sem_acao_adequada' ? 'Nenhuma ação adequada disponível' : 'Informações insuficientes'}</h3>
            <p className="justification">{p.justificativa}</p>
            {a && (
              <div className="action-facts">
                <div><small>RECURSO</small><strong>{valor(a.recurso)}</strong></div>
                <div><small>RESPONSÁVEL SUGERIDO</small><strong>{p.responsavel_sugerido}</strong></div>
                <div><small>PRAZO SUGERIDO</small><strong>{p.prazo_dias_sugerido} dias</strong></div>
                <div><small>CUSTO NO CATÁLOGO</small><strong>{valor(a.custo)}</strong></div>
              </div>
            )}
            {p.criterio_conclusao && <div className="criterion"><span>COMO OBSERVAR A CONCLUSÃO</span><p>{p.criterio_conclusao}</p></div>}
            <details><summary>Orientação ao gestor e evidências</summary><p>{p.orientacao_ao_gestor}</p><p className="helper">Tarefa: {valor(c?.tarefa)} · Referências: PBL4, RF09, RF10, RNF08 e UC6.</p></details>
          </article>
        );
      })}
      {plano?.recomendacoes.length === 0 && <div className="alert info">Não há lacunas positivas nesta rodada. Revise as salvaguardas e acompanhe o trabalho.</div>}
      <div className="recorded">
        <h3>Orientações registradas na salvaguarda</h3>
        {diagnostico.salvaguardas.filter(s => valor(s.ajuste).trim() || s.ancora === 'Diretriz de uso crítico').map(s => (
          <p key={valor(s.ancora)}><strong>{valor(s.ancora)}:</strong> {valor(s.ajuste) || valor(s.observacao)}</p>
        ))}
        <p className="helper">Estas orientações vêm das respostas, independentemente do texto gerado. Validação bilateral ainda não verificada.</p>
      </div>
      <div className="downloads">
        <a className="button secondary" href={`${base}${plano ? 'excel' : 'input'}`}>Baixar planilha</a>
        <a className="button secondary" href={`${base}report`}>Baixar relatório (PDF)</a>
        <a className="text-button" href={`${base}json`}>Registro completo (JSON)</a>
        {plano && <a className="text-button" href={`${base}evaluation`}>Ficha de avaliação</a>}
      </div>
    </>
  );
}
