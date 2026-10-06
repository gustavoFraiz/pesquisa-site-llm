import { runBridge, errorResponse } from '@/lib/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return Response.json(JSON.parse(await runBridge(['seed']))); }
  catch (e) { return errorResponse(e, 500); }
}
