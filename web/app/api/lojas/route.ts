import { db } from '@/lib/db';
import { criarLojaDoGestor } from '@/lib/empresas';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { exigirGestor, tokenAtual } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const token = await tokenAtual();
    if (!token) throw new HttpErro(401, 'Sua sessão expirou. Entre novamente.');
    const id = criarLojaDoGestor(db(), gestor.id, token, await lerJson(request, 2000));
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
