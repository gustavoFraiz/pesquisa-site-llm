import { db } from '@/lib/db';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';
import { registrarTempo } from '@/lib/tempo';

export const runtime = 'nodejs';
const estado = globalThis as typeof globalThis & { mrccTempo?: Map<string, number> };

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { tipo, id } = await lerJson(request, 500);
    if ((tipo !== 'funcao' && tipo !== 'ocupante') || typeof id !== 'string') throw new HttpErro(400, 'Solicitação inválida.');
    registrarTempo(db(), { tipo, id }, gestor.empresaId, (estado.mrccTempo ??= new Map()));
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
