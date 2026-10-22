import SinteseFuncao from '@/components/SinteseFuncao';
import { db } from '@/lib/db';
import { obterFuncao } from '@/lib/funcoes';
import { ocupantesParaSintese } from '@/lib/ocupantes';
import { exigirPaginaGestor, ou404 } from '@/lib/sessao-web';

export default async function Sintese({ params }: { params: Promise<{ id: string }> }) {
  const gestor = await exigirPaginaGestor();
  const { id } = await params;
  const funcao = ou404(() => obterFuncao(db(), gestor.empresaId, id));
  return (
    <main className="page">
      <a className="text-button" href={`/funcoes/${id}`}>← Voltar à função</a>
      <SinteseFuncao funcao={{ nome: funcao.nome, estrutura: funcao.estrutura, arquivada: funcao.arquivada }} ocupantes={ocupantesParaSintese(db(), gestor.empresaId, id).filter(o => !o.arquivado)} />
    </main>
  );
}
