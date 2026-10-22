import EditorModelo from '@/components/admin/EditorModelo';
import { db } from '@/lib/db';
import { obterModelo } from '@/lib/modelos';
import { exigirPagina, ou404 } from '@/lib/sessao-web';

export default async function PaginaModelo({ params }: { params: Promise<{ id: string }> }) {
  await exigirPagina({ papel: 'admin' });
  const { id } = await params;
  const modelo = ou404(() => obterModelo(db(), id, false));
  return <EditorModelo modelo={{ id: modelo.id, nome: modelo.nome, descricao: modelo.descricao, estrutura: modelo.estrutura }} />;
}
