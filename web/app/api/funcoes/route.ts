import { db } from '@/lib/db';
import { criarFuncaoAPartirDe } from '@/lib/nova-funcao';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const corpo = await lerJson(request, 20_000);
    const id = criarFuncaoAPartirDe(db(), gestor.empresaId, { nome: corpo.nome, modeloId: corpo.modeloId, copiarDe: corpo.copiarDe, tarefasSugeridas: corpo.tarefasSugeridas });
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
