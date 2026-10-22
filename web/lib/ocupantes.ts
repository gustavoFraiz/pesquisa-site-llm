import type { DatabaseSync } from 'node:sqlite';
import { NIVEIS, type Nivel, type Niveis } from './estrutura.ts';
import { obterFuncao, proximaVersao } from './funcoes.ts';
import { HttpErro } from './http.ts';

export type Ocupante = { id: string; funcaoId: string; empresaId: string; apelido: string; niveis: Niveis; prazoDias: number; criadoEm: string; atualizadoEm: string };
export type ResumoOcupante = { id: string; apelido: string; niveisPreenchidos: number; trilhas: number; atualizadoEm: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function validarApelido(v: unknown): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > 60) throw new HttpErro(400, 'Informe um apelido de até 60 caracteres (ex.: Atendente 1).');
  return v.trim();
}

export function validarPrazo(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 180) throw new HttpErro(400, 'Informe um prazo inteiro entre 1 e 180 dias.');
  return v;
}

export function validarNiveis(v: unknown): Niveis {
  const invalido = () => new HttpErro(400, 'Níveis inválidos.');
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalido();
  const entradas = Object.entries(v as Record<string, unknown>);
  if (entradas.length > 50) throw invalido();
  const niveis: Niveis = {};
  for (const [id, valor] of entradas) {
    if (!UUID.test(id) || !valor || typeof valor !== 'object') throw invalido();
    const { nivel, respostas } = valor as { nivel?: unknown; respostas?: unknown };
    if (typeof nivel !== 'string' || !(NIVEIS as readonly string[]).includes(nivel)) throw invalido();
    const respostasValidas = respostas === null || (Array.isArray(respostas) && respostas.length === 3 && respostas.every(r => r === null || typeof r === 'boolean'));
    if (!respostasValidas) throw invalido();
    niveis[id] = { nivel: nivel as Nivel, respostas: respostas === null ? null : [...(respostas as (boolean | null)[])] };
  }
  return niveis;
}

type Linha = { id: string; funcao_id: string; empresa_id: string; apelido: string; niveis: string; prazo_dias: number; criado_em: string; atualizado_em: string };

export function criarOcupante(db: DatabaseSync, empresaId: string, funcaoId: string, dados: { apelido: unknown; niveis?: Niveis }, agora = Date.now()): string {
  obterFuncao(db, empresaId, funcaoId);
  const id = crypto.randomUUID();
  const momento = new Date(agora).toISOString();
  db.prepare('INSERT INTO ocupantes (id, funcao_id, apelido, niveis, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, funcaoId, validarApelido(dados.apelido), JSON.stringify(validarNiveis(dados.niveis ?? {})), momento, momento);
  return id;
}

export function obterOcupante(db: DatabaseSync, empresaId: string | null, id: string): Ocupante {
  const l = db.prepare(`SELECT o.id, o.funcao_id, f.empresa_id, o.apelido, o.niveis, o.prazo_dias, o.criado_em, o.atualizado_em
    FROM ocupantes o JOIN funcoes f ON f.id = o.funcao_id WHERE o.id = ? AND o.arquivado = 0 AND f.arquivada = 0`).get(id) as Linha | undefined;
  if (!l || (empresaId !== null && l.empresa_id !== empresaId)) throw new HttpErro(404, 'Ocupante não encontrado.');
  return {
    id: l.id, funcaoId: l.funcao_id, empresaId: l.empresa_id, apelido: l.apelido, niveis: JSON.parse(l.niveis) as Niveis,
    prazoDias: Number(l.prazo_dias), criadoEm: l.criado_em, atualizadoEm: l.atualizado_em,
  };
}

export function salvarOcupante(db: DatabaseSync, empresaId: string, id: string, dados: { apelido: unknown; niveis: unknown; prazoDias: unknown; versao?: unknown }, agora = Date.now()): string {
  const atual = obterOcupante(db, empresaId, id);
  const apelido = validarApelido(dados.apelido);
  const niveis = validarNiveis(dados.niveis);
  const prazo = validarPrazo(dados.prazoDias);
  const versao = proximaVersao(atual.atualizadoEm, dados.versao, agora);
  db.prepare('UPDATE ocupantes SET apelido = ?, niveis = ?, prazo_dias = ?, atualizado_em = ? WHERE id = ?')
    .run(apelido, JSON.stringify(niveis), prazo, versao, id);
  return versao;
}

export function arquivarOcupante(db: DatabaseSync, empresaId: string, id: string): void {
  obterOcupante(db, empresaId, id);
  db.prepare('UPDATE ocupantes SET arquivado = 1 WHERE id = ?').run(id);
}

export function listarOcupantes(db: DatabaseSync, empresaId: string | null, funcaoId: string): ResumoOcupante[] {
  const funcao = obterFuncao(db, empresaId, funcaoId);
  const competencias = funcao.estrutura.competencias.map(c => c.id);
  const linhas = db.prepare(`SELECT o.id, o.apelido, o.niveis, o.atualizado_em,
      (SELECT COUNT(*) FROM execucoes x WHERE x.ocupante_id = o.id AND x.tipo = 'trilha') AS trilhas
    FROM ocupantes o WHERE o.funcao_id = ? AND o.arquivado = 0 ORDER BY o.criado_em`).all(funcaoId) as
    { id: string; apelido: string; niveis: string; atualizado_em: string; trilhas: number }[];
  return linhas.map(l => {
    const niveis = JSON.parse(l.niveis) as Niveis;
    return { id: l.id, apelido: l.apelido, niveisPreenchidos: competencias.filter(c => niveis[c]).length, trilhas: Number(l.trilhas), atualizadoEm: l.atualizado_em };
  });
}

export function niveisDosOutros(db: DatabaseSync, empresaId: string, funcaoId: string, excetoId: string): { id: string; apelido: string; niveis: Niveis }[] {
  obterFuncao(db, empresaId, funcaoId);
  const linhas = db.prepare('SELECT id, apelido, niveis FROM ocupantes WHERE funcao_id = ? AND arquivado = 0 AND id <> ? ORDER BY criado_em')
    .all(funcaoId, excetoId) as { id: string; apelido: string; niveis: string }[];
  return linhas.map(l => ({ id: l.id, apelido: l.apelido, niveis: JSON.parse(l.niveis) as Niveis }));
}

export function ocupantesParaSintese(db: DatabaseSync, empresaId: string | null, funcaoId: string): { id: string; apelido: string; niveis: Niveis; arquivado: boolean; ultimaTrilha: string | null }[] {
  obterFuncao(db, empresaId, funcaoId, true);
  const linhas = db.prepare(`SELECT o.id, o.apelido, o.niveis, o.arquivado,
      (SELECT x.id FROM execucoes x WHERE x.ocupante_id = o.id AND x.tipo = 'trilha' ORDER BY x.criada_em DESC LIMIT 1) AS ultima
    FROM ocupantes o WHERE o.funcao_id = ? ORDER BY o.criado_em`).all(funcaoId) as { id: string; apelido: string; niveis: string; arquivado: number; ultima: string | null }[];
  return linhas.map(l => ({ id: l.id, apelido: l.apelido, niveis: JSON.parse(l.niveis) as Niveis, arquivado: Number(l.arquivado) === 1, ultimaTrilha: l.ultima }));
}
