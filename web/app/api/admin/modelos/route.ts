import { db } from '@/lib/db';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { criarModelo, promoverFuncao } from '@/lib/modelos';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await exigirUsuario({ papel: 'admin' });
    const corpo = await lerJson(request, 2000);
    const id = typeof corpo.funcaoId === 'string' ? promoverFuncao(db(), corpo.funcaoId) : criarModelo(db(), { nome: corpo.nome, descricao: corpo.descricao, estrutura: undefined });
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
