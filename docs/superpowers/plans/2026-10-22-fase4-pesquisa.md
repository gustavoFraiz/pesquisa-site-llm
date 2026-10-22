# Fase 4 — Pesquisa: síntese, leitura pelo admin e métricas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao grupo os dados para os indicadores do Quadro 7 do PBL3: o admin lê cada empresa (somente leitura) por uma **síntese por função** (que também atende o RF12 para o gestor), vê um painel de **métricas automáticas** por função com exportação **CSV**, e o gestor responde uma **avaliação de facilidade** (1–5) depois da primeira trilha.

**Architecture:** Cálculo das métricas em módulo puro (`lib/metricas.ts`, testado com `node --test`); coleta dos dados no banco e nos `analise.json`/`extracao.json` das execuções por um módulo com leitor injetável (`lib/metricas-dados.ts`). A síntese é um Server Component somente leitura usado pelo admin e pelo gestor. Uma tabela nova e aditiva: `avaliacoes_uso`.

**Tech Stack:** Node 24, Next.js 16, `node:sqlite`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-15-contas-e-celeridade-design.md` (§11, §15 fase 4; RF12 do PBL3).

## Global Constraints

- Nenhuma dependência nova. Esquema só aditivo.
- O admin só **lê** dados das empresas; nenhuma rota nova permite ao admin alterar funções, ocupantes ou execuções.
- CSV: UTF-8 com BOM, separador `;`, decimal com vírgula, campos com `;`, aspas ou quebra de linha entre aspas (aspas internas duplicadas). Abre direto no Excel pt-BR.
- Métricas incluem funções e ocupantes arquivados (o arquivamento existe justamente para preservar o histórico da pesquisa), marcados como tal.
- Indicadores que dependem de observação de campo (descoberta de impacto, convergência gestor × ocupante, autonomia de preenchimento, ação iniciada em 30 dias) **não** são calculados; a página diz isso.
- Commits em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Texto com `;`, aspas ou quebra de linha no nome da função/empresa.** Esperado: o CSV continua com as colunas no lugar. Teste na Task 1 (`paraCsv`).
2. **Função sem nenhum ocupante, ou ocupante sem trilha concluída.** Esperado: colunas de trilha vazias ("—"), sem erro e sem dividir por zero. Teste na Task 1.
3. **`analise.json` ausente ou corrompido (execução com erro, disco).** Esperado: a execução é ignorada na métrica, a página abre. Teste na Task 2 (leitor que devolve `null`/lança).
4. **Gestor tenta avaliar a função de outra loja ou mandar nota 7.** Esperado: 404 e 400. Teste na Task 2.
5. **Admin abre a síntese de uma função arquivada.** Esperado: abre, com a marca "Arquivada". Verificação manual na Task 3.

---

### Task 1: Cálculo das métricas e CSV (módulo puro)

**Files:**
- Create: `web/lib/metricas.ts`
- Test: `web/lib/metricas.test.ts`

**Interfaces:**
- Consumes: `Estrutura` (fase 1); `exemploAtendente` (fase 1, testes).
- Produces (`lib/metricas.ts`):

```ts
export type TrilhaResumo = { ocupante: string; priorizadas: number; recomendacoes: { decisao: string; prazo: number | null; criterio: string | null }[] };
export type DadosMetrica = {
  empresa: string; funcao: string; origem: string; criadaEm: string; arquivada: boolean;
  estrutura: Estrutura; tempoEstruturaS: number; tempoPrimeiroOcupanteS: number | null;
  ocupantesAtivos: number; trilhasGeradas: number; ultimasTrilhas: TrilhaResumo[]; notas: number[];
};
export type LinhaMetrica = { /* chaves de COLUNAS */ [chave: string]: string | number | null };
export const COLUNAS: { chave: string; titulo: string }[];
export function calcularMetrica(d: DadosMetrica): LinhaMetrica;
export function paraCsv(linhas: LinhaMetrica[]): string;
```

Colunas (nesta ordem): `empresa` Empresa · `funcao` Função · `situacao` Situação (Ativa/Arquivada) · `origem` Origem (branco, modelo, cópia, planilha, texto/IA — o prefixo antes de `:`) · `criadaEm` Criada em (AAAA-MM-DD) · `tempoEstruturaMin` Tempo da estrutura (min) · `tempoPrimeiroOcupanteMin` Tempo do 1º ocupante (min) · `tempoTotalMin` Tempo total (min) · `ate90min` Até 90 min (RNF01) · `coberturaEfeitoPct` Tarefas com efeito (%) · `tarefas` Tarefas · `competencias` Competências · `perdemCentralidade` Perdem centralidade (RF07) · `lacunasPorOcupante` Lacunas priorizadas por ocupante · `densidadeMinima3` Todos com ≥ 3 lacunas (OE2) · `completudeTrilhaPct` Propostas com prazo e critério (%) · `diretrizUsoCritico` Diretriz de uso crítico (OE5) · `alertaPreservacao` Variedade e autonomia ambas "Não" (OE5) · `facilidadeMedia` Facilidade percebida (1–5) · `avaliacoes` Avaliações · `tarefasPorOrigem` Tarefas por origem · `competenciasPorOrigem` Competências por origem · `tarefasEditadasPct` Tarefas editadas após sugestão (%) · `competenciasEditadasPct` Competências editadas após sugestão (%) · `ocupantes` Ocupantes ativos · `trilhas` Trilhas geradas.

Regras: minutos com 1 casa; `ate90min` = "—" sem ocupante, senão Sim/Não para `tempoTotal ≤ 90`; percentuais inteiros (arredondados) ou `null` quando o denominador é zero; "editadas após sugestão" considera só itens com origem diferente de `manual`; `diretrizUsoCritico` = Sim se a âncora 6 for "Sim" ou tiver ajuste; `lacunasPorOcupante` = `"Atendente 1: 3; Atendente 2: 1"`; `densidadeMinima3` = "—" sem trilha.

- [ ] **Step 1: Escrever os testes que falham**

Crie `web/lib/metricas.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exemploAtendente } from './apoio-testes.ts';
import { calcularMetrica, COLUNAS, paraCsv, type DadosMetrica } from './metricas.ts';

function dados(extra: Partial<DadosMetrica> = {}): DadosMetrica {
  const { estrutura } = exemploAtendente();
  estrutura.tarefas[0] = { ...estrutura.tarefas[0], origem: 'modelo', editada: true };
  estrutura.tarefas[1] = { ...estrutura.tarefas[1], origem: 'modelo' };
  return {
    empresa: 'Loja; "Central"', funcao: 'Atendente\nde balcão', origem: 'modelo:abc', criadaEm: '2026-10-20T10:00:00.000Z', arquivada: false,
    estrutura, tempoEstruturaS: 1800, tempoPrimeiroOcupanteS: 900, ocupantesAtivos: 2, trilhasGeradas: 3,
    ultimasTrilhas: [
      { ocupante: 'Atendente 1', priorizadas: 3, recomendacoes: [{ decisao: 'recomendada', prazo: 14, criterio: 'x' }, { decisao: 'sem_acao_adequada', prazo: null, criterio: null }] },
      { ocupante: 'Atendente 2', priorizadas: 1, recomendacoes: [{ decisao: 'recomendada', prazo: 14, criterio: 'y' }] },
    ],
    notas: [4, 5], ...extra,
  };
}

test('calcula os indicadores da função de exemplo', () => {
  const m = calcularMetrica(dados());
  assert.deepEqual(
    [m.situacao, m.origem, m.criadaEm, m.tempoEstruturaMin, m.tempoPrimeiroOcupanteMin, m.tempoTotalMin, m.ate90min],
    ['Ativa', 'modelo', '2026-10-20', 30, 15, 45, 'Sim']);
  assert.deepEqual([m.coberturaEfeitoPct, m.tarefas, m.competencias, m.perdemCentralidade], [100, 4, 4, 0]);
  assert.deepEqual([m.lacunasPorOcupante, m.densidadeMinima3, m.completudeTrilhaPct], ['Atendente 1: 3; Atendente 2: 1', 'Não', 67]);
  assert.deepEqual([m.diretrizUsoCritico, m.alertaPreservacao, m.facilidadeMedia, m.avaliacoes], ['Sim', 'Não', 4.5, 2]);
  assert.deepEqual([m.tarefasPorOrigem, m.competenciasPorOrigem, m.tarefasEditadasPct, m.competenciasEditadasPct], ['modelo: 2; planilha: 2', 'planilha: 4', 25, 0]);
  assert.deepEqual([m.ocupantes, m.trilhas], [2, 3]);
});

test('sem ocupante e sem trilha não divide por zero', () => {
  const { estrutura } = exemploAtendente();
  estrutura.tarefas[0].efeito_ia = null;
  estrutura.salvaguardas[0].resposta = 'Não';
  estrutura.salvaguardas[3].resposta = 'Não';
  estrutura.salvaguardas[5] = { ...estrutura.salvaguardas[5], resposta: 'Não sei', ajuste: '' };
  const m = calcularMetrica(dados({ estrutura, tempoPrimeiroOcupanteS: null, ultimasTrilhas: [], notas: [], arquivada: true }));
  assert.deepEqual([m.situacao, m.ate90min, m.tempoTotalMin, m.coberturaEfeitoPct], ['Arquivada', '—', 30, 75]);
  assert.deepEqual([m.lacunasPorOcupante, m.densidadeMinima3, m.completudeTrilhaPct, m.facilidadeMedia], ['—', '—', null, null]);
  assert.deepEqual([m.diretrizUsoCritico, m.alertaPreservacao], ['Não', 'Sim']);
});

test('CSV abre no Excel pt-BR e protege separadores', () => {
  const csv = paraCsv([calcularMetrica(dados())]);
  assert.ok(csv.startsWith('﻿'));
  const [cabecalho, linha] = csv.slice(1).split('\r\n');
  assert.equal(cabecalho.split(';').length, COLUNAS.length);
  assert.ok(linha.startsWith('"Loja; ""Central""";"Atendente\nde balcão";Ativa;modelo;2026-10-20;30;15;45;Sim;'));
  assert.ok(linha.includes(';4,5;2;'));
  assert.equal(paraCsv([]).slice(1).split('\r\n').length, 2);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `metricas.ts`.

- [ ] **Step 3: Implementar `web/lib/metricas.ts`**

```ts
import type { Estrutura } from './estrutura.ts';

export type TrilhaResumo = { ocupante: string; priorizadas: number; recomendacoes: { decisao: string; prazo: number | null; criterio: string | null }[] };
export type DadosMetrica = {
  empresa: string; funcao: string; origem: string; criadaEm: string; arquivada: boolean;
  estrutura: Estrutura; tempoEstruturaS: number; tempoPrimeiroOcupanteS: number | null;
  ocupantesAtivos: number; trilhasGeradas: number; ultimasTrilhas: TrilhaResumo[]; notas: number[];
};
export type LinhaMetrica = Record<string, string | number | null>;

export const COLUNAS: { chave: string; titulo: string }[] = [
  ['empresa', 'Empresa'], ['funcao', 'Função'], ['situacao', 'Situação'], ['origem', 'Origem'], ['criadaEm', 'Criada em'],
  ['tempoEstruturaMin', 'Tempo da estrutura (min)'], ['tempoPrimeiroOcupanteMin', 'Tempo do 1º ocupante (min)'], ['tempoTotalMin', 'Tempo total (min)'],
  ['ate90min', 'Até 90 min (RNF01)'], ['coberturaEfeitoPct', 'Tarefas com efeito (%)'], ['tarefas', 'Tarefas'], ['competencias', 'Competências'],
  ['perdemCentralidade', 'Perdem centralidade (RF07)'], ['lacunasPorOcupante', 'Lacunas priorizadas por ocupante'], ['densidadeMinima3', 'Todos com ≥ 3 lacunas (OE2)'],
  ['completudeTrilhaPct', 'Propostas com prazo e critério (%)'], ['diretrizUsoCritico', 'Diretriz de uso crítico (OE5)'],
  ['alertaPreservacao', 'Variedade e autonomia ambas "Não" (OE5)'], ['facilidadeMedia', 'Facilidade percebida (1–5)'], ['avaliacoes', 'Avaliações'],
  ['tarefasPorOrigem', 'Tarefas por origem'], ['competenciasPorOrigem', 'Competências por origem'],
  ['tarefasEditadasPct', 'Tarefas editadas após sugestão (%)'], ['competenciasEditadasPct', 'Competências editadas após sugestão (%)'],
  ['ocupantes', 'Ocupantes ativos'], ['trilhas', 'Trilhas geradas'],
].map(([chave, titulo]) => ({ chave, titulo }));

const minutos = (s: number) => Math.round(s / 6) / 10;
const pct = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : null);
const porOrigem = (itens: { origem: string }[]) => {
  const contagem = new Map<string, number>();
  for (const i of itens) contagem.set(i.origem, (contagem.get(i.origem) ?? 0) + 1);
  return [...contagem].sort(([a], [b]) => a.localeCompare(b)).map(([o, n]) => `${o}: ${n}`).join('; ') || '—';
};
const editadas = (itens: { origem: string; editada: boolean }[]) => {
  const sugeridas = itens.filter(i => i.origem !== 'manual');
  return pct(sugeridas.filter(i => i.editada).length, sugeridas.length);
};

export function calcularMetrica(d: DadosMetrica): LinhaMetrica {
  const e = d.estrutura;
  const total = d.tempoEstruturaS + (d.tempoPrimeiroOcupanteS ?? 0);
  const recomendacoes = d.ultimasTrilhas.flatMap(t => t.recomendacoes);
  const completas = recomendacoes.filter(r => r.decisao === 'recomendada' && r.prazo !== null && r.criterio !== null).length;
  const ancora = (n: number) => e.salvaguardas[n - 1];
  return {
    empresa: d.empresa, funcao: d.funcao, situacao: d.arquivada ? 'Arquivada' : 'Ativa', origem: d.origem.split(':')[0], criadaEm: d.criadaEm.slice(0, 10),
    tempoEstruturaMin: minutos(d.tempoEstruturaS),
    tempoPrimeiroOcupanteMin: d.tempoPrimeiroOcupanteS === null ? null : minutos(d.tempoPrimeiroOcupanteS),
    tempoTotalMin: minutos(total),
    ate90min: d.tempoPrimeiroOcupanteS === null ? '—' : total <= 90 * 60 ? 'Sim' : 'Não',
    coberturaEfeitoPct: pct(e.tarefas.filter(t => t.efeito_ia).length, e.tarefas.length),
    tarefas: e.tarefas.length, competencias: e.competencias.length, perdemCentralidade: e.perdem_centralidade.length,
    lacunasPorOcupante: d.ultimasTrilhas.length ? d.ultimasTrilhas.map(t => `${t.ocupante}: ${t.priorizadas}`).join('; ') : '—',
    densidadeMinima3: d.ultimasTrilhas.length ? (d.ultimasTrilhas.every(t => t.priorizadas >= 3) ? 'Sim' : 'Não') : '—',
    completudeTrilhaPct: pct(completas, recomendacoes.length),
    diretrizUsoCritico: ancora(6).resposta === 'Sim' || ancora(6).ajuste.trim() ? 'Sim' : 'Não',
    alertaPreservacao: ancora(1).resposta === 'Não' && ancora(4).resposta === 'Não' ? 'Sim' : 'Não',
    facilidadeMedia: d.notas.length ? Math.round((d.notas.reduce((a, b) => a + b, 0) / d.notas.length) * 10) / 10 : null,
    avaliacoes: d.notas.length,
    tarefasPorOrigem: porOrigem(e.tarefas), competenciasPorOrigem: porOrigem(e.competencias),
    tarefasEditadasPct: editadas(e.tarefas), competenciasEditadasPct: editadas(e.competencias),
    ocupantes: d.ocupantesAtivos, trilhas: d.trilhasGeradas,
  };
}

function celula(v: string | number | null): string {
  if (v === null) return '';
  const texto = typeof v === 'number' ? String(v).replace('.', ',') : v;
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function paraCsv(linhas: LinhaMetrica[]): string {
  const cabecalho = COLUNAS.map(c => celula(c.titulo)).join(';');
  const corpo = linhas.map(l => COLUNAS.map(c => celula(l[c.chave] ?? null)).join(';'));
  return `﻿${[cabecalho, ...corpo].join('\r\n')}\r\n`;
}
```

Nota sobre o teste "CSV … `paraCsv([])`": o resultado é BOM + cabeçalho + `\r\n`, que dividido por `\r\n` dá 2 partes (cabeçalho e string vazia).

- [ ] **Step 4: Rodar os testes**

Run: `cd web && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/metricas.ts web/lib/metricas.test.ts
git commit -m "Calcula indicadores do PBL3 por funcao e exporta CSV" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Coleta dos dados e avaliação de facilidade

**Files:**
- Modify: `web/lib/db.ts` (tabela `avaliacoes_uso`)
- Create: `web/lib/metricas-dados.ts`, `web/lib/avaliacoes.ts`
- Test: `web/lib/metricas-dados.test.ts`, `web/lib/avaliacoes.test.ts`
- Create: `web/app/api/funcoes/[id]/avaliacao/route.ts`

**Interfaces:**
- Consumes: `calcularMetrica`, `type DadosMetrica`, `type TrilhaResumo` (Task 1); `obterFuncao` (fase 1); `jobPath` (fase 1).
- Produces:
  - `lib/avaliacoes.ts`: `registrarAvaliacao(db, empresaId, funcaoId, dados: { nota: unknown; comentario: unknown }): void` (nota inteira 1–5; comentário até 500; 404 fora da empresa; uma por função — a segunda substitui a primeira); `avaliacaoPendente(db, funcaoId): boolean`; `notasDaFuncao(db, funcaoId): number[]`.
  - `lib/metricas-dados.ts`:
    - `type Leitor = (execucaoId: string) => unknown | null`;
    - `leitorDeAnalises: Leitor` (lê `web/data/<id>/analise.json` só se `status.json` estiver `concluida`; qualquer falha → `null`);
    - `coletarMetricas(db, ler: Leitor, empresaId?: string): DadosMetrica[]` (funções ativas e arquivadas; última trilha concluída de cada ocupante; tempo do primeiro ocupante criado, mesmo arquivado);
    - `resumoDeExtracoes(db, ler: Leitor): { empresa: string; pedidas: number; concluidas: number; tempoMedioS: number | null; funcoesPorIA: number }[]` (lê `extracao.json` pelo mesmo leitor, que recebe o id e o nome do arquivo — ver código).
  - `POST /api/funcoes/[id]/avaliacao` com `{ nota, comentario }` → `{ ok: true }`.

- [ ] **Step 1: Escrever os testes que falham**

`web/lib/avaliacoes.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { avaliacaoPendente, notasDaFuncao, registrarAvaliacao } from './avaliacoes.ts';
import { estruturaVazia } from './estrutura.ts';
import { criarFuncao } from './funcoes.ts';

test('registra uma avaliação por função, valida nota e respeita a empresa', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const f = criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  assert.equal(avaliacaoPendente(db, f), true);
  assert.throws(() => registrarAvaliacao(db, a, f, { nota: 7, comentario: '' }), { status: 400 });
  assert.throws(() => registrarAvaliacao(db, a, f, { nota: 3.5, comentario: '' }), { status: 400 });
  assert.throws(() => registrarAvaliacao(db, b, f, { nota: 4, comentario: '' }), { status: 404 });
  registrarAvaliacao(db, a, f, { nota: 3, comentario: 'Achei longo' });
  registrarAvaliacao(db, a, f, { nota: 5, comentario: '' });
  assert.equal(avaliacaoPendente(db, f), false);
  assert.deepEqual(notasDaFuncao(db, f), [5]);
});
```

`web/lib/metricas-dados.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, exemploAtendente, inserirEmpresa } from './apoio-testes.ts';
import { registrarAvaliacao } from './avaliacoes.ts';
import { arquivarFuncao, criarFuncao } from './funcoes.ts';
import { coletarMetricas, resumoDeExtracoes } from './metricas-dados.ts';
import { arquivarOcupante, criarOcupante } from './ocupantes.ts';

function cenario() {
  const db = bancoDeTeste();
  const empresa = inserirEmpresa(db, 'Loja Local');
  db.prepare("INSERT INTO usuarios (id, email, senha_hash, papel, empresa_id, criado_em) VALUES ('u1', 'g@l.com', 'x', 'gestor', ?, '2026-10-20')").run(empresa);
  const { nome, estrutura, niveis } = exemploAtendente();
  const funcao = criarFuncao(db, empresa, { nome, estrutura, origem: 'planilha' });
  const primeiro = criarOcupante(db, empresa, funcao, { apelido: 'Primeiro', niveis });
  const segundo = criarOcupante(db, empresa, funcao, { apelido: 'Segundo', niveis });
  db.prepare('UPDATE ocupantes SET tempo_ativo_s = 600 WHERE id = ?').run(primeiro);
  db.prepare('UPDATE funcoes SET tempo_ativo_s = 1200 WHERE id = ?').run(funcao);
  const execucao = (id: string, ocupante: string | null, tipo: string, quando: string) =>
    db.prepare('INSERT INTO execucoes (id, tipo, empresa_id, funcao_id, ocupante_id, criada_por, criada_em) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, tipo, empresa, ocupante ? funcao : null, ocupante, 'u1', quando);
  execucao('t-velha', segundo, 'trilha', '2026-10-20T10:00:00Z');
  execucao('t-nova', segundo, 'trilha', '2026-10-21T10:00:00Z');
  execucao('t-quebrada', primeiro, 'trilha', '2026-10-21T11:00:00Z');
  execucao('x1', null, 'extracao', '2026-10-21T09:00:00Z');
  execucao('x2', null, 'extracao', '2026-10-21T09:30:00Z');
  arquivarOcupante(db, empresa, primeiro);
  registrarAvaliacao(db, empresa, funcao, { nota: 4, comentario: '' });
  return { db, empresa, funcao };
}

const analise = (priorizadas: number) => ({ diagnostico: { priorizadas: Array.from({ length: priorizadas }, () => ({})) }, plano: { recomendacoes: [{ decisao: 'recomendada', prazo_dias_sugerido: 14, criterio_conclusao: 'c' }] } });
const ler = (id: string) => {
  if (id === 't-nova') return analise(3);
  if (id === 't-velha') return analise(1);
  if (id === 't-quebrada') throw new Error('arquivo corrompido');
  if (id === 'x1') return { tarefas: [], metadados: { tempo_segundos: 80 } };
  return null;
};

test('coleta tempos, última trilha concluída por ocupante e notas', () => {
  const { db } = cenario();
  const [d] = coletarMetricas(db, ler);
  assert.deepEqual([d.empresa, d.funcao, d.arquivada, d.tempoEstruturaS, d.tempoPrimeiroOcupanteS, d.ocupantesAtivos, d.trilhasGeradas], ['Loja Local', 'Atendente de balcão', false, 1200, 600, 1, 3]);
  assert.deepEqual(d.ultimasTrilhas, [{ ocupante: 'Segundo', priorizadas: 3, recomendacoes: [{ decisao: 'recomendada', prazo: 14, criterio: 'c' }] }]);
  assert.deepEqual(d.notas, [4]);
});

test('inclui funções arquivadas e filtra por empresa', () => {
  const { db, empresa, funcao } = cenario();
  arquivarFuncao(db, empresa, funcao);
  assert.equal(coletarMetricas(db, ler)[0].arquivada, true);
  assert.deepEqual(coletarMetricas(db, ler, crypto.randomUUID()), []);
});

test('resume as extrações por empresa', () => {
  const { db } = cenario();
  assert.deepEqual(resumoDeExtracoes(db, ler), [{ empresa: 'Loja Local', pedidas: 2, concluidas: 1, tempoMedioS: 80, funcoesPorIA: 0 }]);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `avaliacoes.ts` e `metricas-dados.ts`.

- [ ] **Step 3: Implementar**

Acrescente ao fim da constante `ESQUEMA` em `web/lib/db.ts`:

```sql
CREATE TABLE IF NOT EXISTS avaliacoes_uso (
  funcao_id TEXT PRIMARY KEY REFERENCES funcoes(id), nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT NOT NULL DEFAULT '', criada_em TEXT NOT NULL);
```

`web/lib/avaliacoes.ts`:

```ts
import type { DatabaseSync } from 'node:sqlite';
import { obterFuncao } from './funcoes.ts';
import { HttpErro } from './http.ts';

export function registrarAvaliacao(db: DatabaseSync, empresaId: string, funcaoId: string, dados: { nota: unknown; comentario: unknown }): void {
  obterFuncao(db, empresaId, funcaoId);
  if (typeof dados.nota !== 'number' || !Number.isInteger(dados.nota) || dados.nota < 1 || dados.nota > 5) throw new HttpErro(400, 'Escolha uma nota de 1 a 5.');
  const comentario = typeof dados.comentario === 'string' ? dados.comentario.trim().slice(0, 500) : '';
  db.prepare(`INSERT INTO avaliacoes_uso (funcao_id, nota, comentario, criada_em) VALUES (?, ?, ?, ?)
    ON CONFLICT(funcao_id) DO UPDATE SET nota = excluded.nota, comentario = excluded.comentario, criada_em = excluded.criada_em`)
    .run(funcaoId, dados.nota, comentario, new Date().toISOString());
}

export const avaliacaoPendente = (db: DatabaseSync, funcaoId: string): boolean =>
  !db.prepare('SELECT 1 FROM avaliacoes_uso WHERE funcao_id = ?').get(funcaoId);

export const notasDaFuncao = (db: DatabaseSync, funcaoId: string): number[] =>
  (db.prepare('SELECT nota FROM avaliacoes_uso WHERE funcao_id = ?').all(funcaoId) as { nota: number }[]).map(l => Number(l.nota));
```

`web/lib/metricas-dados.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { notasDaFuncao } from './avaliacoes.ts';
import type { Estrutura } from './estrutura.ts';
import type { DadosMetrica, TrilhaResumo } from './metricas.ts';
import { jobPath } from './server.ts';

export type Leitor = (execucaoId: string) => unknown | null;

/** Lê o resultado de uma execução concluída (analise.json ou extracao.json); qualquer falha vira null. */
export const leitorDeAnalises: Leitor = id => {
  try {
    const pasta = jobPath(id);
    const status = JSON.parse(readFileSync(path.join(pasta, 'status.json'), 'utf8')) as { status: string; tipo: string };
    if (status.status !== 'concluida') return null;
    return JSON.parse(readFileSync(path.join(pasta, status.tipo === 'extracao' ? 'extracao.json' : 'analise.json'), 'utf8')) as unknown;
  } catch {
    return null;
  }
};

const lerSeguro = (ler: Leitor, id: string): unknown | null => {
  try { return ler(id); } catch { return null; }
};

type Analise = { diagnostico?: { priorizadas?: unknown[] }; plano?: { recomendacoes?: { decisao: string; prazo_dias_sugerido: number | null; criterio_conclusao: string | null }[] } | null };

export function coletarMetricas(db: DatabaseSync, ler: Leitor, empresaId?: string): DadosMetrica[] {
  const funcoes = (empresaId
    ? db.prepare('SELECT f.id, f.nome, f.estrutura, f.origem, f.criada_em, f.tempo_ativo_s, f.arquivada, e.nome AS empresa FROM funcoes f JOIN empresas e ON e.id = f.empresa_id WHERE f.empresa_id = ? ORDER BY e.nome, f.criada_em').all(empresaId)
    : db.prepare('SELECT f.id, f.nome, f.estrutura, f.origem, f.criada_em, f.tempo_ativo_s, f.arquivada, e.nome AS empresa FROM funcoes f JOIN empresas e ON e.id = f.empresa_id ORDER BY e.nome, f.criada_em').all()
  ) as { id: string; nome: string; estrutura: string; origem: string; criada_em: string; tempo_ativo_s: number; arquivada: number; empresa: string }[];
  return funcoes.map(f => {
    const ocupantes = db.prepare('SELECT id, apelido, tempo_ativo_s, arquivado FROM ocupantes WHERE funcao_id = ? ORDER BY criado_em, rowid').all(f.id) as { id: string; apelido: string; tempo_ativo_s: number; arquivado: number }[];
    const ultimasTrilhas: TrilhaResumo[] = [];
    for (const o of ocupantes) {
      const execucoes = db.prepare("SELECT id FROM execucoes WHERE ocupante_id = ? AND tipo = 'trilha' ORDER BY criada_em DESC").all(o.id) as { id: string }[];
      for (const x of execucoes) {
        const a = lerSeguro(ler, x.id) as Analise | null;
        if (!a?.plano) continue;
        ultimasTrilhas.push({
          ocupante: o.apelido, priorizadas: a.diagnostico?.priorizadas?.length ?? 0,
          recomendacoes: (a.plano.recomendacoes ?? []).map(r => ({ decisao: r.decisao, prazo: r.prazo_dias_sugerido, criterio: r.criterio_conclusao })),
        });
        break;
      }
    }
    const trilhas = db.prepare("SELECT COUNT(*) AS n FROM execucoes WHERE funcao_id = ? AND tipo = 'trilha'").get(f.id) as { n: number };
    return {
      empresa: f.empresa, funcao: f.nome, origem: f.origem, criadaEm: f.criada_em, arquivada: Number(f.arquivada) === 1,
      estrutura: JSON.parse(f.estrutura) as Estrutura, tempoEstruturaS: Number(f.tempo_ativo_s),
      tempoPrimeiroOcupanteS: ocupantes.length ? Number(ocupantes[0].tempo_ativo_s) : null,
      ocupantesAtivos: ocupantes.filter(o => Number(o.arquivado) === 0).length, trilhasGeradas: Number(trilhas.n),
      ultimasTrilhas, notas: notasDaFuncao(db, f.id),
    };
  });
}

export function resumoDeExtracoes(db: DatabaseSync, ler: Leitor): { empresa: string; pedidas: number; concluidas: number; tempoMedioS: number | null; funcoesPorIA: number }[] {
  const empresas = db.prepare('SELECT id, nome FROM empresas ORDER BY nome COLLATE NOCASE').all() as { id: string; nome: string }[];
  return empresas.flatMap(e => {
    const ids = (db.prepare("SELECT id FROM execucoes WHERE empresa_id = ? AND tipo = 'extracao'").all(e.id) as { id: string }[]).map(x => x.id);
    if (!ids.length) return [];
    const tempos = ids.map(id => (lerSeguro(ler, id) as { metadados?: { tempo_segundos?: number } } | null)?.metadados?.tempo_segundos).filter((t): t is number => typeof t === 'number');
    const porIA = db.prepare("SELECT COUNT(*) AS n FROM funcoes WHERE empresa_id = ? AND origem = 'texto'").get(e.id) as { n: number };
    return [{ empresa: e.nome, pedidas: ids.length, concluidas: tempos.length, tempoMedioS: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null, funcoesPorIA: Number(porIA.n) }];
  });
}
```

`web/app/api/funcoes/[id]/avaliacao/route.ts`:

```ts
import { registrarAvaliacao } from '@/lib/avaliacoes';
import { db } from '@/lib/db';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { nota, comentario } = await lerJson(request, 2000);
    registrarAvaliacao(db(), gestor.empresaId, (await contexto.params).id, { nota, comentario });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd web && npm test && npx tsc --noEmit`
Expected: PASS e nenhum erro de tipo.

- [ ] **Step 5: Commit**

```bash
git add web/lib/db.ts web/lib/avaliacoes.ts web/lib/avaliacoes.test.ts web/lib/metricas-dados.ts web/lib/metricas-dados.test.ts "web/app/api/funcoes/[id]/avaliacao"
git commit -m "Coleta dados das metricas e registra avaliacao de facilidade" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Síntese da função (RF12), leitura pelo admin, painel de métricas e cartão de avaliação

**Files:**
- Create: `web/components/SinteseFuncao.tsx`
- Create: `web/app/(loja)/funcoes/[id]/sintese/page.tsx`
- Create: `web/app/admin/empresas/[id]/page.tsx`, `web/app/admin/empresas/[id]/funcoes/[fid]/page.tsx`
- Create: `web/app/admin/metricas/page.tsx`, `web/app/api/admin/metricas/route.ts`
- Create: `web/components/ocupante/AvaliacaoUso.tsx`
- Modify: `web/components/ocupante/PaginaOcupante.tsx`, `web/app/(loja)/funcoes/[id]/ocupantes/[oid]/page.tsx`
- Modify: `web/components/admin/PainelEmpresas.tsx` (nome da loja vira link), `web/components/admin/NavAdmin.tsx` (link Métricas), `web/components/funcao/EditorFuncao.tsx` (link "Ver síntese")
- Modify: `SITE_WEB.md`

**Interfaces:**
- Consumes: `obterFuncao`, `listarFuncoes` (fase 1; `obterFuncao(db, null, id)` para o admin); `listarOcupantes`, `obterOcupante` (fase 1); `listarExecucoes` (fase 1); `calcularLacunas` (fase 1); `SALVAGUARDAS`; `coletarMetricas`, `resumoDeExtracoes`, `leitorDeAnalises`, `calcularMetrica`, `paraCsv`, `COLUNAS` (Tasks 1–2); `avaliacaoPendente` (Task 2).
- Produces:
  - `SinteseFuncao({ funcao, ocupantes, base })` — Server Component somente leitura: tarefas (efeito em linguagem simples), competências com nível-alvo, perdas de centralidade, salvaguardas (resposta, observação, ajuste), e por ocupante: níveis, lacunas e links para a última trilha (JSON e PDF). `base` é o prefixo dos links (`/api/execucoes`).
  - `/funcoes/[id]/sintese` (gestor), `/admin/empresas/[id]` e `/admin/empresas/[id]/funcoes/[fid]` (admin, inclusive arquivadas).
  - `/admin/metricas` (tabela com filtro `?empresa=<id>`, resumo de extrações e a lista dos indicadores que dependem de campo) e `GET /api/admin/metricas?empresa=<id>` (CSV `metricas-mrcc-pv.csv`).
  - `AvaliacaoUso({ funcaoId })` — cartão dispensável "Como foi preencher esta função?" (1–5 + comentário), mostrado na página do ocupante quando há trilha concluída na tela e a função ainda não foi avaliada.

- [ ] **Step 1: Síntese**

`web/components/SinteseFuncao.tsx`:

```tsx
import { ROTULOS_NIVEL, type Estrutura, type Niveis } from '@/lib/estrutura';
import { calcularLacunas } from '@/lib/lacunas';
import { SALVAGUARDAS } from '@/lib/seed';

const EFEITO: Record<string, string> = { A: 'A IA faz por ele', P: 'A IA ajuda', I: 'Não mudou', N: 'Nova por causa da IA' };
type OcupanteSintese = { id: string; apelido: string; niveis: Niveis; arquivado: boolean; ultimaTrilha: string | null };
type Props = { funcao: { nome: string; estrutura: Estrutura; arquivada: boolean }; ocupantes: OcupanteSintese[] };

export default function SinteseFuncao({ funcao, ocupantes }: Props) {
  const e = funcao.estrutura;
  const tarefa = (id: string) => e.tarefas.find(t => t.id === id)?.tarefa ?? '—';
  return (
    <div className="sintese">
      <div className="page-heading"><div><p className="eyebrow">SÍNTESE DA FUNÇÃO (RF12)</p><h1>{funcao.nome}</h1><p>Mapa de efeitos, competências, salvaguarda e trilhas, em uma página para conversar com a equipe.</p></div>{funcao.arquivada && <span className="badge none">Arquivada</span>}</div>
      <div className="priority-table"><div className="section-title"><h2>Tarefas e efeito da IA</h2></div><div className="table-scroll"><table>
        <thead><tr><th>Tarefa</th><th>Frequência</th><th>Criticidade</th><th>Ferramenta</th><th>Efeito</th></tr></thead>
        <tbody>{e.tarefas.map(t => <tr key={t.id}><td>{t.tarefa}</td><td>{t.frequencia}</td><td>{t.criticidade}</td><td>{t.ferramenta || '—'}</td><td>{t.efeito_ia ? EFEITO[t.efeito_ia] : 'Não classificada'}</td></tr>)}</tbody>
      </table></div></div>
      <div className="priority-table"><div className="section-title"><h2>Competências exigidas</h2></div><div className="table-scroll"><table>
        <thead><tr><th>Competência</th><th>Eixo</th><th>Tarefa</th><th>Nível-alvo</th></tr></thead>
        <tbody>{e.competencias.map(c => <tr key={c.id}><td>{c.competencia}</td><td>{c.eixo}</td><td>{tarefa(c.tarefa_id)}</td><td>{ROTULOS_NIVEL[c.alvo]}</td></tr>)}</tbody>
      </table></div></div>
      {e.perdem_centralidade.length > 0 && <div className="panel"><h2>Deixam de ser centrais</h2>{e.perdem_centralidade.map(p => <p key={p.id}>{p.descricao} <span className="helper">({tarefa(p.tarefa_id)})</span></p>)}</div>}
      <div className="priority-table"><div className="section-title"><h2>Salvaguarda</h2></div><div className="table-scroll"><table>
        <thead><tr><th>Âncora</th><th>Resposta</th><th>Observação</th><th>Ajuste</th></tr></thead>
        <tbody>{SALVAGUARDAS.map(a => { const s = e.salvaguardas[a.numero - 1]; return <tr key={a.numero}><td>{a.ancora}</td><td>{s.resposta}</td><td>{s.observacao || '—'}</td><td>{s.ajuste || '—'}</td></tr>; })}</tbody>
      </table></div></div>
      {ocupantes.map(o => (
        <div className="priority-table" key={o.id}>
          <div className="section-title"><h2>{o.apelido}{o.arquivado ? ' (arquivado)' : ''}</h2>
            {o.ultimaTrilha ? <span className="row-actions"><a className="text-button" href={`/api/execucoes/${o.ultimaTrilha}/download?type=report`}>Última trilha (PDF)</a><a className="text-button" href={`/api/execucoes/${o.ultimaTrilha}/download?type=json`}>JSON</a></span> : <span className="helper">Sem trilha concluída</span>}
          </div>
          <div className="table-scroll"><table>
            <thead><tr><th>Competência</th><th>Níveis</th><th>Lacuna</th><th>Prioridade</th></tr></thead>
            <tbody>{calcularLacunas(e, o.niveis).map(l => <tr key={l.competenciaId}><td>{l.competencia}</td><td>{l.atual ?? '—'} → {l.alvo}</td><td>{l.lacuna ?? '—'}</td><td>{l.prioridade}</td></tr>)}</tbody>
          </table></div>
        </div>
      ))}
    </div>
  );
}
```

Para montar `ocupantes`, crie em `web/lib/ocupantes.ts` (com teste em `web/lib/ocupantes.test.ts`):

```ts
export function ocupantesParaSintese(db: DatabaseSync, empresaId: string | null, funcaoId: string): { id: string; apelido: string; niveis: Niveis; arquivado: boolean; ultimaTrilha: string | null }[] {
  obterFuncao(db, empresaId, funcaoId, true);
  const linhas = db.prepare(`SELECT o.id, o.apelido, o.niveis, o.arquivado,
      (SELECT x.id FROM execucoes x WHERE x.ocupante_id = o.id AND x.tipo = 'trilha' ORDER BY x.criada_em DESC LIMIT 1) AS ultima
    FROM ocupantes o WHERE o.funcao_id = ? ORDER BY o.criado_em`).all(funcaoId) as { id: string; apelido: string; niveis: string; arquivado: number; ultima: string | null }[];
  return linhas.map(l => ({ id: l.id, apelido: l.apelido, niveis: JSON.parse(l.niveis) as Niveis, arquivado: Number(l.arquivado) === 1, ultimaTrilha: l.ultima }));
}
```

Como a síntese do admin precisa abrir funções arquivadas, `obterFuncao` ganha um quarto parâmetro opcional `incluirArquivada = false` (em `web/lib/funcoes.ts`: troque `WHERE id = ? AND arquivada = 0` por `WHERE id = ?${incluirArquivada ? '' : ' AND arquivada = 0'}` e devolva também `arquivada: Number(l.arquivada) === 1`, acrescentando `arquivada` ao `SELECT` e ao tipo `Funcao`). Teste:

```ts
test('síntese lista todos os ocupantes, com a última trilha, e abre função arquivada só quando pedido', () => {
  const { db, a, funcaoId } = cenario();
  const ativo = criarOcupante(db, a, funcaoId, { apelido: 'Ativo' });
  const velho = criarOcupante(db, a, funcaoId, { apelido: 'Velho' });
  arquivarOcupante(db, a, velho);
  arquivarFuncao(db, a, funcaoId);
  assert.throws(() => obterFuncao(db, a, funcaoId), { status: 404 });
  assert.equal(obterFuncao(db, a, funcaoId, true).arquivada, true);
  assert.deepEqual(ocupantesParaSintese(db, a, funcaoId).map(o => [o.id, o.arquivado, o.ultimaTrilha]), [[ativo, false, null], [velho, true, null]]);
});
```

(importe `obterFuncao` de `./funcoes.ts` e `ocupantesParaSintese` de `./ocupantes.ts`). Rode `cd web && npm test` antes (FAIL: `ocupantesParaSintese` não exportado) e depois de implementar (PASS).

- [ ] **Step 2: Páginas da síntese**

`web/app/(loja)/funcoes/[id]/sintese/page.tsx`:

```tsx
import SinteseFuncao from '@/components/SinteseFuncao';
import { db } from '@/lib/db';
import { obterFuncao } from '@/lib/funcoes';
import { ocupantesParaSintese } from '@/lib/ocupantes';
import { exigirPaginaGestor, ou404 } from '@/lib/sessao-web';

export default async function Sintese({ params }: { params: Promise<{ id: string }> }) {
  const gestor = await exigirPaginaGestor();
  const { id } = await params;
  const funcao = ou404(() => obterFuncao(db(), gestor.empresaId, id));
  return (
    <main className="page">
      <a className="text-button" href={`/funcoes/${id}`}>← Voltar à função</a>
      <SinteseFuncao funcao={{ nome: funcao.nome, estrutura: funcao.estrutura, arquivada: funcao.arquivada }} ocupantes={ocupantesParaSintese(db(), gestor.empresaId, id).filter(o => !o.arquivado)} />
    </main>
  );
}
```

`web/app/admin/empresas/[id]/funcoes/[fid]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import SinteseFuncao from '@/components/SinteseFuncao';
import { db } from '@/lib/db';
import { obterFuncao } from '@/lib/funcoes';
import { ocupantesParaSintese } from '@/lib/ocupantes';
import { exigirPagina, ou404 } from '@/lib/sessao-web';

export default async function SinteseAdmin({ params }: { params: Promise<{ id: string; fid: string }> }) {
  await exigirPagina({ papel: 'admin' });
  const { id, fid } = await params;
  const funcao = ou404(() => obterFuncao(db(), null, fid, true));
  if (funcao.empresaId !== id) notFound();
  return (
    <main className="page">
      <a className="text-button" href={`/admin/empresas/${id}`}>← Funções da empresa</a>
      <SinteseFuncao funcao={{ nome: funcao.nome, estrutura: funcao.estrutura, arquivada: funcao.arquivada }} ocupantes={ocupantesParaSintese(db(), null, fid)} />
    </main>
  );
}
```

`web/app/admin/empresas/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { listarEmpresas } from '@/lib/empresas';
import { coletarMetricas, leitorDeAnalises } from '@/lib/metricas-dados';
import { calcularMetrica } from '@/lib/metricas';
import { exigirPagina } from '@/lib/sessao-web';

export default async function EmpresaAdmin({ params }: { params: Promise<{ id: string }> }) {
  await exigirPagina({ papel: 'admin' });
  const { id } = await params;
  const empresa = listarEmpresas(db()).find(e => e.id === id);
  if (!empresa) notFound();
  const funcoes = db().prepare('SELECT id, nome, arquivada FROM funcoes WHERE empresa_id = ? ORDER BY criada_em').all(id) as { id: string; nome: string; arquivada: number }[];
  const metricas = coletarMetricas(db(), leitorDeAnalises, id).map(calcularMetrica);
  return (
    <main className="page">
      <a className="text-button" href="/admin">← Empresas</a>
      <div className="page-heading"><div><p className="eyebrow">EMPRESA · SOMENTE LEITURA</p><h1>{empresa.nome}</h1><p>{[empresa.segmento, empresa.cidade].filter(Boolean).join(' · ')} · gestor {empresa.emailGestor ?? '—'}</p></div><a className="button secondary" href={`/api/admin/metricas?empresa=${id}`}>Baixar CSV</a></div>
      <div className="cards">{funcoes.map((f, i) => (
        <a key={f.id} className="card" href={`/admin/empresas/${id}/funcoes/${f.id}`}>
          <h2>{f.nome}</h2>
          {Number(f.arquivada) === 1 && <span className="badge none">Arquivada</span>}
          <p className="helper">Tempo total: {metricas[i]?.tempoTotalMin ?? '—'} min · tarefas com efeito {metricas[i]?.coberturaEfeitoPct ?? '—'}% · trilhas {metricas[i]?.trilhas ?? 0}</p>
        </a>
      ))}</div>
      {funcoes.length === 0 && <p className="helper">Esta empresa ainda não cadastrou funções.</p>}
    </main>
  );
}
```

(`coletarMetricas` ordena pelas mesmas colunas — `criada_em` — dentro da empresa, por isso os índices batem.)

- [ ] **Step 3: Painel de métricas e CSV**

`web/app/api/admin/metricas/route.ts`:

```ts
import { db } from '@/lib/db';
import { errorResponse } from '@/lib/http';
import { calcularMetrica, paraCsv } from '@/lib/metricas';
import { coletarMetricas, leitorDeAnalises } from '@/lib/metricas-dados';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await exigirUsuario({ papel: 'admin' });
    const empresa = new URL(request.url).searchParams.get('empresa') || undefined;
    const csv = paraCsv(coletarMetricas(db(), leitorDeAnalises, empresa).map(calcularMetrica));
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="metricas-mrcc-pv.csv"', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/app/admin/metricas/page.tsx`:

```tsx
import { db } from '@/lib/db';
import { listarEmpresas } from '@/lib/empresas';
import { calcularMetrica, COLUNAS } from '@/lib/metricas';
import { coletarMetricas, leitorDeAnalises, resumoDeExtracoes } from '@/lib/metricas-dados';
import { exigirPagina } from '@/lib/sessao-web';

export default async function Metricas({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  await exigirPagina({ papel: 'admin' });
  const { empresa } = await searchParams;
  const linhas = coletarMetricas(db(), leitorDeAnalises, empresa || undefined).map(calcularMetrica);
  const extracoes = resumoDeExtracoes(db(), leitorDeAnalises);
  return (
    <main className="page">
      <div className="page-heading"><div><p className="eyebrow">PESQUISA</p><h1>Métricas por função</h1><p>Indicadores do Quadro 7 do PBL3 calculados a partir do uso do site. Tempo = tempo ativo de preenchimento (aba visível e com interação).</p></div>
        <a className="button primary" href={`/api/admin/metricas${empresa ? `?empresa=${empresa}` : ''}`}>Baixar CSV</a></div>
      <form className="role-strip" method="get">
        <label className="field"><span>Empresa</span><select name="empresa" defaultValue={empresa ?? ''}><option value="">Todas</option>{listarEmpresas(db()).map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
        <button className="button secondary">Filtrar</button>
      </form>
      <div className="priority-table"><div className="table-scroll"><table className="tabela-larga">
        <thead><tr>{COLUNAS.map(c => <th key={c.chave}>{c.titulo}</th>)}</tr></thead>
        <tbody>{linhas.map((l, i) => <tr key={i}>{COLUNAS.map(c => <td key={c.chave}>{l[c.chave] ?? '—'}</td>)}</tr>)}</tbody>
      </table></div></div>
      {linhas.length === 0 && <p className="helper">Nenhuma função cadastrada ainda.</p>}
      <div className="priority-table"><div className="section-title"><h2>Uso da descrição com IA</h2></div><div className="table-scroll"><table>
        <thead><tr><th>Empresa</th><th>Pedidas</th><th>Concluídas</th><th>Tempo médio (s)</th><th>Funções criadas pela IA</th></tr></thead>
        <tbody>{extracoes.map(x => <tr key={x.empresa}><td>{x.empresa}</td><td>{x.pedidas}</td><td>{x.concluidas}</td><td>{x.tempoMedioS ?? '—'}</td><td>{x.funcoesPorIA}</td></tr>)}</tbody>
      </table></div></div>
      <div className="alert info"><strong>Indicadores que dependem do campo</strong><p>Descoberta de impacto, convergência gestor × ocupante, autonomia de preenchimento e ação iniciada em 30 dias não são calculados pelo site: registre-os nos instrumentos de campo.</p></div>
    </main>
  );
}
```

Acrescente ao fim de `web/app/globals.css`:

```css
.tabela-larga{min-width:2200px}
.tabela-larga th{white-space:normal;min-width:110px}
.sintese h1{margin-top:9px}
```

- [ ] **Step 4: Cartão de avaliação**

`web/components/ocupante/AvaliacaoUso.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import BotoesOpcao from '@/components/BotoesOpcao';
import { Campo } from '@/components/Campo';

export default function AvaliacaoUso({ funcaoId }: { funcaoId: string }) {
  const [nota, setNota] = useState('');
  const [comentario, setComentario] = useState('');
  const [estado, setEstado] = useState<'aberto' | 'enviado' | 'dispensado'>('aberto');
  const [erro, setErro] = useState('');
  if (estado !== 'aberto') return estado === 'enviado' ? <div className="alert info" role="status">Obrigado! Sua avaliação ajuda a pesquisa.</div> : null;
  const enviar = async () => {
    try {
      await chamarApi(`/api/funcoes/${funcaoId}/avaliacao`, { method: 'POST', json: { nota: Number(nota), comentario } });
      setEstado('enviado');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar.');
    }
  };
  return (
    <div className="panel">
      <h2>Como foi preencher esta função?</h2>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <BotoesOpcao rotulo="1 = muito difícil · 5 = muito fácil" valor={nota} opcoes={['1', '2', '3', '4', '5']} aoMudar={setNota} />
      <Campo rotulo="Comentário (opcional)"><textarea maxLength={500} value={comentario} onChange={e => setComentario(e.target.value)} /></Campo>
      <div className="row-actions">
        <button className="button primary" disabled={!nota} onClick={() => void enviar()}>Enviar</button>
        <button className="text-button" onClick={() => setEstado('dispensado')}>Agora não</button>
      </div>
    </div>
  );
}
```

Em `web/components/ocupante/PaginaOcupante.tsx`:
- importe `AvaliacaoUso from './AvaliacaoUso'`;
- acrescente `avaliacaoPendente: boolean` ao tipo `Props` e desestruture;
- logo depois de `{resultado && execucao && <ResultadoTrilha … />}`, acrescente `{resultado && execucao?.tipo === 'trilha' && avaliacaoPendente && <AvaliacaoUso funcaoId={funcao.id} />}`.

Em `web/app/(loja)/funcoes/[id]/ocupantes/[oid]/page.tsx`, importe `avaliacaoPendente` de `@/lib/avaliacoes` e passe `avaliacaoPendente={avaliacaoPendente(banco, funcao.id)}`.

- [ ] **Step 5: Links**

- `web/components/admin/NavAdmin.tsx`: acrescente `<Link href="/admin/metricas">Métricas</Link>`.
- `web/components/admin/PainelEmpresas.tsx`: troque `<td><strong>{e.nome}</strong>` por `<td><a className="text-button" href={`/admin/empresas/${e.id}`}><strong>{e.nome}</strong></a>`.
- `web/components/funcao/EditorFuncao.tsx`: no `side-note`, antes de "Arquivar função", acrescente `<a className="text-button" href={`/funcoes/${funcao.id}/sintese`}>Ver síntese da função</a><br />` (e mantenha o `<br />` existente).

- [ ] **Step 6: Documentação**

Em `SITE_WEB.md`, acrescente ao fim da seção `## Uso`:

```markdown
**Síntese da função (RF12):** em cada função, "Ver síntese da função" mostra numa página o mapa de efeitos, as competências, a salvaguarda e as lacunas de cada ocupante, com o PDF da última trilha.

**Pesquisa (admin):** `/admin/metricas` traz, por função, tempo ativo de preenchimento (meta de 90 min do RNF01), cobertura do diagnóstico, densidade de lacunas, completude da trilha, diretriz de uso crítico, alerta de preservação, facilidade percebida (nota de 1 a 5 pedida ao gestor depois da primeira trilha) e o efeito dos recursos de agilidade (origem das tarefas e competências e quanto foi editado). "Baixar CSV" abre direto no Excel. Em `/admin`, o nome da loja leva à leitura das funções dela, inclusive arquivadas.
```

- [ ] **Step 7: Verificar**

Run: `cd web && npm test && npm run build`
Expected: PASS e build com `/funcoes/[id]/sintese`, `/admin/empresas/[id]`, `/admin/empresas/[id]/funcoes/[fid]`, `/admin/metricas`, `/api/admin/metricas`, `/api/funcoes/[id]/avaliacao`.

Com `npm run dev`:
1. Gestor: "Ver síntese da função" no editor abre a síntese com tarefas, competências, salvaguarda e lacunas por ocupante.
2. Gestor, num ocupante com diagnóstico: o cartão de avaliação **não** aparece (só depois de trilha). Para verificar sem Ollama, gere a trilha na VM depois do deploy; localmente, confira com `curl` que `POST /api/funcoes/<id>/avaliacao` com `{"nota":4}` responde `{"ok":true}` e com `{"nota":7}` responde 400; com o cookie de outra loja, 404.
3. Admin: Métricas lista as funções; filtrar por empresa reduz a lista; "Baixar CSV" abre no Excel com acentos corretos e colunas no lugar. Em `/admin`, o nome da loja abre a lista de funções; arquive uma função como gestor e confirme que o admin ainda abre a síntese, com "Arquivada".
4. Gestor tentando abrir `/admin/metricas` é redirecionado para `/`; `GET /api/admin/metricas` com cookie de gestor responde 403.

- [ ] **Step 8: Commit**

```bash
git add web/components/SinteseFuncao.tsx "web/app/(loja)/funcoes/[id]/sintese" web/app/admin web/app/api/admin/metricas web/components/ocupante web/components/admin web/components/funcao/EditorFuncao.tsx "web/app/(loja)/funcoes/[id]/ocupantes" web/lib/ocupantes.ts web/lib/ocupantes.test.ts web/lib/funcoes.ts web/app/globals.css SITE_WEB.md
git commit -m "Adiciona sintese da funcao, leitura pelo admin, metricas com CSV e avaliacao de facilidade" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Cobertura do spec (fase 4)

| Spec | Onde |
|---|---|
| §11 Leitura das empresas pelo admin (somente leitura, inclusive arquivadas) | Task 3 |
| §11 Métricas por função, filtro por empresa, CSV pt-BR | Tasks 1 e 3 |
| §11 Tempo de aplicação, cobertura, densidade, completude, diretriz, preservação, facilidade, efeito dos recursos de agilidade, extrações | Tasks 1, 2 e 3 |
| §11 Avaliação de facilidade depois da 1ª trilha (cartão dispensável) | Tasks 2 e 3 |
| RF12 Síntese por função apresentável | Task 3 |
| Indicadores que dependem de campo, sinalizados como fora do site | Task 3 |
