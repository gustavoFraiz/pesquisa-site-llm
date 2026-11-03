import GerenciarLojas from '@/components/loja/GerenciarLojas';
import { db } from '@/lib/db';
import { listarLojasDoGestor } from '@/lib/empresas';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function Lojas() {
  const gestor = await exigirPaginaGestor();
  return <GerenciarLojas lojas={listarLojasDoGestor(db(), gestor.id)} atual={gestor.empresaId} />;
}
