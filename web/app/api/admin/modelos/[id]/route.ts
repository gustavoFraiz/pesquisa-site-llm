import { db } from '@/lib/db';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { definirModeloAtivo, salvarModelo } from '@/lib/modelos';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';
type Contexto = { params: Promise<{ id: string }> };

export async function PUT(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    await exigirUsuario({ papel: 'admin' });
    const corpo = await lerJson(request);
    salvarModelo(db(), (await contexto.params).id, { nome: corpo.nome, descricao: corpo.descricao, estrutura: corpo.estrutura });
    return Response.json({ salvo: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    await exigirUsuario({ papel: 'admin' });
    const { ativo } = await lerJson(request, 500);
    if (typeof ativo !== 'boolean') throw new HttpErro(400, 'Solicitação inválida.');
    definirModeloAtivo(db(), (await contexto.params).id, ativo);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
