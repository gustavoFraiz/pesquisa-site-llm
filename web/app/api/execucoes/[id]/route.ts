import { db } from '@/lib/db';
import { lerExecucao } from '@/lib/execucoes';
import { errorResponse } from '@/lib/http';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await exigirUsuario();
    return Response.json(await lerExecucao(db(), usuario, (await contexto.params).id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e, 404);
  }
}
