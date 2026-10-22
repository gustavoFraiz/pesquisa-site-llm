import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db, transacao } from '@/lib/db';
import { estruturaDaEntrada } from '@/lib/entrada-motor';
import { criarFuncao } from '@/lib/funcoes';
import { errorResponse, HttpErro, sameOrigin } from '@/lib/http';
import { criarOcupante } from '@/lib/ocupantes';
import { dataDir, runBridge } from '@/lib/server';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let caminho: string | undefined;
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const arquivo = (await request.formData()).get('file');
    if (!(arquivo instanceof File) || !arquivo.name.toLowerCase().endsWith('.xlsx') || arquivo.size > 2_000_000) throw new HttpErro(400, 'Envie uma planilha .xlsx de até 2 MB.');
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    caminho = path.join(dataDir, `upload-${randomUUID()}.xlsx`);
    await writeFile(caminho, new Uint8Array(await arquivo.arrayBuffer()));
    const { nome, estrutura, niveis } = estruturaDaEntrada(JSON.parse(await runBridge(['importar', '--entrada', caminho])) as Record<string, unknown>);
    const banco = db();
    const funcaoId = transacao(banco, () => {
      const id = criarFuncao(banco, gestor.empresaId, { nome, estrutura, origem: 'planilha' });
      criarOcupante(banco, gestor.empresaId, id, { apelido: 'Ocupante 1', niveis });
      return id;
    });
    return Response.json({ funcaoId }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  } finally {
    if (caminho) await unlink(caminho).catch(() => undefined);
  }
}
