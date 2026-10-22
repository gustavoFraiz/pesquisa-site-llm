import Link from 'next/link';
import GerenciarFerramentas from '@/components/loja/GerenciarFerramentas';
import { db } from '@/lib/db';
import { CATEGORIAS_FERRAMENTA, listarFerramentas } from '@/lib/ferramentas';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function BoasVindas() {
  const gestor = await exigirPaginaGestor();
  return (
    <main className="page narrow">
      <div className="page-heading"><div><p className="eyebrow">BOAS-VINDAS</p><h1>Quais ferramentas de IA sua loja usa ou pensa em usar?</h1><p>Isso deixa o preenchimento mais rápido. Pode pular e voltar depois pelo painel.</p></div></div>
      <GerenciarFerramentas iniciais={listarFerramentas(db(), gestor.empresaId)} categorias={CATEGORIAS_FERRAMENTA} />
      <Link className="button primary" href="/">Continuar para o painel</Link>
    </main>
  );
}
