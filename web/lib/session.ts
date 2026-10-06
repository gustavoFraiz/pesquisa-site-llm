import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';

const state = globalThis as typeof globalThis & { mrccDb?: DatabaseSync };
const lifetime = 30 * 24 * 60 * 60;
const cookieName = 'mrcc_session';
export function db() {
  if (!state.mrccDb) {
    const dir = path.join(process.cwd(), 'data');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    state.mrccDb = new DatabaseSync(path.join(dir, 'sessions.sqlite'));
    state.mrccDb.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL, draft TEXT, current_job TEXT);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS jobs_session ON jobs(session_id, created_at);`);
  }
  return state.mrccDb;
}
type Session = { id: string; draft: string | null; current_job: string | null };
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export async function getSession(create = false): Promise<Session> {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  const existing = token && /^[a-f0-9]{64}$/.test(token)
    ? db().prepare('SELECT id, draft, current_job FROM sessions WHERE token_hash=? AND expires>?').get(hash(token), Date.now()) as Session | undefined : undefined;
  if (existing) return existing;
  if (!create) throw new Error('Sua sessão expirou. Recarregue a página para começar novamente.');
  const secret = randomBytes(32).toString('hex');
  const id = randomUUID();
  db().prepare('INSERT INTO sessions (id, token_hash, expires) VALUES (?, ?, ?)').run(id, hash(secret), Date.now() + lifetime * 1000);
  jar.set(cookieName, secret, { httpOnly: true, sameSite: 'lax', secure: process.env.MRCC_SECURE_COOKIE === '1', path: '/', maxAge: lifetime });
  return { id, draft: null, current_job: null };
}
export function assertOwner(id: string, sessionId: string) {
  if (!db().prepare('SELECT id FROM jobs WHERE id=? AND session_id=?').get(id, sessionId)) throw new Error('Análise não encontrada nesta sessão.');
}
export function history(sessionId: string) {
  return db().prepare('SELECT id, created_at AS createdAt FROM jobs WHERE session_id=? ORDER BY created_at DESC LIMIT 10').all(sessionId);
}
