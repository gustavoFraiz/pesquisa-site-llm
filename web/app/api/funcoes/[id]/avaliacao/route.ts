import { registrarAvaliacao } from '@/lib/avaliacoes';
import { db } from '@/lib/db';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { nota, comentario } = await lerJson(request, 2000);
    registrarAvaliacao(db(), gestor.empresaId, (await contexto.params).id, { nota, comentario });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
