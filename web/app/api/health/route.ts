export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000), cache: 'no-store' });
    const data = await response.json();
    const model = process.env.MRCC_MODEL || 'qwen3:4b';
    return Response.json({ online: true, modelReady: data.models?.some((m: { name: string }) => m.name === model) || false, release: process.env.MRCC_DEPLOY_SHA || null });
  } catch { return Response.json({ online: true, modelReady: false, release: process.env.MRCC_DEPLOY_SHA || null }); }
}
