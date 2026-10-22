import GerenciarFerramentas from '@/components/loja/GerenciarFerramentas';
import { db } from '@/lib/db';
import { CATEGORIAS_FERRAMENTA, listarFerramentas } from '@/lib/ferramentas';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function Ferramentas() {
  const gestor = await exigirPaginaGestor();
  return (
    <main className="page narrow">
      <a className="text-button" href="/">← Painel da loja</a>
      <div className="page-heading"><div><p className="eyebrow">FERRAMENTAS DE IA</p><h1>Ferramentas da loja</h1><p>Cadastre uma vez as ferramentas de IA que a loja usa ou pensa em usar. Elas aparecem como sugestão ao preencher as tarefas.</p></div></div>
      <GerenciarFerramentas iniciais={listarFerramentas(db(), gestor.empresaId)} categorias={CATEGORIAS_FERRAMENTA} />
    </main>
  );
}
