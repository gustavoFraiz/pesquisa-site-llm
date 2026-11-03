import { db } from '@/lib/db';
import { selecionarLoja } from '@/lib/empresas';
import { errorResponse, HttpErro, sameOrigin } from '@/lib/http';
import { exigirGestor, tokenAtual } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const token = await tokenAtual();
    if (!token) throw new HttpErro(401, 'Sua sessão expirou. Entre novamente.');
    selecionarLoja(db(), gestor.id, token, (await contexto.params).id);
    return Response.json({ selecionada: true });
  } catch (e) {
    return errorResponse(e);
  }
}
