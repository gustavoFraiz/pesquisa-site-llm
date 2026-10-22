export type TipoExecucao = 'trilha' | 'diagnostico' | 'extracao';
export type EstadoExecucao = 'aguardando' | 'executando' | 'concluida' | 'erro';
export type StatusExecucao = { id: string; tipo: TipoExecucao; status: EstadoExecucao; criadaEm: string; iniciadaEm?: string; runnerId: string; error?: string };

export const LIMITE_EXECUCAO_MS = 2_600_000;

/** Pedidos de um processo anterior não terminam mais: viram erro visível em vez de girar para sempre. */
export function normalizarStatus(s: StatusExecucao, runnerAtual: string, agora = Date.now()): { status: StatusExecucao; alterado: boolean } {
  if ((s.status === 'aguardando' || s.status === 'executando') && s.runnerId !== runnerAtual) {
    return { status: { ...s, status: 'erro', error: 'A geração foi interrompida por um reinício do serviço. Você pode iniciar novamente.' }, alterado: true };
  }
  if (s.status === 'executando' && s.iniciadaEm && agora - Date.parse(s.iniciadaEm) > LIMITE_EXECUCAO_MS) {
    return { status: { ...s, status: 'erro', error: 'A geração expirou. Você pode iniciar novamente.' }, alterado: false };
  }
  return { status: s, alterado: false };
}
