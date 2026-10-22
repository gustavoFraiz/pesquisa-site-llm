import { createHash, timingSafeEqual } from 'node:crypto';
import { criarUsuario } from '@/lib/auth';
import { db } from '@/lib/db';
import { HttpErro, errorResponse, lerJson, sameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

const TOKEN_HASH = '072d1843d6e6ee043a6b8d41e82c9ad05020424998f263c51d299d78c16ae3ce';

function tokenValido(token: unknown): boolean {
  if (typeof token !== 'string') return false;
  const recebido = Buffer.from(createHash('sha256').update(token).digest('hex'));
  const esperado = Buffer.from(TOKEN_HASH);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const corpo = await lerJson(request, 3000);

    if (!tokenValido(corpo.token)) throw new HttpErro(404, 'Bootstrap indisponível.');

    const banco = db();
    const existente = banco.prepare("SELECT 1 FROM usuarios WHERE papel = 'admin' LIMIT 1").get();
    if (existente) throw new HttpErro(409, 'Já existe um administrador. O bootstrap foi desativado automaticamente.');

    const id = await criarUsuario(banco, {
      email: corpo.email as string,
      senha: corpo.senha as string,
      papel: 'admin',
      empresaId: null,
      trocarSenha: false,
    });

    return Response.json({ ok: true, id }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
