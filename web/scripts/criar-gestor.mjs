// Cria uma empresa com o login do gestor ou redefine a senha dele. A senha já vale, sem troca no 1º acesso. Execute dentro de web/:
//   node scripts/criar-gestor.mjs gestor@exemplo.com "Nome da loja" [cidade] [segmento]
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { definirSenha, normalizarEmail } from '../lib/auth.ts';
import { caminhoBanco, prepararBanco } from '../lib/db.ts';
import { criarEmpresaComGestor } from '../lib/empresas.ts';
import { validarNovaSenha } from '../lib/senha.ts';
import { lerSenha } from './ler-senha.mjs';

async function main() {
  const [emailInformado, nome, cidade, segmento] = process.argv.slice(2);
  const email = normalizarEmail(emailInformado);
  const senha = validarNovaSenha(await lerSenha('gestor'));
  const arquivo = caminhoBanco();
  mkdirSync(path.dirname(arquivo), { recursive: true, mode: 0o700 });
  const db = prepararBanco(new DatabaseSync(arquivo));
  try {
    const buscar = () => db.prepare('SELECT id, papel FROM usuarios WHERE email = ?').get(email);
    const existente = buscar();
    if (existente && existente.papel !== 'gestor') throw new Error('Este e-mail já pertence a um admin.');
    if (!existente) await criarEmpresaComGestor(db, { nome, cidade, segmento, email });
    await definirSenha(db, buscar().id, senha, false);
    console.log(existente ? `Senha do gestor ${email} redefinida; sessões anteriores encerradas.` : `Empresa "${nome}" criada com o gestor ${email}.`);
  } finally {
    db.close();
  }
}

main().catch(erro => {
  console.error(`Erro: ${erro.message}`);
  process.exit(1);
});
