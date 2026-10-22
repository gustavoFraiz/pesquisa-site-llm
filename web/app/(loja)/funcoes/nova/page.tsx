import NovaFuncao from '@/components/loja/NovaFuncao';
import { db } from '@/lib/db';
import { listarFuncoes } from '@/lib/funcoes';
import { listarModelos } from '@/lib/modelos';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function PaginaNovaFuncao({ searchParams }: { searchParams: Promise<{ extracao?: string }> }) {
  const gestor = await exigirPaginaGestor();
  const { extracao } = await searchParams;
  const funcoes = listarFuncoes(db(), gestor.empresaId).map(f => ({ id: f.id, nome: f.nome }));
  const extracaoInicial = extracao && /^[0-9a-f-]{36}$/.test(extracao) ? extracao : undefined;
  return <NovaFuncao modelos={listarModelos(db(), false)} funcoes={funcoes} extracaoInicial={extracaoInicial} />;
}
