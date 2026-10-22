import { db } from '@/lib/db';
import { listarEmpresas } from '@/lib/empresas';
import { calcularMetrica, COLUNAS } from '@/lib/metricas';
import { coletarMetricas, leitorDeAnalises, resumoDeExtracoes } from '@/lib/metricas-dados';
import { exigirPagina } from '@/lib/sessao-web';

export default async function Metricas({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  await exigirPagina({ papel: 'admin' });
  const { empresa } = await searchParams;
  const linhas = coletarMetricas(db(), leitorDeAnalises, empresa || undefined).map(calcularMetrica);
  const extracoes = resumoDeExtracoes(db(), leitorDeAnalises);
  return (
    <main className="page">
      <div className="page-heading"><div><p className="eyebrow">PESQUISA</p><h1>Métricas por função</h1><p>Indicadores do Quadro 7 do PBL3 calculados a partir do uso do site. Tempo = tempo ativo de preenchimento (aba visível e com interação).</p></div>
        <a className="button primary" href={`/api/admin/metricas${empresa ? `?empresa=${empresa}` : ''}`}>Baixar CSV</a></div>
      <form className="role-strip" method="get">
        <label className="field"><span>Empresa</span><select name="empresa" defaultValue={empresa ?? ''}><option value="">Todas</option>{listarEmpresas(db()).map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
        <button className="button secondary">Filtrar</button>
      </form>
      <div className="priority-table"><div className="table-scroll"><table className="tabela-larga">
        <thead><tr>{COLUNAS.map(c => <th key={c.chave}>{c.titulo}</th>)}</tr></thead>
        <tbody>{linhas.map((l, i) => <tr key={i}>{COLUNAS.map(c => <td key={c.chave}>{l[c.chave] ?? '—'}</td>)}</tr>)}</tbody>
      </table></div></div>
      {linhas.length === 0 && <p className="helper">Nenhuma função cadastrada ainda.</p>}
      <div className="priority-table"><div className="section-title"><h2>Uso da descrição com IA</h2></div><div className="table-scroll"><table>
        <thead><tr><th>Empresa</th><th>Pedidas</th><th>Concluídas</th><th>Tempo médio (s)</th><th>Funções criadas pela IA</th></tr></thead>
        <tbody>{extracoes.map(x => <tr key={x.empresa}><td>{x.empresa}</td><td>{x.pedidas}</td><td>{x.concluidas}</td><td>{x.tempoMedioS ?? '—'}</td><td>{x.funcoesPorIA}</td></tr>)}</tbody>
      </table></div></div>
      <div className="alert info"><strong>Indicadores que dependem do campo</strong><p>Descoberta de impacto, convergência gestor × ocupante, autonomia de preenchimento e ação iniciada em 30 dias não são calculados pelo site: registre-os nos instrumentos de campo.</p></div>
    </main>
  );
}
