import PainelEmpresas from '@/components/admin/PainelEmpresas';
import { db } from '@/lib/db';
import { listarEmpresas } from '@/lib/empresas';
import { semearBaseApresentacao } from '@/lib/seed-apresentacao';
import { exigirPagina } from '@/lib/sessao-web';

export default async function Admin() {
  await exigirPagina({ papel: 'admin' });
  const banco = db();
  semearBaseApresentacao(banco);
  return <PainelEmpresas iniciais={listarEmpresas(banco)} />;
}
