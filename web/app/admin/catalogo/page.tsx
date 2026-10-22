import GerenciarAcoes from '@/components/acoes/GerenciarAcoes';
import { listarAcoes } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { exigirPagina } from '@/lib/sessao-web';

export default async function CatalogoGlobal() {
  await exigirPagina({ papel: 'admin' });
  return (
    <main className="page">
      <div className="page-heading"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Catálogo da pesquisa</h1><p>Ações oferecidas a todas as lojas. Desative em vez de apagar: as trilhas antigas continuam citando a ação.</p></div></div>
      <GerenciarAcoes iniciais={listarAcoes(db(), null)} titulo="Catálogo global" />
    </main>
  );
}
