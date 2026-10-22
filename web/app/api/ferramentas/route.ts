import { db } from '@/lib/db';
import { adicionarFerramenta, listarFerramentas } from '@/lib/ferramentas';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const gestor = await exigirGestor();
    return Response.json({ ferramentas: listarFerramentas(db(), gestor.empresaId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { nome } = await lerJson(request, 500);
    return Response.json(adicionarFerramenta(db(), gestor.empresaId, nome), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
