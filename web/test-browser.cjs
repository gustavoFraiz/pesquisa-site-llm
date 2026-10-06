const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');

(async () => {
  const base = process.env.MRCC_TEST_URL || 'https://147.15.89.156';
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, baseURL: base });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__mrccTools = {};
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool(tool, options) {
      window.__mrccTools[tool.name] = tool;
      options.signal.addEventListener('abort', () => { delete window.__mrccTools[tool.name]; });
    } } });
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByLabel('Função analisada')).toBeVisible({ timeout: 45000 });
  await expect(page.getByLabel('Função analisada')).toHaveValue('');
  const cookie = (await context.cookies()).find(c => c.name === 'mrcc_session');
  if (!cookie?.httpOnly || !cookie.secure || cookie.sameSite !== 'Lax') throw new Error('Cookie de sessão sem proteção.');
  const toolData = await page.evaluate(() => window.__mrccTools.read_mrcc_diagnosis.execute({}));
  if (!Array.isArray(toolData.lacunas) || toolData.etapa !== 'Tarefas') throw new Error('Ferramenta opcional de diagnóstico indisponível.');
  await page.getByRole('button', { name: 'Carregar exemplo preenchido' }).click();
  await expect(page.getByLabel('Função analisada')).not.toHaveValue('');
  const role = await page.getByLabel('Função analisada').inputValue();
  await page.getByLabel('Função analisada').fill(`${role} (validação web)`);
  await expect(page.getByText('Rascunho salvo na sua sessão.', { exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByLabel('Função analisada')).toHaveValue(`${role} (validação web)`);
  fs.mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.locator('nav button').nth(1).click();
  await expect(page.getByRole('heading', { name: 'Encontre as lacunas.' })).toBeVisible();
  await page.locator('nav button').nth(2).click();
  await expect(page.getByRole('heading', { name: 'Preserve a qualidade.' })).toBeVisible();
  await page.locator('nav button').nth(3).click();
  await page.getByRole('button', { name: 'Conferir diagnóstico sem gerar a trilha' }).click();
  await expect(page.getByRole('link', { name: 'Baixar planilha' })).toBeVisible({ timeout: 60000 });
  const session = await (await context.request.get('/api/session')).json();
  const jobId = session.currentJob;
  if (!jobId) throw new Error('Análise não foi salva na sessão.');
  const record = await (await context.request.get(`/api/jobs/${jobId}`)).json();
  if (record.status !== 'done' || record.result.plano !== null) throw new Error('Diagnóstico inconsistente.');
  const download = await context.request.get(`/api/jobs/${jobId}/download?type=input`);
  if (!download.ok() || (await download.body()).length < 1000) throw new Error('Exportação falhou.');
  const stranger = await browser.newContext({ baseURL: base });
  await stranger.request.get('/api/session');
  if ((await stranger.request.get(`/api/jobs/${jobId}`)).status() !== 404) throw new Error('Outra sessão acessou o resultado.');
  if ((await stranger.request.get(`/api/jobs/${jobId}/download?type=input`)).status() !== 404) throw new Error('Outra sessão baixou o resultado.');
  const csrf = await context.request.put('/api/session', { headers: { Origin: 'https://example.invalid' }, data: { input: record.input } });
  if (csrf.ok()) throw new Error('Origem externa aceita.');
  await stranger.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('nav button').nth(0).click();
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Interface transborda no celular.');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator('nav button').nth(3).click();
  if (process.env.MRCC_TEST_SKIP_LLM === '1') {
    const noGap = { ...record.input, competencias: record.input.competencias.map(c => ({ ...c, alvo: c.atual })) };
    const response = await context.request.post('/api/jobs', { data: { input: noGap, mode: 'llm' } });
    if (response.status() !== 202) throw new Error('Cenário sem lacunas não iniciou.');
    const emptyJob = await response.json();
    let empty;
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      empty = await (await context.request.get(`/api/jobs/${emptyJob.id}`)).json();
      if (empty.status !== 'running') break;
    }
    if (empty.status !== 'done' || empty.result.plano.recomendacoes.length !== 0) throw new Error('Cenário sem lacunas gerou recomendações indevidas.');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('Não há lacunas positivas nesta rodada. Revise as salvaguardas e acompanhe o trabalho.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Nova análise', exact: true }).click();
    await expect(page.getByLabel('Função analisada')).toHaveValue('');
    if (errors.length) throw new Error(`Erros do navegador: ${errors.join('; ')}`);
    console.log('Interface, sessões, diagnóstico, exportação, celular, ausência de lacunas e ferramentas opcionais passaram. Inferência não repetida.');
    await browser.close(); return;
  }
  await expect(page.getByRole('button', { name: 'Gerar recomendações', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Gerar recomendações', exact: true }).click();
  await expect(page.getByText('Preparando sua trilha', { exact: true })).toBeVisible();
  console.log('Interface, salvamento, diagnóstico, exportação, celular e isolamento de sessões passaram. LLM iniciada.');
  const start = Date.now();
  let final;
  while (Date.now() - start < 2500000) {
    await page.waitForTimeout(15000);
    const state = await (await context.request.get('/api/session')).json();
    final = await (await context.request.get(`/api/jobs/${state.currentJob}`)).json();
    if (final.status !== 'running') break;
    if (Math.round((Date.now() - start) / 15000) % 4 === 0) console.log(`LLM: ${Math.round((Date.now() - start) / 1000)} segundos.`);
  }
  if (final?.status !== 'done' || !final.result?.plano) throw new Error(`LLM falhou: ${JSON.stringify({status: final?.status, error: final?.error})}`);
  if (final.result.plano.recomendacoes.some(p => p.decisao !== 'recomendada')) throw new Error('A LLM se absteve no exemplo preenchido, que possui ações adequadas no catálogo.');
  await expect(page.getByText('Proposta · revisão pendente', { exact: true })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'test-results/recommendations.png', fullPage: true });
  fs.writeFileSync('test-results/llm-result.json', JSON.stringify(final, null, 2));
  if (errors.length) throw new Error(`Erros do navegador: ${errors.join('; ')}`);
  console.log(JSON.stringify({ success: true, recommendations: final.result.plano.recomendacoes.length, seconds: final.result.metadados.tempo_segundos, jobId: final.id }));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
