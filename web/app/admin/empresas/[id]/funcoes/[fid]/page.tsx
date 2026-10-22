import { notFound } from 'next/navigation';
import SinteseFuncao from '@/components/SinteseFuncao';
import { db } from '@/lib/db';
import { obterFuncao } from '@/lib/funcoes';
import { ocupantesParaSintese } from '@/lib/ocupantes';
import { exigirPagina, ou404 } from '@/lib/sessao-web';

export default async function SinteseAdmin({ params }: { params: Promise<{ id: string; fid: string }> }) {
  await exigirPagina({ papel: 'admin' });
  const { id, fid } = await params;
  const funcao = ou404(() => obterFuncao(db(), null, fid, true));
  if (funcao.empresaId !== id) notFound();
  return (
    <main className="page">
      <a className="text-button" href={`/admin/empresas/${id}`}>← Funções da empresa</a>
      <SinteseFuncao funcao={{ nome: funcao.nome, estrutura: funcao.estrutura, arquivada: funcao.arquivada }} ocupantes={ocupantesParaSintese(db(), null, fid)} />
    </main>
  );
}
