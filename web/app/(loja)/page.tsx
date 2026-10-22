import Link from 'next/link';
import { db } from '@/lib/db';
import { listarFuncoes } from '@/lib/funcoes';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function PainelLoja() {
  const gestor = await exigirPaginaGestor();
  const funcoes = listarFuncoes(db(), gestor.empresaId);
  return (
    <main className="page">
      <div className="page-heading">
        <div><p className="eyebrow">PAINEL DA LOJA</p><h1>Funções da loja</h1><p>Cada função reúne as tarefas, as competências e a salvaguarda. Depois, avalie cada pessoa que ocupa a função.</p></div>
        <div className="row-actions">
          <Link className="button secondary" href="/ferramentas">Ferramentas de IA</Link>
          <Link className="button secondary" href="/acoes">Ações da loja</Link>
          <Link className="button primary" href="/funcoes/nova">+ Nova função</Link>
        </div>
      </div>
      {funcoes.length ? (
        <div className="cards">{funcoes.map(f => (
          <Link key={f.id} className="card" href={`/funcoes/${f.id}`}>
            <h2>{f.nome}</h2>
            <p className="helper">{f.tarefas} tarefa(s) · {f.competencias} competência(s) · salvaguarda {f.salvaguardasRespondidas}/6</p>
            <p className="helper">{f.ocupantes} ocupante(s) · {f.trilhas} trilha(s)</p>
            {f.pendencias > 0 ? <span className="badge review">{f.pendencias} pendência(s)</span> : <span className="badge medium">Estrutura completa</span>}
          </Link>
        ))}</div>
      ) : (
        <div className="empty-state"><span className="empty-mark">↳</span><h3>Nenhuma função cadastrada.</h3><p>Comece pela função em que a IA mais mudou o trabalho.</p></div>
      )}
    </main>
  );
}
