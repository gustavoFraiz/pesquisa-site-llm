import ListaModelos from '@/components/admin/ListaModelos';
import { db } from '@/lib/db';
import { listarFuncoesDeTodas } from '@/lib/funcoes';
import { listarModelos } from '@/lib/modelos';
import { exigirPagina } from '@/lib/sessao-web';

export default async function Modelos() {
  await exigirPagina({ papel: 'admin' });
  return <ListaModelos modelos={listarModelos(db(), true)} funcoes={listarFuncoesDeTodas(db())} />;
}
