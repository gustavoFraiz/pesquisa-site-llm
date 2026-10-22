import GerenciarAcoes from '@/components/acoes/GerenciarAcoes';
import { listarAcoes } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function AcoesDaLoja() {
  const gestor = await exigirPaginaGestor();
  const globais = listarAcoes(db(), null).filter(a => a.ativa);
  return (
    <main className="page">
      <a className="text-button" href="/">← Painel da loja</a>
      <div className="page-heading"><div><p className="eyebrow">AÇÕES DA LOJA</p><h1>Ações de desenvolvimento</h1><p>Inclua ações que a sua loja já oferece, como um treinamento do fornecedor. A IA pode escolhê-las nas trilhas, junto com o catálogo da pesquisa.</p></div></div>
      <GerenciarAcoes iniciais={listarAcoes(db(), gestor.empresaId)} titulo="Ações da sua loja" />
      <div className="catalog"><div className="catalog-items">{globais.map(a => <div key={a.id}><span className="eyebrow">{a.eixo}</span><p>{a.acao}</p><small>{a.recurso} · {a.custo} · catálogo da pesquisa</small></div>)}</div></div>
    </main>
  );
}
