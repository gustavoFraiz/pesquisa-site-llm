import { db } from '@/lib/db';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { arquivarOcupante, obterOcupante, salvarOcupante } from '@/lib/ocupantes';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, contexto: Contexto) {
  try {
    const gestor = await exigirGestor();
    return Response.json(obterOcupante(db(), gestor.empresaId, (await contexto.params).id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const corpo = await lerJson(request, 20_000);
    const versao = salvarOcupante(db(), gestor.empresaId, (await contexto.params).id, { apelido: corpo.apelido, niveis: corpo.niveis, prazoDias: corpo.prazoDias, versao: corpo.versao });
    return Response.json({ salvo: true, versao });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    arquivarOcupante(db(), gestor.empresaId, (await contexto.params).id);
    return Response.json({ arquivado: true });
  } catch (e) {
    return errorResponse(e);
  }
}
