import { definirAcaoAtiva } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function PATCH(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const u = await exigirUsuario();
    const { ativa } = await lerJson(request, 500);
    if (typeof ativa !== 'boolean') throw new HttpErro(400, 'Solicitação inválida.');
    definirAcaoAtiva(db(), u.papel === 'admin' ? null : u.empresaId, (await contexto.params).id, ativa);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
