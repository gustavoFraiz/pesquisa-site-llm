import { db } from '@/lib/db';
import { errorResponse } from '@/lib/http';
import { calcularMetrica, paraCsv } from '@/lib/metricas';
import { coletarMetricas, leitorDeAnalises } from '@/lib/metricas-dados';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await exigirUsuario({ papel: 'admin' });
    const empresa = new URL(request.url).searchParams.get('empresa') || undefined;
    const csv = paraCsv(coletarMetricas(db(), leitorDeAnalises, empresa).map(calcularMetrica));
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="metricas-mrcc-pv.csv"', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
