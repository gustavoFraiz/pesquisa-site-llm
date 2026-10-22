import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { listarEmpresas } from '@/lib/empresas';
import { coletarMetricas, leitorDeAnalises } from '@/lib/metricas-dados';
import { calcularMetrica } from '@/lib/metricas';
import { exigirPagina } from '@/lib/sessao-web';

export default async function EmpresaAdmin({ params }: { params: Promise<{ id: string }> }) {
  await exigirPagina({ papel: 'admin' });
  const { id } = await params;
  const empresa = listarEmpresas(db()).find(e => e.id === id);
  if (!empresa) notFound();
  const funcoes = db().prepare('SELECT id, nome, arquivada FROM funcoes WHERE empresa_id = ? ORDER BY criada_em').all(id) as { id: string; nome: string; arquivada: number }[];
  const metricas = coletarMetricas(db(), leitorDeAnalises, id).map(calcularMetrica);
  return (
    <main className="page">
      <a className="text-button" href="/admin">← Empresas</a>
      <div className="page-heading"><div><p className="eyebrow">EMPRESA · SOMENTE LEITURA</p><h1>{empresa.nome}</h1><p>{[empresa.segmento, empresa.cidade].filter(Boolean).join(' · ')} · gestor {empresa.emailGestor ?? '—'}</p></div><a className="button secondary" href={`/api/admin/metricas?empresa=${id}`}>Baixar CSV</a></div>
      <div className="cards">{funcoes.map((f, i) => (
        <a key={f.id} className="card" href={`/admin/empresas/${id}/funcoes/${f.id}`}>
          <h2>{f.nome}</h2>
          {Number(f.arquivada) === 1 && <span className="badge none">Arquivada</span>}
          <p className="helper">Tempo total: {metricas[i]?.tempoTotalMin ?? '—'} min · tarefas com efeito {metricas[i]?.coberturaEfeitoPct ?? '—'}% · trilhas {metricas[i]?.trilhas ?? 0}</p>
        </a>
      ))}</div>
      {funcoes.length === 0 && <p className="helper">Esta empresa ainda não cadastrou funções.</p>}
    </main>
  );
}
