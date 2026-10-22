// Cria um admin ou redefine a senha dele. Execute dentro de web/:
//   node scripts/criar-admin.mjs admin@exemplo.com
import { createInterface } from 'node:readline';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { caminhoBanco, prepararBanco } from '../lib/db.ts';
import { criarUsuario, definirSenha, normalizarEmail } from '../lib/auth.ts';

function lerLinhas(quantidade) {
  return new Promise(resolve => {
    const linhas = [];
    const leitor = createInterface({ input: process.stdin });
    leitor.on('line', linha => {
      linhas.push(linha);
      if (linhas.length === quantidade) leitor.close();
    });
    leitor.on('close', () => resolve(linhas));
  });
}

function perguntarOculto(pergunta) {
  return new Promise(resolve => {
    const leitor = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(pergunta);
    leitor._writeToOutput = () => {}; // não ecoa a senha digitada
    leitor.question('', resposta => {
      leitor.close();
      process.stdout.write('\n');
      resolve(resposta);
    });
  });
}

async function main() {
  const email = normalizarEmail(process.argv[2]);
  const [senha, confirmacao] = process.stdin.isTTY
    ? [await perguntarOculto('Senha do admin: '), await perguntarOculto('Repita a senha: ')]
    : await lerLinhas(2);
  if (senha !== confirmacao) throw new Error('As senhas não conferem.');
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
