import { encerrarSessao } from '@/lib/auth';
import { db } from '@/lib/db';
import { errorResponse, sameOrigin } from '@/lib/http';
import { limparCookieSessao, tokenAtual } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    encerrarSessao(db(), await tokenAtual());
    await limparCookieSessao();
    return Response.json({ destino: '/login' });
  } catch (e) {
    return errorResponse(e);
  }
}
