import { db } from '@/lib/db';
import { arquivarFuncao, obterFuncao, salvarFuncao } from '@/lib/funcoes';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { listarOcupantes } from '@/lib/ocupantes';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, contexto: Contexto) {
  try {
    const gestor = await exigirGestor();
    const { id } = await contexto.params;
    const funcao = obterFuncao(db(), gestor.empresaId, id);
    return Response.json({ funcao, ocupantes: listarOcupantes(db(), gestor.empresaId, id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { id } = await contexto.params;
    const corpo = await lerJson(request);
    const versao = salvarFuncao(db(), gestor.empresaId, id, { nome: corpo.nome, estrutura: corpo.estrutura, versao: corpo.versao });
    return Response.json({ salvo: true, versao });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    arquivarFuncao(db(), gestor.empresaId, (await contexto.params).id);
    return Response.json({ arquivada: true });
  } catch (e) {
    return errorResponse(e);
  }
}
