import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataDir, runBridge, errorResponse, sameOrigin } from '@/lib/server';
import { getSession } from '@/lib/session';
export async function POST(request: Request) {
  let filePath: string | undefined;
  try {
    sameOrigin(request);
    await getSession();
    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.xlsx') || file.size > 2_000_000) throw new Error('Envie uma planilha .xlsx de até 2 MB.');
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    filePath = path.join(dataDir, `upload-${randomUUID()}.xlsx`);
    await writeFile(filePath, new Uint8Array(await file.arrayBuffer()));
    return Response.json(JSON.parse(await runBridge(['importar', '--entrada', filePath])));
  } catch (e) { return errorResponse(e); }
  finally { if (filePath) await unlink(filePath).catch(() => {}); }
}
