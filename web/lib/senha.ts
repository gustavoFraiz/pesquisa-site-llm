import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { HttpErro } from './http.ts';

// OWASP: N=2^17, r=8, p=1. Os parâmetros ficam no hash para permitir ajuste futuro.
const PARAMETROS = { N: 2 ** 17, r: 8, p: 1 };
const TAMANHO = 32;
const MAXMEM = 256 * 1024 * 1024;

function derivar(senha: string, sal: Buffer, p: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha.normalize('NFKC'), sal, TAMANHO, { ...p, maxmem: MAXMEM }, (erro, chave) => (erro ? reject(erro) : resolve(chave)));
  });
}

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const chave = await derivar(senha, sal, PARAMETROS);
  return ['scrypt', PARAMETROS.N, PARAMETROS.r, PARAMETROS.p, sal.toString('base64'), chave.toString('base64')].join('$');
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  const partes = hash.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [N, r, p] = partes.slice(1, 4).map(Number);
  if (![N, r, p].every(n => Number.isSafeInteger(n) && n > 0)) return false;
  const esperado = Buffer.from(partes[5], 'base64');
  try {
    const obtido = await derivar(senha, Buffer.from(partes[4], 'base64'), { N, r, p });
    return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
  } catch {
    return false;
  }
}

export function validarNovaSenha(senha: unknown): string {
  if (typeof senha !== 'string' || senha.length < 8 || senha.length > 200) throw new HttpErro(400, 'A senha precisa ter entre 8 e 200 caracteres.');
  return senha;
}

const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function gerarSenhaTemporaria(): string {
  const limite = 256 - (256 % ALFABETO.length); // evita viés de módulo
  let senha = '';
  while (senha.length < 12) {
    for (const byte of randomBytes(16)) {
      if (byte < limite && senha.length < 12) senha += ALFABETO[byte % ALFABETO.length];
    }
  }
  return senha;
}
