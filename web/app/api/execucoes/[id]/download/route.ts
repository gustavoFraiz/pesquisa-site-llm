import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/db';
import { lerExecucao } from '@/lib/execucoes';
import { errorResponse, HttpErro } from '@/lib/http';
import { jobPath, runBridge } from '@/lib/server';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';

const ARQUIVOS: Record<string, [string, string, string?]> = {
  excel: ['MRCC-PV_com_propostas.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  json: ['analise.json', 'application/json'],
  report: ['relatorio-v2.pdf', 'application/pdf', 'relatorio.pdf'],
  evaluation: ['avaliacao_humana.json', 'application/json'],
  input: ['entrada.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

export async function GET(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await exigirUsuario();
    const { id } = await contexto.params;
    const arquivo = ARQUIVOS[new URL(request.url).searchParams.get('type') || 'excel'];
    const execucao = await lerExecucao(db(), usuario, id);
    // Extrações não têm planilha nem relatório: sem esta checagem, cada pedido de PDF abriria um processo Python.
    if (!arquivo || execucao.status !== 'concluida' || execucao.tipo === 'extracao') throw new HttpErro(404, 'Arquivo indisponível.');
    if (arquivo === ARQUIVOS.report) {
      try {
        await stat(path.join(jobPath(id), arquivo[0]));
      } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro;
        await runBridge(['pdf', '--saida', jobPath(id)]);
      }
    }
    const conteudo = await readFile(path.join(jobPath(id), arquivo[0]));
    return new Response(new Uint8Array(conteudo), {
      headers: { 'Content-Type': arquivo[1], 'Content-Disposition': `attachment; filename="${arquivo[2] || arquivo[0]}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (e) {
    return errorResponse(e, 404);
  }
}
