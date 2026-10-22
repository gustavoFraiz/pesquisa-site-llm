import Topo from '@/components/Topo';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function LayoutLoja({ children }: { children: React.ReactNode }) {
  const gestor = await exigirPaginaGestor();
  return <><Topo subtitulo={gestor.empresaNome} />{children}</>;
}
