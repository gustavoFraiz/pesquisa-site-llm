// Cria um admin ou redefine a senha dele. Execute dentro de web/:
//   node scripts/criar-admin.mjs admin@exemplo.com
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { caminhoBanco, prepararBanco } from '../lib/db.ts';
import { criarUsuario, definirSenha, normalizarEmail } from '../lib/auth.ts';
import { lerSenha } from './ler-senha.mjs';

async function main() {
  const email = normalizarEmail(process.argv[2]);
  const senha = await lerSenha('admin');
  const arquivo = caminhoBanco();
  mkdirSync(path.dirname(arquivo), { recursive: true, mode: 0o700 });
  const db = prepararBanco(new DatabaseSync(arquivo));
  try {
    const existente = db.prepare('SELECT id, papel FROM usuarios WHERE email = ?').get(email);
    if (existente && existente.papel !== 'admin') throw new Error('Este e-mail já pertence ao gestor de uma empresa.');
    if (existente) {
      await definirSenha(db, existente.id, senha, false);
      console.log(`Senha do admin ${email} redefinida; sessões anteriores encerradas.`);
    } else {
      await criarUsuario(db, { email, senha, papel: 'admin', empresaId: null, trocarSenha: false });
      console.log(`Admin ${email} criado.`);
    }
  } finally {
    db.close();
  }
}

main().catch(erro => {
  console.error(`Erro: ${erro.message}`);
  process.exit(1);
});
