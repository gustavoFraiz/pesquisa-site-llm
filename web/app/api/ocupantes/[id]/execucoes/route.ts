import { listarCatalogoAtivo } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { montarEntrada } from '@/lib/entrada-motor';
import { iniciarExecucao } from '@/lib/execucoes';
import { obterFuncao } from '@/lib/funcoes';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { obterOcupante } from '@/lib/ocupantes';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { tipo } = await lerJson(request, 1000);
    if (tipo !== 'trilha' && tipo !== 'diagnostico') throw new HttpErro(400, 'Tipo de geração inválido.');
    const banco = db();
    const ocupante = obterOcupante(banco, gestor.empresaId, (await contexto.params).id);
    const funcao = obterFuncao(banco, gestor.empresaId, ocupante.funcaoId);
    const entrada = montarEntrada(funcao, ocupante, listarCatalogoAtivo(banco, gestor.empresaId));
    const execucao = await iniciarExecucao(banco, { tipo, empresaId: gestor.empresaId, funcaoId: funcao.id, ocupanteId: ocupante.id, usuarioId: gestor.id, entrada });
    return Response.json(execucao, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
