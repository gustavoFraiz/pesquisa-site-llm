import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarSenhaTemporaria, hashSenha, validarNovaSenha, verificarSenha } from './senha.ts';

test('gera hash scrypt com parâmetros registrados e verifica a senha', async () => {
  const hash = await hashSenha('cavalo correto bateria');
  assert.match(hash, /^scrypt\$131072\$8\$1\$/);
  assert.equal(await verificarSenha('cavalo correto bateria', hash), true);
  assert.equal(await verificarSenha('cavalo errado', hash), false);
  assert.notEqual(await hashSenha('cavalo correto bateria'), hash);
});

test('hash malformado nunca autentica', async () => {
  assert.equal(await verificarSenha('x', 'md5$abc'), false);
  assert.equal(await verificarSenha('x', 'scrypt$a$b$c$d$e'), false);
});

test('senha temporária tem 12 caracteres sem letras ambíguas', () => {
  for (let i = 0; i < 50; i++) assert.match(gerarSenhaTemporaria(), /^[a-hjkmnp-zA-HJKMNP-Z2-9]{12}$/);
});

test('nova senha precisa ter de 8 a 200 caracteres', () => {
  assert.throws(() => validarNovaSenha('curta'), { status: 400 });
  assert.throws(() => validarNovaSenha(12345678), { status: 400 });
  assert.equal(validarNovaSenha('12345678'), '12345678');
});
