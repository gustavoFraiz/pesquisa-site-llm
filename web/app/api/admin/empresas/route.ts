import { db } from '@/lib/db';
import { criarEmpresaComGestor, listarEmpresas } from '@/lib/empresas';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await exigirUsuario({ papel: 'admin' });
    return Response.json({ empresas: listarEmpresas(db()) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await exigirUsuario({ papel: 'admin' });
    const criada = await criarEmpresaComGestor(db(), await lerJson(request, 5000));
    return Response.json(criada, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
