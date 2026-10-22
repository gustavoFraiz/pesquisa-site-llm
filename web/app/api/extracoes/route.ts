import { db } from '@/lib/db';
import { iniciarExecucao } from '@/lib/execucoes';
import { listarFerramentas } from '@/lib/ferramentas';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { nome, descricao } = await lerJson(request, 5000);
    if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 120) throw new HttpErro(400, 'Informe o nome da função (até 120 caracteres).');
    if (typeof descricao !== 'string' || descricao.trim().length < 40 || descricao.trim().length > 2000) throw new HttpErro(400, 'Descreva a função com 40 a 2000 caracteres.');
    const entrada = { funcao: nome.trim(), descricao: descricao.trim(), ferramentas: listarFerramentas(db(), gestor.empresaId).map(f => f.nome) };
    const execucao = await iniciarExecucao(db(), { tipo: 'extracao', empresaId: gestor.empresaId, funcaoId: null, ocupanteId: null, usuarioId: gestor.id, entrada });
    return Response.json(execucao, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
