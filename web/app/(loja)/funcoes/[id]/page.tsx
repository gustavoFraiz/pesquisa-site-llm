import EditorFuncao from '@/components/funcao/EditorFuncao';
import { db } from '@/lib/db';
import { obterFuncao } from '@/lib/funcoes';
import { listarFerramentas } from '@/lib/ferramentas';
import { listarOcupantes } from '@/lib/ocupantes';
import { exigirPaginaGestor, ou404 } from '@/lib/sessao-web';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ etapa?: string }> };

export default async function PaginaFuncao({ params, searchParams }: Props) {
  const gestor = await exigirPaginaGestor();
  const { id } = await params;
  const { etapa } = await searchParams;
  const funcao = ou404(() => obterFuncao(db(), gestor.empresaId, id));
  const ocupantes = listarOcupantes(db(), gestor.empresaId, id);
  // Ao voltar da página de um ocupante, abre direto na etapa Ocupantes.
  return <EditorFuncao key={funcao.atualizadaEm} funcao={{ id: funcao.id, nome: funcao.nome, estrutura: funcao.estrutura, atualizadaEm: funcao.atualizadaEm }} ocupantes={ocupantes} ferramentas={listarFerramentas(db(), gestor.empresaId).map(f => f.nome)} etapaInicial={etapa === 'ocupantes' ? 3 : etapa === 'competencias' ? 1 : 0} />;
}
