import { entrar } from '@/lib/auth';
import { db } from '@/lib/db';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { definirCookieSessao, destinoInicial } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const corpo = await lerJson(request, 2000);
    const { token, usuario } = await entrar(db(), corpo.email, corpo.senha);
    await definirCookieSessao(token);
    return Response.json({ destino: destinoInicial(usuario) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
