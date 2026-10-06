import { jobPath, readJob, errorResponse } from '@/lib/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getSession } from '@/lib/session';
const files: Record<string, [string, string]> = {
  excel: ['MRCC-PV_com_propostas.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  json: ['analise.json', 'application/json'],
  report: ['relatorio.md', 'text/markdown; charset=utf-8'],
  evaluation: ['avaliacao_humana.json', 'application/json'],
  input: ['entrada.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
};
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const file = files[new URL(request.url).searchParams.get('type') || 'excel'];
    if (!file || (await readJob(id, (await getSession()).id)).status !== 'done') throw new Error('Arquivo indisponível.');
    const content = await readFile(path.join(jobPath(id), file[0]));
    return new Response(new Uint8Array(content), { headers: { 'Content-Type': file[1], 'Content-Disposition': `attachment; filename="${file[0]}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) { return errorResponse(e, 404); }
}
