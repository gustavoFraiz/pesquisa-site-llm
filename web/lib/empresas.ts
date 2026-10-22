import type { DatabaseSync } from 'node:sqlite';
import { definirSenha, inserirUsuario, normalizarEmail } from './auth.ts';
import { transacao } from './db.ts';
import { HttpErro } from './http.ts';
import { gerarSenhaTemporaria, hashSenha } from './senha.ts';

export type ResumoEmpresa = {
  id: string; nome: string; cidade: string; segmento: string; ativa: boolean; criadaEm: string;
  emailGestor: string | null; ultimoAcesso: string | null; funcoes: number; ocupantes: number; trilhas: number;
};

function obrigatorio(v: unknown, campo: string, max = 120): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new HttpErro(400, `Informe ${campo} (até ${max} caracteres).`);
  return v.trim();
}

function opcional(v: unknown, campo: string, max = 120): string {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string' || v.trim().length > max) throw new HttpErro(400, `${campo} pode ter até ${max} caracteres.`);
  return v.trim();
}

export async function criarEmpresaComGestor(db: DatabaseSync, dados: Record<string, unknown>, agora = Date.now()): Promise<{ empresaId: string; email: string; senhaTemporaria: string }> {
  const nome = obrigatorio(dados.nome, 'o nome da loja');
  const cidade = opcional(dados.cidade, 'A cidade');
  const segmento = opcional(dados.segmento, 'O segmento');
  const email = normalizarEmail(dados.email);
  if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email)) throw new HttpErro(409, 'Já existe um usuário com este e-mail.');
  const senhaTemporaria = gerarSenhaTemporaria();
  const senhaHash = await hashSenha(senhaTemporaria);
  const empresaId = crypto.randomUUID();
  transacao(db, () => {
    db.prepare('INSERT INTO empresas (id, nome, cidade, segmento, ativa, criada_em) VALUES (?, ?, ?, ?, 1, ?)')
      .run(empresaId, nome, cidade, segmento, new Date(agora).toISOString());
    inserirUsuario(db, { email, senhaHash, papel: 'gestor', empresaId, trocarSenha: true }, agora);
  });
  return { empresaId, email, senhaTemporaria };
}

type LinhaEmpresa = {
  id: string; nome: string; cidade: string; segmento: string; ativa: number; criada_em: string;
  email_gestor: string | null; ultimo_acesso: string | null; funcoes: number; ocupantes: number; trilhas: number;
};

export function listarEmpresas(db: DatabaseSync): ResumoEmpresa[] {
  const linhas = db.prepare(`SELECT e.id, e.nome, e.cidade, e.segmento, e.ativa, e.criada_em,
      u.email AS email_gestor, u.ultimo_acesso,
      (SELECT COUNT(*) FROM funcoes f WHERE f.empresa_id = e.id AND f.arquivada = 0) AS funcoes,
      (SELECT COUNT(*) FROM ocupantes o JOIN funcoes f ON f.id = o.funcao_id
        WHERE f.empresa_id = e.id AND f.arquivada = 0 AND o.arquivado = 0) AS ocupantes,
      (SELECT COUNT(*) FROM execucoes x WHERE x.empresa_id = e.id AND x.tipo = 'trilha') AS trilhas
    FROM empresas e LEFT JOIN usuarios u ON u.empresa_id = e.id AND u.papel = 'gestor'
    ORDER BY e.nome COLLATE NOCASE`).all() as LinhaEmpresa[];
  return linhas.map(l => ({
    id: l.id, nome: l.nome, cidade: l.cidade, segmento: l.segmento, ativa: Number(l.ativa) === 1, criadaEm: l.criada_em,
    emailGestor: l.email_gestor, ultimoAcesso: l.ultimo_acesso,
    funcoes: Number(l.funcoes), ocupantes: Number(l.ocupantes), trilhas: Number(l.trilhas),
  }));
}

export function definirEmpresaAtiva(db: DatabaseSync, empresaId: string, ativa: boolean): void {
  const r = db.prepare('UPDATE empresas SET ativa = ? WHERE id = ?').run(ativa ? 1 : 0, empresaId);
  if (Number(r.changes) === 0) throw new HttpErro(404, 'Empresa não encontrada.');
  if (!ativa) db.prepare('DELETE FROM auth_sessoes WHERE usuario_id IN (SELECT id FROM usuarios WHERE empresa_id = ?)').run(empresaId);
}

export async function redefinirSenhaGestor(db: DatabaseSync, empresaId: string): Promise<string> {
  const gestor = db.prepare("SELECT id FROM usuarios WHERE empresa_id = ? AND papel = 'gestor'").get(empresaId) as { id: string } | undefined;
  if (!gestor) throw new HttpErro(404, 'Empresa não encontrada.');
  const senha = gerarSenhaTemporaria();
  await definirSenha(db, gestor.id, senha, true);
  return senha;
}
