import PainelEmpresas from '@/components/admin/PainelEmpresas';
import { db } from '@/lib/db';
import { listarEmpresas } from '@/lib/empresas';
import { exigirPagina } from '@/lib/sessao-web';

export default async function Admin() {
  await exigirPagina({ papel: 'admin' });
  return <PainelEmpresas iniciais={listarEmpresas(db())} />;
}
