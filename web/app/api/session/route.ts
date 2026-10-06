import { getSession, db, history, assertOwner } from '@/lib/session';
import { errorResponse, sameOrigin } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await getSession(true);
    return Response.json({ id: session.id, draft: session.draft ? JSON.parse(session.draft) : null, currentJob: session.current_job, history: history(session.id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e, 500); }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const session = await getSession();
    const text = await request.text();
    if (text.length > 110000) throw new Error('Formulário extenso demais.');
    const { input, jobId } = JSON.parse(text);
    if (!input || !Array.isArray(input.tarefas) || !Array.isArray(input.competencias)) throw new Error('Formulário inválido.');
    if (jobId) assertOwner(jobId, session.id);
    db().prepare('UPDATE sessions SET draft=?, current_job=? WHERE id=?').run(JSON.stringify(input), jobId || null, session.id);
    return Response.json({ saved: true });
  } catch (e) { return errorResponse(e); }
}
