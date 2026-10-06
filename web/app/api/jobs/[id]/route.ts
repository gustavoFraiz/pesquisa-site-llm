import { readJob, errorResponse } from '@/lib/server';
import { getSession } from '@/lib/session';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json(await readJob((await context.params).id, (await getSession()).id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return errorResponse(e, 404); }
}
