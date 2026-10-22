import { execFile } from 'node:child_process';
import path from 'node:path';
import { HttpErro } from './http.ts';

export const root = process.env.MRCC_ROOT || path.resolve(process.cwd(), '..');
export const python = process.env.MRCC_PYTHON || path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export const dataDir = path.join(process.cwd(), 'data');
export const bridge = path.join(root, 'web_bridge.py');

export function runBridge(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => execFile(python, [bridge, ...args], { cwd: root, timeout: 45000, maxBuffer: 2_000_000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } },
    (error, stdout, stderr) => (error ? reject(new HttpErro(400, stderr.trim().slice(-1500) || 'Não foi possível processar a planilha.')) : resolve(stdout))));
}

export function jobPath(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new HttpErro(404, 'Resultado não encontrado.');
  return path.join(dataDir, id);
}
