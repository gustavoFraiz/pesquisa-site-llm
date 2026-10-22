import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { Usuario } from './auth.ts';
import { Fila } from './fila.ts';
import { HttpErro } from './http.ts';
import { bridge, dataDir, jobPath, python, root } from './server.ts';
import { normalizarStatus, type StatusExecucao, type TipoExecucao } from './status-execucao.ts';

export type ExecucaoPublica = Omit<StatusExecucao, 'runnerId'> & { posicao: number | null };

const estado = globalThis as typeof globalThis & { mrccFila?: Fila; mrccRunnerId?: string };
const fila = (estado.mrccFila ??= new Fila(6));
const runnerId = (estado.mrccRunnerId ??= randomUUID());
const ARQUIVO_MANUTENCAO = process.env.MRCC_MAINTENANCE_FILE || '/var/lib/mrcc-pv-deploy/maintenance';
// Nomes exigidos pelo wait_idle do publicador (pgrep "web_bridge.py (analise|llm)").
const MODO_BRIDGE: Record<TipoExecucao, string> = { trilha: 'llm', diagnostico: 'analise', extracao: 'extrair' };

const gravarStatus = (s: StatusExecucao) => writeFile(path.join(jobPath(s.id), 'status.json'), JSON.stringify(s));
function publico(s: StatusExecucao): ExecucaoPublica {
  const { runnerId: _interno, ...resto } = s;
  return { ...resto, posicao: fila.posicao(s.id) };
}

async function rodar(inicial: StatusExecucao): Promise<void> {
  const s: StatusExecucao = { ...inicial, status: 'executando', iniciadaEm: new Date().toISOString() };
  await gravarStatus(s);
  const pasta = jobPath(s.id);
  await new Promise<void>(resolve => {
    const filho = spawn(python, [bridge, MODO_BRIDGE[s.tipo], '--entrada', path.join(pasta, 'input.json'), '--saida', pasta], {
      cwd: root, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, stdio: ['ignore', 'ignore', 'pipe'],
    });
    let erro = '';
    filho.stderr.on('data', (parte: Buffer) => { erro = (erro + parte.toString('utf8')).slice(-3000); });
    const limite = setTimeout(() => filho.kill('SIGTERM'), 2_500_000);
    let terminou = false;
    const fim = (mensagem?: string) => {
      if (terminou) return;
      terminou = true;
      clearTimeout(limite);
      gravarStatus({ ...s, status: mensagem ? 'erro' : 'concluida', error: mensagem }).catch(() => undefined).finally(resolve);
    };
    filho.on('error', e => fim(e.message));
    filho.on('close', codigo => fim(codigo === 0 ? undefined : erro.trim() || 'A geração foi interrompida. Tente novamente.'));
  });
}

export async function iniciarExecucao(db: DatabaseSync, dados: { tipo: TipoExecucao; empresaId: string; funcaoId: string | null; ocupanteId: string | null; usuarioId: string; entrada: unknown }): Promise<ExecucaoPublica> {
  if (dados.tipo !== 'diagnostico' && existsSync(ARQUIVO_MANUTENCAO)) throw new HttpErro(503, 'O site está sendo atualizado. Aguarde um minuto e tente novamente.');
  const conteudo = JSON.stringify(dados.entrada);
  if (conteudo.length > 100_000) throw new HttpErro(413, 'Formulário extenso demais. Reduza as descrições.');
  const id = randomUUID();
  const status: StatusExecucao = { id, tipo: dados.tipo, status: 'aguardando', criadaEm: new Date().toISOString(), runnerId };
  let liberar!: (pronto: boolean) => void;
  const preparado = new Promise<boolean>(r => { liberar = r; });
  const executar = async () => { if (await preparado) await rodar(status); };
  // Reserva o lugar antes de criar arquivos: com a fila cheia, nada é gravado.
  if (dados.tipo !== 'diagnostico') fila.enfileirar({ id, empresaId: dados.empresaId, executar });
  try {
    await mkdir(path.join(dataDir, id), { recursive: true, mode: 0o700 });
    await writeFile(path.join(dataDir, id, 'input.json'), conteudo);
    await gravarStatus(status);
    db.prepare('INSERT INTO execucoes (id, tipo, empresa_id, funcao_id, ocupante_id, criada_por, criada_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, dados.tipo, dados.empresaId, dados.funcaoId, dados.ocupanteId, dados.usuarioId, status.criadaEm);
  } catch (erro) {
    liberar(false);
    throw erro;
  }
  liberar(true);
  // Diagnóstico não usa LLM e leva segundos: roda fora da fila. O catch evita rejeição não tratada.
  if (dados.tipo === 'diagnostico') void executar().catch(() => undefined);
  return publico(status);
}

export async function lerExecucao(db: DatabaseSync, usuario: Usuario, id: string) {
  const linha = db.prepare('SELECT empresa_id, funcao_id, ocupante_id FROM execucoes WHERE id = ?').get(id) as
    { empresa_id: string; funcao_id: string | null; ocupante_id: string | null } | undefined;
  if (!linha || (usuario.papel !== 'admin' && linha.empresa_id !== usuario.empresaId)) throw new HttpErro(404, 'Análise não encontrada.');
  const pasta = jobPath(id);
  const { status, alterado } = normalizarStatus(JSON.parse(await readFile(path.join(pasta, 'status.json'), 'utf8')) as StatusExecucao, runnerId);
  if (alterado) await gravarStatus(status);
  const arquivo = status.tipo === 'extracao' ? 'extracao.json' : 'analise.json';
  const result = status.status === 'concluida' ? JSON.parse(await readFile(path.join(pasta, arquivo), 'utf8')) as unknown : null;
  return { ...publico(status), result, ocupanteId: linha.ocupante_id, funcaoId: linha.funcao_id };
}

export function listarExecucoes(db: DatabaseSync, ocupanteId: string): { id: string; tipo: string; criadaEm: string }[] {
  const linhas = db.prepare("SELECT id, tipo, criada_em FROM execucoes WHERE ocupante_id = ? AND tipo IN ('trilha', 'diagnostico') ORDER BY criada_em DESC LIMIT 10")
    .all(ocupanteId) as { id: string; tipo: string; criada_em: string }[];
  return linhas.map(l => ({ id: l.id, tipo: l.tipo, criadaEm: l.criada_em }));
}
