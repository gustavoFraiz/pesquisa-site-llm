import NavAdmin from '@/components/admin/NavAdmin';
import Topo from '@/components/Topo';
import { exigirPagina } from '@/lib/sessao-web';

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await exigirPagina({ papel: 'admin' });
  return <><Topo subtitulo="Administração da pesquisa" inicio="/admin" /><NavAdmin />{children}</>;
}
