// Lê a senha duas vezes: sem eco no terminal, ou linha a linha quando vem de um pipe.
import { createInterface } from 'node:readline';

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

export async function lerSenha(rotulo) {
  const [senha, confirmacao] = process.stdin.isTTY
    ? [await perguntarOculto(`Senha do ${rotulo}: `), await perguntarOculto('Repita a senha: ')]
    : await lerLinhas(2);
  if (senha !== confirmacao) throw new Error('As senhas não conferem.');
  return senha;
}
