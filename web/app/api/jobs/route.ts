import { createJob, errorResponse, sameOrigin } from '@/lib/server';
import { getSession } from '@/lib/session';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const session = await getSession();
    const body = await request.text();
    if (body.length > 110000) throw new Error('Formulário extenso demais.');
    const { input, mode } = JSON.parse(body);
    return Response.json(await createJob(input, mode, session.id), { status: 202 });
  } catch (e) { return errorResponse(e); }
}
