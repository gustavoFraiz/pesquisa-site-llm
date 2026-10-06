import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db, assertOwner } from './session';

export const root = process.env.MRCC_ROOT || path.resolve(process.cwd(), '..');
const python = process.env.MRCC_PYTHON || path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export const dataDir = path.join(process.cwd(), 'data');
const bridge = path.join(root, 'web_bridge.py');
type Job = { id: string; status: 'running' | 'done' | 'error'; createdAt: string; error?: string; mode: string; runnerId: string };
const state = globalThis as typeof globalThis & { mrccBusy?: boolean; mrccRunnerId?: string };
const runnerId = state.mrccRunnerId ||= randomUUID();

export function runBridge(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => execFile(python, [bridge, ...args], { cwd: root, timeout: 45000, maxBuffer: 2_000_000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }, (error, stdout, stderr) => error ? reject(new Error(stderr.trim().slice(-1500) || 'Não foi possível processar a planilha.')) : resolve(stdout)));
}

export async function createJob(input: unknown, mode: string, sessionId: string) {
  if (!['analise', 'llm'].includes(mode)) throw new Error('Modo inválido.');
  if (state.mrccBusy) throw new Error('Já há uma geração em andamento. Aguarde alguns minutos e tente novamente.');
  if (!input || typeof input !== 'object' || JSON.stringify(input).length > 100000) throw new Error('Formulário inválido ou extenso demais.');
  state.mrccBusy = true;
  const id = randomUUID();
  const dir = path.join(dataDir, id);
  const job: Job = { id, status: 'running', createdAt: new Date().toISOString(), mode, runnerId };
  try {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(path.join(dir, 'input.json'), JSON.stringify(input));
    await writeFile(path.join(dir, 'status.json'), JSON.stringify(job));
    db().prepare('INSERT INTO jobs (id, session_id, created_at) VALUES (?, ?, ?)').run(id, sessionId, job.createdAt);
    db().prepare('UPDATE sessions SET draft=?, current_job=? WHERE id=?').run(JSON.stringify(input), id, sessionId);
    const child = spawn(python, [bridge, mode, '--entrada', path.join(dir, 'input.json'), '--saida', dir], { cwd: root, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, stdio: ['ignore', 'ignore', 'pipe'] });
    let errorText = '';
    child.stderr.on('data', (chunk: Buffer) => { errorText = (errorText + chunk.toString('utf8')).slice(-3000); });
    const timer = setTimeout(() => child.kill('SIGTERM'), 2_500_000);
    let finished = false;
    const finish = async (error?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      state.mrccBusy = false;
      job.status = error ? 'error' : 'done';
      job.error = error;
      await writeFile(path.join(dir, 'status.json'), JSON.stringify(job));
    };
    child.on('error', (e) => void finish(e.message));
    child.on('close', (code) => void finish(code === 0 ? undefined : errorText.trim() || 'A geração foi interrompida. Tente novamente.'));
    return job;
  } catch (error) {
    state.mrccBusy = false;
    throw error;
  }
}

export function jobPath(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new Error('Resultado não encontrado.');
  return path.join(dataDir, id);
}

export async function readJob(id: string, sessionId: string) {
  assertOwner(id, sessionId);
  const dir = jobPath(id);
  const job: Job = JSON.parse(await readFile(path.join(dir, 'status.json'), 'utf8'));
  if (job.status === 'running' && job.runnerId !== runnerId) {
    job.status = 'error'; job.error = 'A geração foi interrompida por um reinício do serviço. Você pode iniciar novamente.';
    await writeFile(path.join(dir, 'status.json'), JSON.stringify(job));
  }
  if (job.status === 'running' && Date.now() - new Date(job.createdAt).getTime() > 2_600_000) {
    job.status = 'error'; job.error = 'A geração expirou. Você pode iniciar novamente.';
  }
  const result = job.status === 'done' ? JSON.parse(await readFile(path.join(dir, 'analise.json'), 'utf8')) : null;
  const input = JSON.parse(await readFile(path.join(dir, 'input.json'), 'utf8'));
  return { ...job, result, input };
}

export function errorResponse(error: unknown, status = 400) {
  return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível concluir a operação.' }, { status });
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) throw new Error('Origem da solicitação inválida.');
}
