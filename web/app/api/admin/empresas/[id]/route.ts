import { db } from '@/lib/db';
import { definirEmpresaAtiva, redefinirSenhaGestor } from '@/lib/empresas';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function PATCH(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    await exigirUsuario({ papel: 'admin' });
    const { id } = await contexto.params;
    const { acao } = await lerJson(request, 1000);
    if (acao === 'ativar' || acao === 'desativar') {
      definirEmpresaAtiva(db(), id, acao === 'ativar');
      return Response.json({ ok: true });
    }
    if (acao === 'redefinir-senha') {
      return Response.json({ senhaTemporaria: await redefinirSenhaGestor(db(), id) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    throw new HttpErro(400, 'Ação inválida.');
  } catch (e) {
    return errorResponse(e);
  }
}
