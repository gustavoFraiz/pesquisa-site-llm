export class HttpErro extends Error {
  status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
    this.name = 'HttpErro';
  }
}

export function errorResponse(error: unknown, status = 400): Response {
  const codigo = error instanceof HttpErro ? error.status : status;
  const mensagem = error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
  return Response.json({ error: mensagem }, { status: codigo, headers: { 'Cache-Control': 'no-store' } });
}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) throw new HttpErro(403, 'Origem da solicitação inválida.');
}

export async function lerJson(request: Request, limite = 110_000): Promise<Record<string, unknown>> {
  const texto = await request.text();
  if (texto.length > limite) throw new HttpErro(413, 'Conteúdo extenso demais.');
  try {
    const valor: unknown = JSON.parse(texto);
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as Record<string, unknown>;
  } catch {
    // Cai na resposta padrão abaixo.
  }
  throw new HttpErro(400, 'Solicitação inválida.');
}
