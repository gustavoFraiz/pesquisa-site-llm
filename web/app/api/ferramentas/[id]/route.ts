import { db } from '@/lib/db';
import { removerFerramenta } from '@/lib/ferramentas';
import { errorResponse, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function DELETE(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    removerFerramenta(db(), gestor.empresaId, (await contexto.params).id);
    return Response.json({ removida: true });
  } catch (e) {
    return errorResponse(e);
  }
}
