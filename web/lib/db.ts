import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CATALOGO_BASE } from './seed.ts';

// Somente tabelas novas: a versão anterior (rollback do deploy) ignora estas tabelas.
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS empresas (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, cidade TEXT NOT NULL DEFAULT '', segmento TEXT NOT NULL DEFAULT '',
  ativa INTEGER NOT NULL DEFAULT 1, criada_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('admin', 'gestor')), empresa_id TEXT REFERENCES empresas(id),
  trocar_senha INTEGER NOT NULL DEFAULT 1, falhas INTEGER NOT NULL DEFAULT 0, bloqueado_ate INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL, ultimo_acesso TEXT,
  CHECK ((papel = 'admin') = (empresa_id IS NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_gestor_unico ON usuarios(empresa_id) WHERE papel = 'gestor';
CREATE TABLE IF NOT EXISTS auth_sessoes (
  token_hash TEXT PRIMARY KEY, usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira INTEGER NOT NULL, criada_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS auth_sessoes_usuario ON auth_sessoes(usuario_id);
CREATE TABLE IF NOT EXISTS catalogo_acoes (
  id TEXT PRIMARY KEY, empresa_id TEXT REFERENCES empresas(id), eixo TEXT NOT NULL, acao TEXT NOT NULL,
  recurso TEXT NOT NULL, custo TEXT NOT NULL, ativa INTEGER NOT NULL DEFAULT 1, criada_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS funcoes (
  id TEXT PRIMARY KEY, empresa_id TEXT NOT NULL REFERENCES empresas(id), nome TEXT NOT NULL, estrutura TEXT NOT NULL,
  origem TEXT NOT NULL, tempo_ativo_s INTEGER NOT NULL DEFAULT 0, arquivada INTEGER NOT NULL DEFAULT 0,
  criada_em TEXT NOT NULL, atualizada_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS funcoes_empresa ON funcoes(empresa_id, arquivada);
CREATE TABLE IF NOT EXISTS ocupantes (
  id TEXT PRIMARY KEY, funcao_id TEXT NOT NULL REFERENCES funcoes(id) ON DELETE CASCADE, apelido TEXT NOT NULL,
  niveis TEXT NOT NULL DEFAULT '{}', prazo_dias INTEGER NOT NULL DEFAULT 14, tempo_ativo_s INTEGER NOT NULL DEFAULT 0,
  arquivado INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ocupantes_funcao ON ocupantes(funcao_id, arquivado);
CREATE TABLE IF NOT EXISTS execucoes (
  id TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK (tipo IN ('trilha', 'diagnostico', 'extracao')),
  empresa_id TEXT NOT NULL REFERENCES empresas(id), funcao_id TEXT REFERENCES funcoes(id),
  ocupante_id TEXT REFERENCES ocupantes(id), criada_por TEXT NOT NULL REFERENCES usuarios(id), criada_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS execucoes_ocupante ON execucoes(ocupante_id, criada_em);
CREATE TABLE IF NOT EXISTS avaliacoes_uso (
  funcao_id TEXT PRIMARY KEY REFERENCES funcoes(id), nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT NOT NULL DEFAULT '', criada_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ferramentas_ia (
  id TEXT PRIMARY KEY, empresa_id TEXT NOT NULL REFERENCES empresas(id), nome TEXT NOT NULL, criada_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ferramentas_empresa ON ferramentas_ia(empresa_id);
CREATE TABLE IF NOT EXISTS modelos_funcao (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '', estrutura TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1, atualizado_em TEXT NOT NULL);
`;

export function transacao<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (erro) {
    db.exec('ROLLBACK');
    throw erro;
  }
}

export function prepararBanco(db: DatabaseSync): DatabaseSync {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(ESQUEMA);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM catalogo_acoes WHERE empresa_id IS NULL').get() as { n: number };
  if (Number(n) === 0) {
    const inserir = db.prepare('INSERT INTO catalogo_acoes (id, empresa_id, eixo, acao, recurso, custo, ativa, criada_em) VALUES (?, NULL, ?, ?, ?, ?, 1, ?)');
    const agora = new Date().toISOString();
    transacao(db, () => {
      for (const a of CATALOGO_BASE) inserir.run(crypto.randomUUID(), a.eixo, a.acao, a.recurso, a.custo, agora);
    });
  }
  return db;
}

export const caminhoBanco = (): string => path.join(process.cwd(), 'data', 'sessions.sqlite');

const estado = globalThis as typeof globalThis & { mrccBanco?: DatabaseSync };

export function db(): DatabaseSync {
  if (!estado.mrccBanco) {
    mkdirSync(path.dirname(caminhoBanco()), { recursive: true, mode: 0o700 });
    estado.mrccBanco = prepararBanco(new DatabaseSync(caminhoBanco()));
  }
  return estado.mrccBanco;
}
