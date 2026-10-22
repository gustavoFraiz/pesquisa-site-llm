// Roteiro de ponta a ponta do gestor. Uso (dentro de web/, com o site rodando):
//   MRCC_TEST_EMAIL=gestor@local.test MRCC_TEST_SENHA=gestor-local-123 node test-browser.cjs
// O gestor precisa já ter trocado a senha temporária. Para outro endereço, defina MRCC_TEST_URL.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');

(async () => {
  const base = process.env.MRCC_TEST_URL || 'http://localhost:3000';
  const email = process.env.MRCC_TEST_EMAIL;
  const senha = process.env.MRCC_TEST_SENHA;
  if (!email || !senha) throw new Error('Defina MRCC_TEST_EMAIL e MRCC_TEST_SENHA (gestor com senha já trocada).');
  const browser = await chromium.launch({ executablePath: process.env.MRCC_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Funções da loja' })).toBeVisible();
  const cookie = (await context.cookies()).find(c => c.name === 'mrcc_auth');
  if (!cookie?.httpOnly || cookie.sameSite !== 'Lax') throw new Error('Cookie de sessão sem proteção.');

  await page.getByRole('link', { name: '+ Nova função' }).click();
  const nome = `Validação web ${Date.now()}`;
  await page.locator('form', { hasText: 'Em branco' }).getByLabel('Nome da função').fill(nome);
  await page.getByRole('button', { name: 'Começar em branco' }).click();
  await expect(page.getByRole('heading', { name: 'Entenda o trabalho.' })).toBeVisible();
  await page.getByLabel('Tarefa', { exact: true }).fill('Montar orçamento para o cliente');
  await page.getByRole('radio', { name: 'A IA ajuda (P)' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: '+ Adicionar competência' }).click();
  await page.getByLabel('Competência', { exact: true }).fill('Proficiência na ferramenta de orçamento');
  await page.getByRole('button', { name: /Ocupantes/ }).click();
  await expect(page.getByText('Alterações salvas.')).toBeVisible();
  await page.getByLabel('Apelido do ocupante').fill('Atendente 1');
  await page.getByRole('button', { name: 'Adicionar ocupante' }).click();
  await expect(page.getByRole('heading', { name: 'Atendente 1' })).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Usa a ferramenta nesta tarefa?' }).getByRole('radio', { name: 'Sim' }).click();
  await page.getByRole('radiogroup', { name: /Usa sem instruções prontas/ }).getByRole('radio', { name: 'Não' }).click();
  await expect(page.getByText('N1 - Usuário assistido —')).toBeVisible();
  // Corrigir uma resposta mantém as anteriores e mostra a pergunta seguinte.
  await page.getByRole('radiogroup', { name: /Usa sem instruções prontas/ }).getByRole('radio', { name: 'Sim' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Usa a ferramenta nesta tarefa?' }).getByRole('radio', { name: 'Sim' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radiogroup', { name: /Percebe erros da ferramenta/ }).getByRole('radio', { name: 'Não' }).click();
  await expect(page.getByText('N2 - Usuário autônomo —')).toBeVisible();
  await page.getByRole('button', { name: 'Conferir diagnóstico sem gerar a trilha' }).click();
  await expect(page.getByRole('link', { name: 'Baixar planilha' })).toBeVisible({ timeout: 60000 });
  fs.mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/ocupante.png', fullPage: true });

  // Voltar do navegador não pode mostrar (nem regravar) a versão antiga da função.
  await page.goBack();
  await expect(page.getByLabel('Tarefa', { exact: true })).toHaveValue('Montar orçamento para o cliente', { timeout: 15000 });
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Atendente 1' })).toBeVisible();
  // Recarregar a página do ocupante mostra a última geração.
  await page.reload();
  await expect(page.getByRole('link', { name: 'Baixar planilha' })).toBeVisible({ timeout: 30000 });

  await page.goto('/');
  await expect(page.getByRole('link', { name: new RegExp(nome) })).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Fluxo do gestor verificado.');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
