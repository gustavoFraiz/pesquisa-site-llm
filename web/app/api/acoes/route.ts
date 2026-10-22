import { criarAcao, listarAcoes } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const u = await exigirUsuario();
    return Response.json({ acoes: listarAcoes(db(), u.papel === 'admin' ? null : u.empresaId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const u = await exigirUsuario();
    const id = criarAcao(db(), u.papel === 'admin' ? null : u.empresaId, await lerJson(request, 3000));
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
