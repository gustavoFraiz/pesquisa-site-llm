import { jobPath, readJob, runBridge, errorResponse } from '@/lib/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { getSession } from '@/lib/session';
const files: Record<string, [string, string]> = {
  excel: ['MRCC-PV_com_propostas.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  json: ['analise.json', 'application/json'],
  report: ['relatorio.pdf', 'application/pdf'],
  evaluation: ['avaliacao_humana.json', 'application/json'],
  input: ['entrada.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
};
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const file = files[new URL(request.url).searchParams.get('type') || 'excel'];
    if (!file || (await readJob(id, (await getSession()).id)).status !== 'done') throw new Error('Arquivo indisponível.');
    if (file[0] === 'relatorio.pdf') {
      try { await stat(path.join(jobPath(id), file[0])); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await runBridge(['pdf', '--saida', jobPath(id)]);
      }
    }
    const content = await readFile(path.join(jobPath(id), file[0]));
    return new Response(new Uint8Array(content), { headers: { 'Content-Type': file[1], 'Content-Disposition': `attachment; filename="${file[0]}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) { return errorResponse(e, 404); }
}
