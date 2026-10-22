import { notFound } from 'next/navigation';
import PaginaOcupante from '@/components/ocupante/PaginaOcupante';
import { avaliacaoPendente } from '@/lib/avaliacoes';
import { listarCatalogoAtivo } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { listarExecucoes } from '@/lib/execucoes';
import { obterFuncao } from '@/lib/funcoes';
import { niveisDosOutros, obterOcupante } from '@/lib/ocupantes';
import { exigirPaginaGestor, ou404 } from '@/lib/sessao-web';

export default async function Pagina({ params }: { params: Promise<{ id: string; oid: string }> }) {
  const gestor = await exigirPaginaGestor();
  const { id, oid } = await params;
  const banco = db();
  const funcao = ou404(() => obterFuncao(banco, gestor.empresaId, id));
  const ocupante = ou404(() => obterOcupante(banco, gestor.empresaId, oid));
  if (ocupante.funcaoId !== funcao.id) notFound();
  const historico = listarExecucoes(banco, ocupante.id);
  return (
    <PaginaOcupante
      key={ocupante.atualizadoEm}
      funcao={{ id: funcao.id, nome: funcao.nome, estrutura: funcao.estrutura }}
      ocupante={{ id: ocupante.id, apelido: ocupante.apelido, niveis: ocupante.niveis, prazoDias: ocupante.prazoDias, atualizadoEm: ocupante.atualizadoEm }}
      historico={historico}
      execucaoInicial={historico[0]?.id ?? null}
      catalogo={listarCatalogoAtivo(banco, gestor.empresaId)}
      outros={niveisDosOutros(banco, gestor.empresaId, funcao.id, ocupante.id)}
      avaliacaoPendente={avaliacaoPendente(banco, funcao.id)}
    />
  );
}
