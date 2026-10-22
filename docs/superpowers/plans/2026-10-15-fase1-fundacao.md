# Fase 1 — Fundação (contas, empresas, funções e ocupantes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o modo anônimo por login obrigatório. O admin cadastra empresas; o gestor de cada empresa cadastra funções (tarefas, competências, salvaguarda) e ocupantes, e gera a trilha de cada ocupante pelo motor Python atual, via fila.

**Architecture:** Evolução do Next.js 16 existente, sem dependências novas. Tabelas novas e aditivas no mesmo SQLite (`node:sqlite`); senha com `scrypt` (`node:crypto`); sessão por cookie httpOnly. Os módulos de regra ficam em `web/lib/*.ts`, puros e testados com `node --test`. As rotas e páginas do App Router chamam esses módulos. O motor Python recebe o mesmo JSON de entrada de hoje, montado a partir de Função + Ocupante + Catálogo.

**Tech Stack:** Node 24 (type stripping nativo), Next.js 16.3.8 (App Router, `next build --webpack`), React 19, TypeScript 5.9, `node:sqlite`, `node:test`, Python 3.10 (`web_bridge.py`, sem mudanças nesta fase).

**Spec:** `docs/superpowers/specs/2026-10-15-contas-e-celeridade-design.md` (esta é a fase 1 de 4 do §15).

## Global Constraints

- Nenhuma dependência nova de npm ou pip.
- Arquivos em `web/lib/*.ts` importados pelos testes usam imports relativos **com extensão `.ts`**. Para tipos, usar `import type` ou `type` inline. Proibido `enum`, `namespace` e *parameter properties* (`constructor(public x)`), porque o type stripping do Node não os suporta.
- Arquivos de `app/` e `components/` importam a lib por `@/lib/<nome>`, sem extensão.
- Linhas do `node:sqlite` têm protótipo nulo. Toda função que devolve dados para página ou cliente **mapeia para objeto literal**.
- Esquema só aditivo: `CREATE TABLE/INDEX IF NOT EXISTS`. Nunca `ALTER` nem `DROP`. As tabelas antigas `sessions` e `jobs` não são tocadas. Arquivo de banco: `web/data/sessions.sqlite`.
- `/api/health` continua público e inalterado, porque o deploy depende de `online`, `modelReady` e `release`.
- O `web_bridge.py` continua sendo chamado com os modos `analise` e `llm` (o `wait_idle` do deploy usa `pgrep` com esses nomes).
- Toda mutação chama `sameOrigin(request)` e lê o corpo com `lerJson(request, limite)` (máximo 110 000 caracteres).
- Recurso de outra empresa responde **404**. Sem sessão: 401. Papel errado ou troca de senha pendente: 403.
- Cookie `mrcc_auth`: httpOnly, SameSite=Lax, `Secure` quando `MRCC_SECURE_COOKIE=1`, 14 dias.
- `scrypt` com N=2¹⁷, r=8, p=1, `maxmem` de 256 MiB. Bloqueio após 5 falhas por 15 min. Mensagem única de login: `E-mail ou senha incorretos. Após várias tentativas, aguarde 15 minutos.`
- Limites do motor: 12 tarefas, 8 competências e 6 salvaguardas. Prazo entre 1 e 180 dias.
- Textos de interface em pt-BR, sem jargão (RNF03). Nenhum campo de dado pessoal; o ocupante é identificado só por apelido (RNF07).
- Commits em português, no imperativo, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Sair do editor da função por um link enquanto o autosave está pendente.** Esperado: nenhuma edição se perde. Coberto na Task 11 (verificação manual: editar e clicar em "Voltar ao painel" em menos de 700 ms).
2. **Gerar a trilha logo depois de mudar um nível (antes do debounce de 700 ms).** Esperado: a geração usa o nível que está na tela. Coberto na Task 12 (`salvarAgora()` antes do POST, com verificação manual).
3. **Remover uma tarefa que tem competência ligada.** Esperado: a competência fica "sem tarefa" e a geração é bloqueada com mensagem clara, nunca com stack trace do Python. Testes na Task 1 (pendências) e na Task 8 (`montarEntrada` lança 400).
4. **Gestor de empresa desativada com sessão aberta.** Esperado: perde o acesso na requisição seguinte. Testes nas Tasks 3 e 6.
5. **Reinício do serviço com trilha na fila ou em execução.** Esperado: a tela mostra "interrompida por reinício" em vez de girar para sempre. Teste na Task 9 (`normalizarStatus`).

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `web/lib/estrutura.ts` | Tipos e constantes da função, validação (`validarEstrutura`) e pendências |
| `web/lib/seed.ts` | Catálogo base (8 ações) e textos das 6 âncoras de salvaguarda |
| `web/lib/db.ts` | Esquema aditivo, seed, singleton `db()` e `transacao()` |
| `web/lib/apoio-testes.ts` | Banco em memória, empresa de teste e exemplo do atendente (só testes) |
| `web/lib/http.ts` | `HttpErro`, `errorResponse`, `sameOrigin`, `lerJson` |
| `web/lib/senha.ts` | Hash e verificação scrypt, senha temporária, validação de senha |
| `web/lib/auth.ts` | Login, sessão por token, troca e definição de senha, criação de usuário |
| `web/lib/sessao-web.ts` | Ponte com Next: cookie, `exigirUsuario`, `exigirPagina`, `exigirGestor`, `ou404` |
| `web/lib/empresas.ts` | Criar empresa + gestor, listar, ativar/desativar, redefinir senha |
| `web/lib/funcoes.ts` | Repositório de funções |
| `web/lib/ocupantes.ts` | Repositório de ocupantes e validação de níveis |
| `web/lib/catalogo.ts` | Catálogo ativo (global + empresa) |
| `web/lib/lacunas.ts` | Cálculo das lacunas na tela (espelha o Python) |
| `web/lib/entrada-motor.ts` | Função + ocupante + catálogo → JSON do `web_bridge.py`; importação inversa |
| `web/lib/fila.ts` | Fila FIFO com 1 worker, limite por empresa e total |
| `web/lib/status-execucao.ts` | Tipos de status e normalização após reinício ou expiração |
| `web/lib/execucoes.ts` | Criar pasta, gravar entrada, enfileirar e ler execuções |
| `web/lib/tempo.ts` | Somar tempo ativo de função e ocupante |
| `web/lib/server.ts` | (alterado) caminhos do motor, `runBridge`, `jobPath` |
| `web/lib/session.ts` | (removido na Task 10) |
| `web/scripts/criar-admin.mjs` | Cria ou redefine o admin por SSH |
| `web/components/*` | `Campo`, `Topo`, `BotaoSair`, `api.ts`, `useAutosave`, `useTempoAtivo` |
| `web/components/auth/*` | Formulários de login e de troca de senha |
| `web/components/admin/PainelEmpresas.tsx` | Tela do admin |
| `web/components/loja/NovaFuncao.tsx` | Criar função em branco ou importar planilha |
| `web/components/funcao/*` | Editor da função em 4 etapas |
| `web/components/ocupante/*` | Página do ocupante e resultado da trilha |
| `web/app/...` | Páginas e rotas de API (lista em cada task) |

---

### Task 1: Infraestrutura de testes TS e modelo da estrutura

**Files:**
- Modify: `web/package.json` (script `test`)
- Modify: `web/tsconfig.json` (`allowImportingTsExtensions`)
- Modify: `.github/workflows/verify.yml` (passo `npm test`)
- Create: `web/lib/estrutura.ts`
- Test: `web/lib/estrutura.test.ts`

**Interfaces:**
- Produces (`lib/estrutura.ts`):
  - consts `EIXOS`, `FREQUENCIAS`, `CRITICIDADES`, `EFEITOS`, `NIVEIS`, `RESPOSTAS`, `ORIGENS_TAREFA`, `ORIGENS_COMPETENCIA`, `LIMITES`, `ROTULOS_NIVEL`;
  - types `Eixo`, `Frequencia`, `Criticidade`, `Efeito`, `Nivel`, `Resposta`, `Tarefa`, `Competencia`, `PerdaCentralidade`, `RespostaSalvaguarda`, `Estrutura`, `NivelOcupante`, `Niveis`;
  - funções `novoId(): string`, `novaTarefa(): Tarefa`, `novaCompetencia(tarefaId?: string): Competencia`, `estruturaVazia(): Estrutura`, `validarEstrutura(valor: unknown): Estrutura` (lança `Error` com mensagem em pt-BR), `pendenciasTarefas(e): string[]`, `pendenciasCompetencias(e): string[]`, `pendenciasEstrutura(e): string[]`.

- [ ] **Step 1: Configurar o runner de testes**

Em `web/package.json`, acrescente o script `test` (mantenha os demais):

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build --webpack",
    "start": "next start -H 127.0.0.1",
    "typecheck": "tsc --noEmit",
    "test": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test \"lib/**/*.test.ts\""
  },
```

Em `web/tsconfig.json`, dentro de `compilerOptions`, logo depois de `"noEmit": true,`, acrescente:

```json
    "allowImportingTsExtensions": true,
```

Em `.github/workflows/verify.yml`, entre os passos "Instalar dependências do site" e "Verificar TypeScript e build", acrescente:

```yaml
      - name: Verificar módulos do site
        working-directory: web
        run: npm test
```

- [ ] **Step 2: Escrever os testes que falham**

Crie `web/lib/estrutura.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estruturaVazia, novaCompetencia, novaTarefa, pendenciasCompetencias, pendenciasEstrutura, pendenciasTarefas, validarEstrutura, type Estrutura } from './estrutura.ts';

function completa(): Estrutura {
  const e = estruturaVazia();
  e.tarefas[0] = { ...e.tarefas[0], tarefa: 'Montar orçamento para o cliente', efeito_ia: 'P' };
  e.competencias = [{ ...novaCompetencia(e.tarefas[0].id), competencia: 'Proficiência na ferramenta' }];
  return e;
}

test('estrutura vazia é válida e tem uma tarefa e seis salvaguardas', () => {
  const e = validarEstrutura(estruturaVazia());
  assert.equal(e.tarefas.length, 1);
  assert.equal(e.tarefas[0].efeito_ia, null);
  assert.deepEqual(e.salvaguardas.map(s => s.numero), [1, 2, 3, 4, 5, 6]);
});

test('remove campos desconhecidos', () => {
  const e = completa() as Estrutura & { extra?: string };
  e.extra = 'x';
  (e.tarefas[0] as unknown as Record<string, unknown>).intruso = 1;
  const v = validarEstrutura(e) as unknown as Record<string, unknown>;
  assert.equal('extra' in v, false);
  assert.equal('intruso' in (v.tarefas as Record<string, unknown>[])[0], false);
});

test('rejeita valores fora das opções e limites', () => {
  const e = completa();
  assert.throws(() => validarEstrutura({ ...e, tarefas: [{ ...e.tarefas[0], frequencia: 'Mensal' }] }), /frequência/);
  assert.throws(() => validarEstrutura({ ...e, tarefas: Array.from({ length: 13 }, novaTarefa) }), /tarefas/);
  assert.throws(() => validarEstrutura({ ...e, salvaguardas: e.salvaguardas.slice(0, 5) }), /salvaguardas/);
  assert.throws(() => validarEstrutura({ ...e, versao: 2 }), /versão/);
  assert.throws(() => validarEstrutura(null), /estrutura/);
});

test('competência só aponta para tarefa existente ou para vazio', () => {
  const e = completa();
  assert.throws(() => validarEstrutura({ ...e, competencias: [{ ...e.competencias[0], tarefa_id: novaTarefa().id }] }), /tarefa associada/);
  assert.equal(validarEstrutura({ ...e, competencias: [{ ...e.competencias[0], tarefa_id: '' }] }).competencias[0].tarefa_id, '');
});

test('estrutura completa não tem pendências', () => {
  assert.deepEqual(pendenciasEstrutura(completa()), []);
});

test('aponta tarefa sem texto, sem efeito e repetida', () => {
  const e = completa();
  e.tarefas.push({ ...novaTarefa(), tarefa: '  montar ORÇAMENTO para o cliente ', efeito_ia: 'I' }, novaTarefa());
  assert.deepEqual(pendenciasTarefas(e), [
    'Tarefa 2: já existe outra tarefa com o mesmo texto.',
    'Tarefa 3: descreva a atividade.',
    'Tarefa 3: indique o efeito da IA.',
  ]);
});

test('aponta competência sem nome e sem tarefa (ex.: tarefa removida)', () => {
  const e = completa();
  e.competencias.push(novaCompetencia(''));
  assert.deepEqual(pendenciasCompetencias(e), ['Competência 2: informe o nome.', 'Competência 2: escolha a tarefa associada.']);
  assert.deepEqual(pendenciasCompetencias({ ...e, competencias: [] }), ['Cadastre ao menos uma competência.']);
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` apontando para `estrutura.ts`.

- [ ] **Step 4: Implementar `web/lib/estrutura.ts`**

```ts
export const EIXOS = ['Letramento em IA', 'Proficiência técnica', 'Adaptabilidade', 'Relacionais e de julgamento'] as const;
export const FREQUENCIAS = ['Diária', 'Semanal', 'Eventual'] as const;
export const CRITICIDADES = ['Alta', 'Média', 'Baixa'] as const;
export const EFEITOS = ['A', 'P', 'I', 'N'] as const;
export const NIVEIS = ['N0', 'N1', 'N2', 'N3'] as const;
export const RESPOSTAS = ['Sim', 'Não', 'Parcialmente', 'Não sei'] as const;
export const ORIGENS_TAREFA = ['modelo', 'ia', 'manual', 'copia', 'planilha'] as const;
export const ORIGENS_COMPETENCIA = ['regra', 'modelo', 'manual', 'copia', 'planilha'] as const;
export const LIMITES = { tarefas: 12, competencias: 8, texto: 300, ferramenta: 200, nota: 1000 } as const;

export type Eixo = (typeof EIXOS)[number];
export type Frequencia = (typeof FREQUENCIAS)[number];
export type Criticidade = (typeof CRITICIDADES)[number];
export type Efeito = (typeof EFEITOS)[number];
export type Nivel = (typeof NIVEIS)[number];
export type Resposta = (typeof RESPOSTAS)[number];
export type OrigemTarefa = (typeof ORIGENS_TAREFA)[number];
export type OrigemCompetencia = (typeof ORIGENS_COMPETENCIA)[number];

export const ROTULOS_NIVEL: Record<Nivel, string> = {
  N0: 'N0 - Não exposto', N1: 'N1 - Usuário assistido', N2: 'N2 - Usuário autônomo', N3: 'N3 - Usuário crítico',
};

export type Tarefa = { id: string; tarefa: string; frequencia: Frequencia; criticidade: Criticidade; ferramenta: string; efeito_ia: Efeito | null; origem: OrigemTarefa; editada: boolean };
export type Competencia = { id: string; competencia: string; eixo: Eixo; tarefa_id: string; alvo: Nivel; origem: OrigemCompetencia; motivo?: string; editada: boolean };
export type PerdaCentralidade = { id: string; descricao: string; tarefa_id: string; origem: 'regra' | 'manual' };
export type RespostaSalvaguarda = { numero: number; resposta: Resposta; observacao: string; ajuste: string };
export type Estrutura = { versao: 1; tarefas: Tarefa[]; competencias: Competencia[]; perdem_centralidade: PerdaCentralidade[]; salvaguardas: RespostaSalvaguarda[] };
export type NivelOcupante = { nivel: Nivel; respostas: (boolean | null)[] | null };
export type Niveis = Record<string, NivelOcupante>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const novoId = (): string => globalThis.crypto.randomUUID();

export function novaTarefa(): Tarefa {
  return { id: novoId(), tarefa: '', frequencia: 'Diária', criticidade: 'Média', ferramenta: '', efeito_ia: null, origem: 'manual', editada: false };
}

export function novaCompetencia(tarefaId = ''): Competencia {
  return { id: novoId(), competencia: '', eixo: EIXOS[0], tarefa_id: tarefaId, alvo: 'N2', origem: 'manual', editada: false };
}

export function estruturaVazia(): Estrutura {
  return {
    versao: 1, tarefas: [novaTarefa()], competencias: [], perdem_centralidade: [],
    salvaguardas: [1, 2, 3, 4, 5, 6].map(numero => ({ numero, resposta: 'Não sei' as Resposta, observacao: '', ajuste: '' })),
  };
}

function falha(campo: string): never {
  throw new Error(`Campo inválido: ${campo}.`);
}
function objeto(v: unknown, campo: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) falha(campo);
  return v as Record<string, unknown>;
}
function lista(v: unknown, campo: string, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) falha(campo);
  return v;
}
function texto(v: unknown, campo: string, max: number): string {
  if (typeof v !== 'string' || v.length > max) falha(campo);
  return v;
}
function opcao<T extends string>(v: unknown, opcoes: readonly T[], campo: string): T {
  if (typeof v !== 'string' || !(opcoes as readonly string[]).includes(v)) falha(campo);
  return v as T;
}
function identificador(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !UUID.test(v)) falha(campo);
  return v;
}
function booleano(v: unknown, campo: string): boolean {
  if (typeof v !== 'boolean') falha(campo);
  return v;
}
function unicos(ids: string[], campo: string): void {
  if (new Set(ids).size !== ids.length) falha(campo);
}

export function validarEstrutura(valor: unknown): Estrutura {
  const e = objeto(valor, 'estrutura');
  if (e.versao !== 1) falha('versão da estrutura');
  const tarefas: Tarefa[] = lista(e.tarefas, 'tarefas', LIMITES.tarefas).map((item, i) => {
    const t = objeto(item, `tarefa ${i + 1}`);
    return {
      id: identificador(t.id, 'tarefa'),
      tarefa: texto(t.tarefa, 'tarefa', LIMITES.texto),
      frequencia: opcao(t.frequencia, FREQUENCIAS, 'frequência'),
      criticidade: opcao(t.criticidade, CRITICIDADES, 'criticidade'),
      ferramenta: texto(t.ferramenta, 'ferramenta', LIMITES.ferramenta),
      efeito_ia: t.efeito_ia === null ? null : opcao(t.efeito_ia, EFEITOS, 'efeito da IA'),
      origem: opcao(t.origem, ORIGENS_TAREFA, 'origem da tarefa'),
      editada: booleano(t.editada, 'editada'),
    };
  });
  unicos(tarefas.map(t => t.id), 'tarefas repetidas');
  const idsTarefas = new Set(tarefas.map(t => t.id));
  const referencia = (v: unknown, campo: string, permitirVazio: boolean): string => {
    if (permitirVazio && v === '') return '';
    const id = identificador(v, campo);
    if (!idsTarefas.has(id)) falha(campo);
    return id;
  };
  const competencias: Competencia[] = lista(e.competencias, 'competências', LIMITES.competencias).map((item, i) => {
    const c = objeto(item, `competência ${i + 1}`);
    const base: Competencia = {
      id: identificador(c.id, 'competência'),
      competencia: texto(c.competencia, 'competência', LIMITES.texto),
      eixo: opcao(c.eixo, EIXOS, 'eixo'),
      tarefa_id: referencia(c.tarefa_id, 'tarefa associada', true),
      alvo: opcao(c.alvo, NIVEIS, 'nível-alvo'),
      origem: opcao(c.origem, ORIGENS_COMPETENCIA, 'origem da competência'),
      editada: booleano(c.editada, 'editada'),
    };
    return c.motivo === undefined ? base : { ...base, motivo: texto(c.motivo, 'motivo', LIMITES.texto) };
  });
  unicos(competencias.map(c => c.id), 'competências repetidas');
  const perdem_centralidade: PerdaCentralidade[] = lista(e.perdem_centralidade, 'perda de centralidade', LIMITES.tarefas).map((item, i) => {
    const p = objeto(item, `perda de centralidade ${i + 1}`);
    return {
      id: identificador(p.id, 'perda de centralidade'),
      descricao: texto(p.descricao, 'descrição', LIMITES.texto),
      tarefa_id: referencia(p.tarefa_id, 'tarefa da perda de centralidade', false),
      origem: opcao(p.origem, ['regra', 'manual'] as const, 'origem'),
    };
  });
  const salvaguardas: RespostaSalvaguarda[] = lista(e.salvaguardas, 'salvaguardas', 6).map((item, i) => {
    const s = objeto(item, `salvaguarda ${i + 1}`);
    if (s.numero !== i + 1) falha('número da salvaguarda');
    return {
      numero: i + 1,
      resposta: opcao(s.resposta, RESPOSTAS, 'resposta da salvaguarda'),
      observacao: texto(s.observacao, 'observação', LIMITES.nota),
      ajuste: texto(s.ajuste, 'ajuste', LIMITES.nota),
    };
  });
  if (salvaguardas.length !== 6) falha('salvaguardas');
  return { versao: 1, tarefas, competencias, perdem_centralidade, salvaguardas };
}

const chave = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

export function pendenciasTarefas(e: Estrutura): string[] {
  const p: string[] = [];
  if (!e.tarefas.length) p.push('Cadastre ao menos uma tarefa.');
  const vistas = new Set<string>();
  e.tarefas.forEach((t, i) => {
    if (!t.tarefa.trim()) p.push(`Tarefa ${i + 1}: descreva a atividade.`);
    else if (vistas.has(chave(t.tarefa))) p.push(`Tarefa ${i + 1}: já existe outra tarefa com o mesmo texto.`);
    else vistas.add(chave(t.tarefa));
    if (!t.efeito_ia) p.push(`Tarefa ${i + 1}: indique o efeito da IA.`);
  });
  return p;
}

export function pendenciasCompetencias(e: Estrutura): string[] {
  const p: string[] = [];
  if (!e.competencias.length) p.push('Cadastre ao menos uma competência.');
  e.competencias.forEach((c, i) => {
    if (!c.competencia.trim()) p.push(`Competência ${i + 1}: informe o nome.`);
    if (!c.tarefa_id) p.push(`Competência ${i + 1}: escolha a tarefa associada.`);
  });
  return p;
}

export const pendenciasEstrutura = (e: Estrutura): string[] => [...pendenciasTarefas(e), ...pendenciasCompetencias(e)];
```

- [ ] **Step 5: Rodar os testes e o build**

Run: `cd web && npm test`
Expected: PASS, 7 testes.

Run: `cd web && npm run build`
Expected: build concluído sem erro de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/tsconfig.json .github/workflows/verify.yml web/lib/estrutura.ts web/lib/estrutura.test.ts
git commit -m "Adiciona modelo validado da estrutura da funcao e testes do site" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Banco — esquema aditivo e seed

**Files:**
- Create: `web/lib/seed.ts`
- Create: `web/lib/db.ts`
- Create: `web/lib/apoio-testes.ts`
- Test: `web/lib/db.test.ts`

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces:
  - `lib/seed.ts`: `type AcaoCatalogo = { eixo: string; acao: string; recurso: string; custo: string }`, `CATALOGO_BASE: AcaoCatalogo[]` (8 itens), `type Ancora = { numero: number; ancora: string; verificacao: string }`, `SALVAGUARDAS: Ancora[]` (6 itens).
  - `lib/db.ts`: `prepararBanco(db: DatabaseSync): DatabaseSync`, `caminhoBanco(): string`, `db(): DatabaseSync` (singleton), `transacao<T>(db: DatabaseSync, fn: () => T): T`.
  - `lib/apoio-testes.ts`: `bancoDeTeste(): DatabaseSync`, `inserirEmpresa(db, nome?, ativa?): string`, `ID(n: number): string`.

- [ ] **Step 1: Escrever os testes que falham**

Crie `web/lib/db.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { prepararBanco, transacao } from './db.ts';
import { CATALOGO_BASE, SALVAGUARDAS } from './seed.ts';

const contar = (db: ReturnType<typeof bancoDeTeste>, sql: string) => Number((db.prepare(sql).get() as { n: number }).n);

test('prepara o esquema de forma idempotente e semeia o catálogo uma única vez', () => {
  const db = bancoDeTeste();
  prepararBanco(db);
  assert.equal(contar(db, 'SELECT COUNT(*) AS n FROM catalogo_acoes WHERE empresa_id IS NULL'), CATALOGO_BASE.length);
  assert.equal(CATALOGO_BASE.length, 8);
  assert.deepEqual(SALVAGUARDAS.map(s => s.numero), [1, 2, 3, 4, 5, 6]);
  assert.equal(SALVAGUARDAS[5].ancora, 'Diretriz de uso crítico');
});

test('aceita um único gestor por empresa e exige empresa só para gestor', () => {
  const db = bancoDeTeste();
  const empresaId = inserirEmpresa(db);
  const inserir = (email: string, papel: string, empresa: string | null) =>
    db.prepare("INSERT INTO usuarios (id, email, senha_hash, papel, empresa_id, criado_em) VALUES (?, ?, 'x', ?, ?, '2026-10-15')").run(crypto.randomUUID(), email, papel, empresa);
  inserir('a@loja.com', 'gestor', empresaId);
  assert.throws(() => inserir('b@loja.com', 'gestor', empresaId), /UNIQUE/);
  assert.throws(() => inserir('c@loja.com', 'gestor', null), /CHECK/);
  assert.throws(() => inserir('d@loja.com', 'admin', empresaId), /CHECK/);
  inserir('admin@pesquisa.com', 'admin', null);
});

test('transação desfaz tudo quando há erro', () => {
  const db = bancoDeTeste();
  assert.throws(() => transacao(db, () => {
    inserirEmpresa(db, 'Primeira');
    throw new Error('falhou');
  }), /falhou/);
  assert.equal(contar(db, 'SELECT COUNT(*) AS n FROM empresas'), 0);
  assert.equal(transacao(db, () => inserirEmpresa(db, 'Segunda')).length, 36);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `apoio-testes.ts`.

- [ ] **Step 3: Criar `web/lib/seed.ts`**

Os textos do catálogo são os da aba "Catálogo de Ações" da planilha de exemplo. As verificações das âncoras 2–5 foram generalizadas de "O atendente" para "Quem ocupa a função", porque agora valem para qualquer função. Os nomes das âncoras precisam ser exatamente estes: `web_llm.py` compara `'Diretriz de uso crítico'`.

```ts
export type AcaoCatalogo = { eixo: string; acao: string; recurso: string; custo: string };
export type Ancora = { numero: number; ancora: string; verificacao: string };

export const CATALOGO_BASE: AcaoCatalogo[] = [
  { eixo: 'Letramento em IA', acao: '3 sessões de 40 min usando a ferramenta em casos reais da loja', recurso: 'Tutorial gratuito + prática assistida', custo: 'R$ 0' },
  { eixo: 'Letramento em IA', acao: 'Tutorial online gratuito sobre uso básico de IA no varejo', recurso: 'Conteúdo do Sebrae', custo: 'R$ 0' },
  { eixo: 'Proficiência técnica', acao: 'Prática assistida na ferramenta de orçamento, 2x por semana, com revisão do gerente', recurso: 'Prática assistida', custo: 'R$ 0' },
  { eixo: 'Proficiência técnica', acao: 'Manual passo a passo da ferramenta, com capturas de tela', recurso: 'Material interno', custo: 'R$ 0' },
  { eixo: 'Adaptabilidade', acao: 'Rodízio de funções por uma semana', recurso: 'Prática assistida', custo: 'R$ 0' },
  { eixo: 'Relacionais e de julgamento', acao: 'Rodízio: 1 dia por semana no atendimento de reclamação junto com o gerente', recurso: 'Aprendizagem entre pares', custo: 'R$ 0' },
  { eixo: 'Relacionais e de julgamento', acao: 'Simulação de atendimento difícil (role-play) com o gerente', recurso: 'Aprendizagem entre pares', custo: 'R$ 0' },
  { eixo: 'Geral', acao: 'Conteúdo gratuito do Sebrae sobre gestão de pessoas e adoção de IA', recurso: 'Conteúdo do Sebrae', custo: 'R$ 0' },
];

export const SALVAGUARDAS: Ancora[] = [
  { numero: 1, ancora: 'Variedade de habilidades', verificacao: 'A função continua exigindo mais de um tipo de habilidade, ou virou só clicar em botão?' },
  { numero: 2, ancora: 'Identidade da tarefa', verificacao: 'Quem ocupa a função ainda entrega um resultado completo e reconhecível, não só um pedaço dele?' },
  { numero: 3, ancora: 'Significado da tarefa', verificacao: 'Quem ocupa a função entende por que o que faz importa para o cliente e para a loja?' },
  { numero: 4, ancora: 'Autonomia', verificacao: 'Quem ocupa a função ainda decide como fazer, ou só executa uma ordem?' },
  { numero: 5, ancora: 'Retorno (feedback)', verificacao: 'Quem ocupa a função sabe se fez certo? Recebe algum retorno sobre o resultado do seu trabalho?' },
  { numero: 6, ancora: 'Diretriz de uso crítico', verificacao: 'Existe orientação clara de quando NÃO usar a IA, ou de quando checar manualmente?' },
];
```

- [ ] **Step 4: Criar `web/lib/db.ts`**

```ts
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CATALOGO_BASE } from './seed.ts';

// Somente tabelas novas: a versão anterior (rollback do deploy) ignora estas tabelas.
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS empresas (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, cidade TEXT NOT NULL DEFAULT '', segmento TEXT NOT NULL DEFAULT '',
  ativa INTEGER NOT NULL DEFAULT 1, criada_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('admin', 'gestor')), empresa_id TEXT REFERENCES empresas(id),
  trocar_senha INTEGER NOT NULL DEFAULT 1, falhas INTEGER NOT NULL DEFAULT 0, bloqueado_ate INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL, ultimo_acesso TEXT,
  CHECK ((papel = 'admin') = (empresa_id IS NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_gestor_unico ON usuarios(empresa_id) WHERE papel = 'gestor';
CREATE TABLE IF NOT EXISTS auth_sessoes (
  token_hash TEXT PRIMARY KEY, usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira INTEGER NOT NULL, criada_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS auth_sessoes_usuario ON auth_sessoes(usuario_id);
CREATE TABLE IF NOT EXISTS catalogo_acoes (
  id TEXT PRIMARY KEY, empresa_id TEXT REFERENCES empresas(id), eixo TEXT NOT NULL, acao TEXT NOT NULL,
  recurso TEXT NOT NULL, custo TEXT NOT NULL, ativa INTEGER NOT NULL DEFAULT 1, criada_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS funcoes (
  id TEXT PRIMARY KEY, empresa_id TEXT NOT NULL REFERENCES empresas(id), nome TEXT NOT NULL, estrutura TEXT NOT NULL,
  origem TEXT NOT NULL, tempo_ativo_s INTEGER NOT NULL DEFAULT 0, arquivada INTEGER NOT NULL DEFAULT 0,
  criada_em TEXT NOT NULL, atualizada_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS funcoes_empresa ON funcoes(empresa_id, arquivada);
CREATE TABLE IF NOT EXISTS ocupantes (
  id TEXT PRIMARY KEY, funcao_id TEXT NOT NULL REFERENCES funcoes(id) ON DELETE CASCADE, apelido TEXT NOT NULL,
  niveis TEXT NOT NULL DEFAULT '{}', prazo_dias INTEGER NOT NULL DEFAULT 14, tempo_ativo_s INTEGER NOT NULL DEFAULT 0,
  arquivado INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ocupantes_funcao ON ocupantes(funcao_id, arquivado);
CREATE TABLE IF NOT EXISTS execucoes (
  id TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK (tipo IN ('trilha', 'diagnostico', 'extracao')),
  empresa_id TEXT NOT NULL REFERENCES empresas(id), funcao_id TEXT REFERENCES funcoes(id),
  ocupante_id TEXT REFERENCES ocupantes(id), criada_por TEXT NOT NULL REFERENCES usuarios(id), criada_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS execucoes_ocupante ON execucoes(ocupante_id, criada_em);
`;

export function transacao<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (erro) {
    db.exec('ROLLBACK');
    throw erro;
  }
}

export function prepararBanco(db: DatabaseSync): DatabaseSync {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(ESQUEMA);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM catalogo_acoes WHERE empresa_id IS NULL').get() as { n: number };
  if (Number(n) === 0) {
    const inserir = db.prepare('INSERT INTO catalogo_acoes (id, empresa_id, eixo, acao, recurso, custo, ativa, criada_em) VALUES (?, NULL, ?, ?, ?, ?, 1, ?)');
    const agora = new Date().toISOString();
    transacao(db, () => {
      for (const a of CATALOGO_BASE) inserir.run(crypto.randomUUID(), a.eixo, a.acao, a.recurso, a.custo, agora);
    });
  }
  return db;
}

export const caminhoBanco = (): string => path.join(process.cwd(), 'data', 'sessions.sqlite');

const estado = globalThis as typeof globalThis & { mrccBanco?: DatabaseSync };

export function db(): DatabaseSync {
  if (!estado.mrccBanco) {
    mkdirSync(path.dirname(caminhoBanco()), { recursive: true, mode: 0o700 });
    estado.mrccBanco = prepararBanco(new DatabaseSync(caminhoBanco()));
  }
  return estado.mrccBanco;
}
```

- [ ] **Step 5: Criar `web/lib/apoio-testes.ts`**

```ts
import { DatabaseSync } from 'node:sqlite';
import { prepararBanco } from './db.ts';

/** Utilitários usados só pelos testes (`*.test.ts`). */
export const bancoDeTeste = (): DatabaseSync => prepararBanco(new DatabaseSync(':memory:'));

export const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function inserirEmpresa(db: DatabaseSync, nome = 'Loja Teste', ativa = true): string {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO empresas (id, nome, ativa, criada_em) VALUES (?, ?, ?, ?)').run(id, nome, ativa ? 1 : 0, new Date().toISOString());
  return id;
}
```

- [ ] **Step 6: Rodar os testes e o build**

Run: `cd web && npm test`
Expected: PASS (testes da Task 1 + 3 novos).

Run: `cd web && npm run build`
Expected: build concluído.

- [ ] **Step 7: Commit**

```bash
git add web/lib/seed.ts web/lib/db.ts web/lib/apoio-testes.ts web/lib/db.test.ts
git commit -m "Cria esquema aditivo de empresas, usuarios, funcoes e ocupantes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Erros HTTP, senhas e autenticação

**Files:**
- Create: `web/lib/http.ts`
- Create: `web/lib/senha.ts`
- Create: `web/lib/auth.ts`
- Test: `web/lib/senha.test.ts`, `web/lib/auth.test.ts`

**Interfaces:**
- Consumes: `bancoDeTeste`, `inserirEmpresa` (Task 2).
- Produces:
  - `lib/http.ts`: `class HttpErro extends Error { status: number }`, `errorResponse(error: unknown, status?: number): Response`, `sameOrigin(request: Request): void`, `lerJson(request: Request, limite?: number): Promise<Record<string, unknown>>`.
  - `lib/senha.ts`: `hashSenha(senha: string): Promise<string>`, `verificarSenha(senha: string, hash: string): Promise<boolean>`, `validarNovaSenha(senha: unknown): string`, `gerarSenhaTemporaria(): string`.
  - `lib/auth.ts`:
    - `type Papel = 'admin' | 'gestor'`;
    - `type Usuario = { id: string; email: string; papel: Papel; empresaId: string | null; empresaNome: string | null; trocarSenha: boolean }`;
    - consts `DURACAO_SESSAO_MS`, `MAX_FALHAS`, `BLOQUEIO_MS`, `MENSAGEM_LOGIN`;
    - funções `normalizarEmail(email: unknown): string`, `hashToken(token: string): string`, `entrar(db, email: unknown, senha: unknown, agora?): Promise<{ token: string; usuario: Usuario }>`, `usuarioPorToken(db, token: string | undefined, agora?): Usuario | null`, `encerrarSessao(db, token: string | undefined): void`, `inserirUsuario(db, { email, senhaHash, papel, empresaId, trocarSenha }, agora?): string`, `criarUsuario(db, { email, senha, papel, empresaId, trocarSenha }, agora?): Promise<string>`, `definirSenha(db, usuarioId, novaSenha, trocarSenha: boolean, manterToken?: string): Promise<void>`, `trocarSenha(db, usuarioId, senhaAtual: unknown, novaSenha: unknown, tokenAtual: string): Promise<void>`.

- [ ] **Step 1: Escrever os testes de senha que falham**

Crie `web/lib/senha.test.ts`:

```ts
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
```

- [ ] **Step 2: Escrever os testes de autenticação que falham**

Crie `web/lib/auth.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { BLOQUEIO_MS, DURACAO_SESSAO_MS, MENSAGEM_LOGIN, criarUsuario, encerrarSessao, entrar, trocarSenha, usuarioPorToken } from './auth.ts';

async function cenario() {
  const db = bancoDeTeste();
  const empresaId = inserirEmpresa(db);
  await criarUsuario(db, { email: 'Gestor@Loja.com ', senha: 'senha-temporaria', papel: 'gestor', empresaId, trocarSenha: true });
  return { db, empresaId };
}

test('entra sem diferenciar maiúsculas e recupera o usuário pelo token', async () => {
  const { db, empresaId } = await cenario();
  const { token, usuario } = await entrar(db, ' GESTOR@loja.com', 'senha-temporaria');
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.deepEqual(usuario, { id: usuario.id, email: 'gestor@loja.com', papel: 'gestor', empresaId, empresaNome: 'Loja Teste', trocarSenha: true });
  assert.deepEqual(usuarioPorToken(db, token), usuario);
});

test('senha errada e e-mail inexistente recebem a mesma resposta', async () => {
  const { db } = await cenario();
  await assert.rejects(entrar(db, 'gestor@loja.com', 'errada'), { status: 401, message: MENSAGEM_LOGIN });
  await assert.rejects(entrar(db, 'ninguem@loja.com', 'senha-temporaria'), { status: 401, message: MENSAGEM_LOGIN });
  await assert.rejects(entrar(db, 'sem-arroba', 'senha-temporaria'), { status: 401, message: MENSAGEM_LOGIN });
});

test('bloqueia por 15 minutos após 5 falhas, mesmo com a senha correta', async () => {
  const { db } = await cenario();
  const agora = Date.UTC(2026, 9, 15, 12);
  for (let i = 0; i < 5; i++) await assert.rejects(entrar(db, 'gestor@loja.com', 'errada', agora), { status: 401 });
  await assert.rejects(entrar(db, 'gestor@loja.com', 'senha-temporaria', agora + 1000), { status: 401, message: MENSAGEM_LOGIN });
  const { usuario } = await entrar(db, 'gestor@loja.com', 'senha-temporaria', agora + BLOQUEIO_MS + 1);
  assert.equal(usuario.email, 'gestor@loja.com');
});

test('sessão expira em 14 dias e some no logout', async () => {
  const { db } = await cenario();
  const agora = Date.UTC(2026, 9, 15);
  const { token } = await entrar(db, 'gestor@loja.com', 'senha-temporaria', agora);
  assert.ok(usuarioPorToken(db, token, agora + DURACAO_SESSAO_MS - 1));
  assert.equal(usuarioPorToken(db, token, agora + DURACAO_SESSAO_MS + 1), null);
  encerrarSessao(db, token);
  assert.equal(usuarioPorToken(db, token, agora), null);
});

test('empresa desativada impede login e derruba sessões abertas', async () => {
  const { db, empresaId } = await cenario();
  const { token } = await entrar(db, 'gestor@loja.com', 'senha-temporaria');
  db.prepare('UPDATE empresas SET ativa = 0 WHERE id = ?').run(empresaId);
  assert.equal(usuarioPorToken(db, token), null);
  await assert.rejects(entrar(db, 'gestor@loja.com', 'senha-temporaria'), { status: 401 });
});

test('trocar a senha exige a atual, desliga a troca pendente e encerra as outras sessões', async () => {
  const { db } = await cenario();
  const a = await entrar(db, 'gestor@loja.com', 'senha-temporaria');
  const b = await entrar(db, 'gestor@loja.com', 'senha-temporaria');
  await assert.rejects(trocarSenha(db, a.usuario.id, 'errada', 'nova-senha-123', a.token), { status: 400 });
  await assert.rejects(trocarSenha(db, a.usuario.id, 'senha-temporaria', 'senha-temporaria', a.token), { status: 400 });
  await trocarSenha(db, a.usuario.id, 'senha-temporaria', 'nova-senha-123', a.token);
  assert.equal(usuarioPorToken(db, a.token)?.trocarSenha, false);
  assert.equal(usuarioPorToken(db, b.token), null);
  await assert.rejects(entrar(db, 'gestor@loja.com', 'senha-temporaria'), { status: 401 });
  assert.ok((await entrar(db, 'gestor@loja.com', 'nova-senha-123')).token);
});

test('e-mail repetido é recusado com 409', async () => {
  const { db, empresaId } = await cenario();
  await assert.rejects(criarUsuario(db, { email: 'gestor@loja.com', senha: 'outra-senha', papel: 'admin', empresaId: null, trocarSenha: false }), { status: 409 });
  assert.ok(empresaId);
});

test('token malformado ou ausente não autentica', () => {
  const db = bancoDeTeste();
  assert.equal(usuarioPorToken(db, 'abc'), null);
  assert.equal(usuarioPorToken(db, undefined), null);
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `senha.ts` e `auth.ts`.

- [ ] **Step 4: Criar `web/lib/http.ts`**

```ts
export class HttpErro extends Error {
  status: number;
  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
    this.name = 'HttpErro';
  }
}

export function errorResponse(error: unknown, status = 400): Response {
  const codigo = error instanceof HttpErro ? error.status : status;
  const mensagem = error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
  return Response.json({ error: mensagem }, { status: codigo, headers: { 'Cache-Control': 'no-store' } });
}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) throw new HttpErro(403, 'Origem da solicitação inválida.');
}

export async function lerJson(request: Request, limite = 110_000): Promise<Record<string, unknown>> {
  const texto = await request.text();
  if (texto.length > limite) throw new HttpErro(413, 'Conteúdo extenso demais.');
  try {
    const valor: unknown = JSON.parse(texto);
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) return valor as Record<string, unknown>;
  } catch {
    // Cai na resposta padrão abaixo.
  }
  throw new HttpErro(400, 'Solicitação inválida.');
}
```

- [ ] **Step 5: Criar `web/lib/senha.ts`**

```ts
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
```

- [ ] **Step 6: Criar `web/lib/auth.ts`**

```ts
import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { HttpErro } from './http.ts';
import { hashSenha, validarNovaSenha, verificarSenha } from './senha.ts';

export type Papel = 'admin' | 'gestor';
export type Usuario = { id: string; email: string; papel: Papel; empresaId: string | null; empresaNome: string | null; trocarSenha: boolean };

export const DURACAO_SESSAO_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_FALHAS = 5;
export const BLOQUEIO_MS = 15 * 60 * 1000;
export const MENSAGEM_LOGIN = 'E-mail ou senha incorretos. Após várias tentativas, aguarde 15 minutos.';

type Linha = {
  id: string; email: string; senha_hash: string; papel: Papel; empresa_id: string | null; trocar_senha: number;
  falhas: number; bloqueado_ate: number; empresa_nome: string | null; empresa_ativa: number | null;
};
const SELECIONAR = `SELECT u.id, u.email, u.senha_hash, u.papel, u.empresa_id, u.trocar_senha, u.falhas, u.bloqueado_ate,
  e.nome AS empresa_nome, e.ativa AS empresa_ativa FROM usuarios u LEFT JOIN empresas e ON e.id = u.empresa_id`;

const paraUsuario = (l: Linha): Usuario => ({
  id: l.id, email: l.email, papel: l.papel, empresaId: l.empresa_id, empresaNome: l.empresa_nome, trocarSenha: Number(l.trocar_senha) === 1,
});
const empresaBloqueada = (l: Linha) => l.papel === 'gestor' && Number(l.empresa_ativa) !== 1;

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export function normalizarEmail(email: unknown): string {
  const valor = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (valor.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) throw new HttpErro(400, 'Informe um e-mail válido.');
  return valor;
}

let hashFicticio: Promise<string> | undefined;

function criarSessao(db: DatabaseSync, usuarioId: string, agora: number): string {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO auth_sessoes (token_hash, usuario_id, expira, criada_em) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), usuarioId, agora + DURACAO_SESSAO_MS, new Date(agora).toISOString());
  return token;
}

export async function entrar(db: DatabaseSync, emailInformado: unknown, senha: unknown, agora = Date.now()): Promise<{ token: string; usuario: Usuario }> {
  const negar = () => new HttpErro(401, MENSAGEM_LOGIN);
  let email: string;
  try { email = normalizarEmail(emailInformado); } catch { throw negar(); }
  if (typeof senha !== 'string' || senha.length > 200) throw negar();
  const linha = db.prepare(`${SELECIONAR} WHERE u.email = ?`).get(email) as Linha | undefined;
  if (!linha) {
    // Mesmo custo de uma conta existente, para não revelar quais e-mails estão cadastrados.
    await verificarSenha(senha, await (hashFicticio ??= hashSenha('senha-ficticia-para-equalizar-tempo')));
    throw negar();
  }
  const correta = await verificarSenha(senha, linha.senha_hash);
  if (Number(linha.bloqueado_ate) > agora) throw negar();
  if (!correta) {
    const falhas = Number(linha.falhas) + 1;
    const bloquear = falhas >= MAX_FALHAS;
    db.prepare('UPDATE usuarios SET falhas = ?, bloqueado_ate = ? WHERE id = ?').run(bloquear ? 0 : falhas, bloquear ? agora + BLOQUEIO_MS : 0, linha.id);
    throw negar();
  }
  if (empresaBloqueada(linha)) throw negar();
  db.prepare('UPDATE usuarios SET falhas = 0, bloqueado_ate = 0, ultimo_acesso = ? WHERE id = ?').run(new Date(agora).toISOString(), linha.id);
  return { token: criarSessao(db, linha.id, agora), usuario: paraUsuario(linha) };
}

export function usuarioPorToken(db: DatabaseSync, token: string | undefined, agora = Date.now()): Usuario | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const linha = db.prepare(`${SELECIONAR} JOIN auth_sessoes s ON s.usuario_id = u.id WHERE s.token_hash = ? AND s.expira > ?`)
    .get(hashToken(token), agora) as Linha | undefined;
  if (!linha || empresaBloqueada(linha)) return null;
  return paraUsuario(linha);
}

export function encerrarSessao(db: DatabaseSync, token: string | undefined): void {
  if (token) db.prepare('DELETE FROM auth_sessoes WHERE token_hash = ?').run(hashToken(token));
}

export function inserirUsuario(db: DatabaseSync, dados: { email: string; senhaHash: string; papel: Papel; empresaId: string | null; trocarSenha: boolean }, agora = Date.now()): string {
  const email = normalizarEmail(dados.email);
  if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email)) throw new HttpErro(409, 'Já existe um usuário com este e-mail.');
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO usuarios (id, email, senha_hash, papel, empresa_id, trocar_senha, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, email, dados.senhaHash, dados.papel, dados.empresaId, dados.trocarSenha ? 1 : 0, new Date(agora).toISOString());
  return id;
}

export async function criarUsuario(db: DatabaseSync, dados: { email: string; senha: string; papel: Papel; empresaId: string | null; trocarSenha: boolean }, agora = Date.now()): Promise<string> {
  const senhaHash = await hashSenha(validarNovaSenha(dados.senha));
  return inserirUsuario(db, { email: dados.email, senhaHash, papel: dados.papel, empresaId: dados.empresaId, trocarSenha: dados.trocarSenha }, agora);
}

export async function definirSenha(db: DatabaseSync, usuarioId: string, novaSenha: string, trocarSenha: boolean, manterToken?: string): Promise<void> {
  const hash = await hashSenha(validarNovaSenha(novaSenha));
  db.prepare('UPDATE usuarios SET senha_hash = ?, trocar_senha = ?, falhas = 0, bloqueado_ate = 0 WHERE id = ?').run(hash, trocarSenha ? 1 : 0, usuarioId);
  db.prepare('DELETE FROM auth_sessoes WHERE usuario_id = ? AND token_hash <> ?').run(usuarioId, manterToken ? hashToken(manterToken) : '');
}

export async function trocarSenha(db: DatabaseSync, usuarioId: string, senhaAtual: unknown, novaSenha: unknown, tokenAtual: string): Promise<void> {
  const linha = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(usuarioId) as { senha_hash: string } | undefined;
  if (!linha || typeof senhaAtual !== 'string' || !(await verificarSenha(senhaAtual, linha.senha_hash))) throw new HttpErro(400, 'Senha atual incorreta.');
  const nova = validarNovaSenha(novaSenha);
  if (nova === senhaAtual) throw new HttpErro(400, 'A nova senha precisa ser diferente da atual.');
  await definirSenha(db, usuarioId, nova, false, tokenAtual);
}
```

Nota: em `entrar`, a senha é verificada **antes** de checar o bloqueio, para que conta bloqueada e conta livre levem o mesmo tempo para responder.

- [ ] **Step 7: Rodar os testes**

Run: `cd web && npm test`
Expected: PASS. Cada hash scrypt leva por volta de 0,2–0,6 s, então o conjunto pode levar ~10 s.

- [ ] **Step 8: Commit**

```bash
git add web/lib/http.ts web/lib/senha.ts web/lib/auth.ts web/lib/senha.test.ts web/lib/auth.test.ts
git commit -m "Implementa senhas scrypt, sessoes por token e bloqueio de tentativas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Sessão web, rotas de autenticação e telas de login

**Files:**
- Create: `web/lib/sessao-web.ts`
- Create: `web/app/api/auth/login/route.ts`, `web/app/api/auth/logout/route.ts`, `web/app/api/auth/senha/route.ts`
- Create: `web/components/api.ts`, `web/components/Campo.tsx`
- Create: `web/components/auth/FormularioLogin.tsx`, `web/components/auth/FormularioSenha.tsx`
- Create: `web/app/login/page.tsx`, `web/app/trocar-senha/page.tsx`
- Modify: `web/app/globals.css` (acrescentar no fim)

**Interfaces:**
- Consumes: `db()` (Task 2); `entrar`, `usuarioPorToken`, `encerrarSessao`, `trocarSenha`, `DURACAO_SESSAO_MS`, `type Usuario`, `type Papel` (Task 3); `HttpErro`, `errorResponse`, `sameOrigin`, `lerJson` (Task 3).
- Produces:
  - `lib/sessao-web.ts`:
    - `COOKIE_SESSAO = 'mrcc_auth'`;
    - `type Gestor = Usuario & { empresaId: string; empresaNome: string }`;
    - `tokenAtual(): Promise<string | undefined>`, `usuarioAtual(): Promise<Usuario | null>`;
    - `exigirUsuario(opcoes?: { papel?: Papel; permitirTrocaPendente?: boolean }): Promise<Usuario>` (lança `HttpErro` 401/403);
    - `exigirGestor(): Promise<Gestor>`;
    - `exigirPagina(opcoes?): Promise<Usuario>` e `exigirPaginaGestor(): Promise<Gestor>` (redirecionam);
    - `destinoInicial(u: Usuario): string`, `definirCookieSessao(token)`, `limparCookieSessao()`;
    - `ou404<T>(f: () => T): T` (converte `HttpErro` 404 em `notFound()`).
  - `components/api.ts`: `chamarApi<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<T>`. Lê o JSON com segurança, lança `Error` com a mensagem do servidor e redireciona para `/login` em 401 fora de `/api/auth/`.
  - `components/Campo.tsx`: `Campo({ rotulo, children, largo? })`, `Selecao({ valor, opcoes, aoMudar, vazio? })`, `type Opcao = string | { valor: string; rotulo: string }`.

Esta task é a ponte com o Next.js (cookies, redirect), por isso não tem teste unitário. A regra já está testada na Task 3. A verificação é feita com `curl` e no navegador.

- [ ] **Step 1: Criar `web/lib/sessao-web.ts`**

```ts
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { DURACAO_SESSAO_MS, usuarioPorToken, type Papel, type Usuario } from './auth.ts';
import { db } from './db.ts';
import { HttpErro } from './http.ts';

export const COOKIE_SESSAO = 'mrcc_auth';
export type Gestor = Usuario & { empresaId: string; empresaNome: string };
type Opcoes = { papel?: Papel; permitirTrocaPendente?: boolean };

export async function tokenAtual(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_SESSAO)?.value;
}

export async function usuarioAtual(): Promise<Usuario | null> {
  return usuarioPorToken(db(), await tokenAtual());
}

export const destinoInicial = (u: Usuario): string => (u.trocarSenha ? '/trocar-senha' : u.papel === 'admin' ? '/admin' : '/');

export async function exigirUsuario(opcoes: Opcoes = {}): Promise<Usuario> {
  const usuario = await usuarioAtual();
  if (!usuario) throw new HttpErro(401, 'Sua sessão expirou. Entre novamente.');
  if (usuario.trocarSenha && !opcoes.permitirTrocaPendente) throw new HttpErro(403, 'Troque a senha temporária antes de continuar.');
  if (opcoes.papel && usuario.papel !== opcoes.papel) throw new HttpErro(403, 'Acesso não permitido.');
  return usuario;
}

export async function exigirGestor(): Promise<Gestor> {
  return (await exigirUsuario({ papel: 'gestor' })) as Gestor;
}

export async function exigirPagina(opcoes: Opcoes = {}): Promise<Usuario> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/login');
  if (usuario.trocarSenha && !opcoes.permitirTrocaPendente) redirect('/trocar-senha');
  if (opcoes.papel && usuario.papel !== opcoes.papel) redirect(destinoInicial(usuario));
  return usuario;
}

export async function exigirPaginaGestor(): Promise<Gestor> {
  return (await exigirPagina({ papel: 'gestor' })) as Gestor;
}

export async function definirCookieSessao(token: string): Promise<void> {
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.MRCC_SECURE_COOKIE === '1', path: '/', maxAge: DURACAO_SESSAO_MS / 1000,
  });
}

export async function limparCookieSessao(): Promise<void> {
  (await cookies()).delete(COOKIE_SESSAO);
}

/** Em páginas: recurso inexistente ou de outra empresa vira a página 404 do Next. */
export function ou404<T>(f: () => T): T {
  try {
    return f();
  } catch (erro) {
    if (erro instanceof HttpErro && erro.status === 404) notFound();
    throw erro;
  }
}
```

- [ ] **Step 2: Criar as rotas de autenticação**

`web/app/api/auth/login/route.ts`:

```ts
import { entrar } from '@/lib/auth';
import { db } from '@/lib/db';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { definirCookieSessao, destinoInicial } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const corpo = await lerJson(request, 2000);
    const { token, usuario } = await entrar(db(), corpo.email, corpo.senha);
    await definirCookieSessao(token);
    return Response.json({ destino: destinoInicial(usuario) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/app/api/auth/logout/route.ts`:

```ts
import { encerrarSessao } from '@/lib/auth';
import { db } from '@/lib/db';
import { errorResponse, sameOrigin } from '@/lib/http';
import { limparCookieSessao, tokenAtual } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    encerrarSessao(db(), await tokenAtual());
    await limparCookieSessao();
    return Response.json({ destino: '/login' });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/app/api/auth/senha/route.ts`:

```ts
import { trocarSenha } from '@/lib/auth';
import { db } from '@/lib/db';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { destinoInicial, exigirUsuario, tokenAtual } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const usuario = await exigirUsuario({ permitirTrocaPendente: true });
    const corpo = await lerJson(request, 2000);
    const token = await tokenAtual();
    if (!token) throw new HttpErro(401, 'Sua sessão expirou. Entre novamente.');
    await trocarSenha(db(), usuario.id, corpo.senhaAtual, corpo.novaSenha, token);
    return Response.json({ destino: destinoInicial({ ...usuario, trocarSenha: false }) });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 3: Criar os utilitários de cliente**

`web/components/api.ts`:

```ts
'use client';

/** Chama a API do próprio site; lança Error com a mensagem do servidor. */
export async function chamarApi<T = Record<string, unknown>>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...resto } = init;
  const opcoes: RequestInit = json === undefined ? resto : { ...resto, headers: { 'Content-Type': 'application/json', ...resto.headers }, body: JSON.stringify(json) };
  const resposta = await fetch(url, { cache: 'no-store', ...opcoes });
  const dados = (await resposta.json().catch(() => null)) as (T & { error?: string }) | null;
  if (resposta.status === 401 && !url.startsWith('/api/auth/')) {
    window.location.assign('/login');
    throw new Error('Sua sessão expirou. Entre novamente.');
  }
  if (!resposta.ok) {
    throw new Error(dados?.error || (resposta.status === 429 ? 'Muitas solicitações. Aguarde um minuto e tente novamente.' : 'Não foi possível concluir a operação.'));
  }
  return (dados ?? {}) as T;
}
```

`web/components/Campo.tsx`:

```tsx
export type Opcao = string | { valor: string; rotulo: string };

export function Campo({ rotulo, children, largo = false }: { rotulo: string; children: React.ReactNode; largo?: boolean }) {
  return <label className={`field ${largo ? 'wide' : ''}`}><span>{rotulo}</span>{children}</label>;
}

export function Selecao({ valor, opcoes, aoMudar, vazio = 'Selecione' }: { valor: string; opcoes: readonly Opcao[]; aoMudar: (v: string) => void; vazio?: string }) {
  const lista = opcoes.map(o => (typeof o === 'string' ? { valor: o, rotulo: o } : o));
  const conhecido = lista.some(o => o.valor === valor);
  return (
    <select value={conhecido ? valor : ''} onChange={e => aoMudar(e.target.value)}>
      {!conhecido && <option value="" disabled>{vazio}</option>}
      {lista.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
    </select>
  );
}
```

- [ ] **Step 4: Criar os formulários de login e de senha**

`web/components/auth/FormularioLogin.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';

export default function FormularioLogin() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const { destino } = await chamarApi<{ destino: string }>('/api/auth/login', { method: 'POST', json: { email, senha } });
      window.location.assign(destino);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível entrar.');
      setEnviando(false);
    }
  };
  return (
    <form className="auth-card" onSubmit={enviar}>
      <div className="brand"><span className="brand-mark">M</span><span>MRCC<span className="brand-suffix">/PV</span><small>Redesenho de cargos e competências</small></span></div>
      <h1>Entrar</h1>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <Campo rotulo="E-mail"><input type="email" autoComplete="username" required maxLength={200} value={email} onChange={e => setEmail(e.target.value)} /></Campo>
      <Campo rotulo="Senha"><input type="password" autoComplete="current-password" required maxLength={200} value={senha} onChange={e => setSenha(e.target.value)} /></Campo>
      <button className="button primary" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      <p className="helper">O acesso é criado pela equipe da pesquisa. Esqueceu a senha? Fale com quem cadastrou sua loja.</p>
    </form>
  );
}
```

`web/components/auth/FormularioSenha.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';

export default function FormularioSenha({ primeiroAcesso }: { primeiroAcesso: boolean }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (nova !== confirmacao) {
      setErro('A confirmação não confere com a nova senha.');
      return;
    }
    setEnviando(true);
    try {
      const { destino } = await chamarApi<{ destino: string }>('/api/auth/senha', { method: 'POST', json: { senhaAtual: atual, novaSenha: nova } });
      window.location.assign(destino);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível trocar a senha.');
      setEnviando(false);
    }
  };
  return (
    <form className="auth-card" onSubmit={enviar}>
      <h1>{primeiroAcesso ? 'Crie sua senha' : 'Trocar senha'}</h1>
      <p className="helper">{primeiroAcesso ? 'A senha que você recebeu é temporária. Escolha uma senha só sua, com pelo menos 8 caracteres.' : 'Use pelo menos 8 caracteres.'}</p>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <Campo rotulo={primeiroAcesso ? 'Senha temporária' : 'Senha atual'}><input type="password" autoComplete="current-password" required maxLength={200} value={atual} onChange={e => setAtual(e.target.value)} /></Campo>
      <Campo rotulo="Nova senha"><input type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={nova} onChange={e => setNova(e.target.value)} /></Campo>
      <Campo rotulo="Repita a nova senha"><input type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={confirmacao} onChange={e => setConfirmacao(e.target.value)} /></Campo>
      <button className="button primary" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar senha'}</button>
    </form>
  );
}
```

- [ ] **Step 5: Criar as páginas**

`web/app/login/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import FormularioLogin from '@/components/auth/FormularioLogin';
import { destinoInicial, usuarioAtual } from '@/lib/sessao-web';

export default async function Login() {
  const usuario = await usuarioAtual();
  if (usuario) redirect(destinoInicial(usuario));
  return <main className="auth-shell"><FormularioLogin /></main>;
}
```

`web/app/trocar-senha/page.tsx`:

```tsx
import FormularioSenha from '@/components/auth/FormularioSenha';
import { exigirPagina } from '@/lib/sessao-web';

export default async function TrocarSenha() {
  const usuario = await exigirPagina({ permitirTrocaPendente: true });
  return <main className="auth-shell"><FormularioSenha primeiroAcesso={usuario.trocarSenha} /></main>;
}
```

- [ ] **Step 6: Acrescentar estilos no fim de `web/app/globals.css`**

```css

/* Contas e páginas da loja */
.page{max-width:1180px;margin:auto;padding:38px 34px 60px}
.page.narrow{max-width:760px}
.panel{background:white;border:1px solid var(--line);border-radius:9px;padding:24px;margin:0 0 26px;display:flex;flex-direction:column;gap:16px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:26px}
.card{display:flex;flex-direction:column;gap:8px;align-items:flex-start;background:white;border:1px solid var(--line);border-radius:9px;padding:22px;text-align:left;width:100%;color:inherit;font:inherit;transition:border-color .15s}
.card:hover{border-color:#9fb3c9}
.auth-shell{min-height:100vh;display:grid;place-items:center;padding:24px 16px}
.auth-card{width:min(430px,100%);background:white;border:1px solid var(--line);border-radius:10px;padding:32px;display:flex;flex-direction:column;gap:18px}
.auth-card .brand{font-size:22px}
.secret{font:600 18px/1.4 ui-monospace,Consolas,monospace;background:white;border:1px solid #ccdbef;border-radius:5px;padding:3px 9px;letter-spacing:1px}
.row-actions{display:flex;gap:14px;white-space:nowrap}
.text-button.danger{color:#a43439}
@media(min-width:1201px){.shell.sem-resumo{grid-template-columns:235px minmax(0,1fr)}}
@media(max-width:760px){.page{padding:26px 16px 50px}.form-grid{grid-template-columns:1fr}.auth-card{padding:24px}}
```

- [ ] **Step 7: Verificar o build**

Run: `cd web && npm test && npm run build`
Expected: testes passam; o build lista as rotas `/login`, `/trocar-senha`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/senha`.

- [ ] **Step 8: Verificar com o servidor local**

Em um terminal: `cd web && npm run dev`. Em outro, crie um gestor de teste direto no banco local (o script oficial de admin vem na Task 5):

```bash
cd web && node --disable-warning=ExperimentalWarning -e "
import('./lib/db.ts').then(async ({ db }) => {
  const { criarUsuario } = await import('./lib/auth.ts');
  const banco = db(); const id = crypto.randomUUID();
  banco.prepare(\"INSERT INTO empresas (id, nome, criada_em) VALUES (?, 'Loja Local', datetime('now'))\").run(id);
  await criarUsuario(banco, { email: 'gestor@local.test', senha: 'temporaria-123', papel: 'gestor', empresaId: id, trocarSenha: true });
  console.log('ok');
});"
curl -s -c /tmp/c.txt -H 'Content-Type: application/json' -d '{"email":"gestor@local.test","senha":"errada"}' http://localhost:3000/api/auth/login
curl -s -c /tmp/c.txt -H 'Content-Type: application/json' -d '{"email":"gestor@local.test","senha":"temporaria-123"}' http://localhost:3000/api/auth/login
```

Expected:
- primeira chamada: `{"error":"E-mail ou senha incorretos. Após várias tentativas, aguarde 15 minutos."}`;
- segunda chamada: `{"destino":"/trocar-senha"}`.

No navegador, abra `http://localhost:3000/login`, entre com `gestor@local.test` / `temporaria-123`. A página deve redirecionar para "Crie sua senha". Troque para `gestor-local-123`; o redirecionamento para `/` ainda mostra o formulário antigo até a Task 10, e isso é esperado.

- [ ] **Step 9: Commit**

```bash
git add web/lib/sessao-web.ts web/app/api/auth web/components/api.ts web/components/Campo.tsx web/components/auth web/app/login web/app/trocar-senha web/app/globals.css
git commit -m "Adiciona login, troca de senha e protecao de rotas por sessao" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Script de criação do admin

**Files:**
- Create: `web/scripts/criar-admin.mjs`

**Interfaces:**
- Consumes: `caminhoBanco`, `prepararBanco` (Task 2); `criarUsuario`, `definirSenha`, `normalizarEmail` (Task 3).
- Produces: comando `node scripts/criar-admin.mjs <email>`, executado dentro de `web/`. Lê a senha duas vezes; se a entrada não for um terminal, lê duas linhas da entrada padrão. Se o e-mail já for de um admin, redefine a senha e encerra as sessões dele. Recusa e-mail de gestor.

- [ ] **Step 1: Criar `web/scripts/criar-admin.mjs`**

```js
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
```

- [ ] **Step 2: Verificar criação, redefinição e recusa**

Run (dentro de `web/`):

```bash
printf 'admin-local-123\nadmin-local-123\n' | node --disable-warning=ExperimentalWarning scripts/criar-admin.mjs admin@local.test
printf 'admin-local-456\nadmin-local-456\n' | node --disable-warning=ExperimentalWarning scripts/criar-admin.mjs admin@local.test
printf 'abc\nxyz\n' | node --disable-warning=ExperimentalWarning scripts/criar-admin.mjs admin@local.test
printf 'qualquer-123\nqualquer-123\n' | node --disable-warning=ExperimentalWarning scripts/criar-admin.mjs gestor@local.test
```

Expected, em ordem:
1. `Admin admin@local.test criado.`
2. `Senha do admin admin@local.test redefinida; sessões anteriores encerradas.`
3. `Erro: As senhas não conferem.` (código de saída 1)
4. `Erro: Este e-mail já pertence ao gestor de uma empresa.` (código de saída 1; o gestor foi criado no Step 8 da Task 4)

Depois, com `npm run dev` rodando, entre em `http://localhost:3000/login` com `admin@local.test` / `admin-local-456`. O redirecionamento para `/admin` dá 404 até a Task 6, e isso é esperado.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/criar-admin.mjs
git commit -m "Adiciona script para criar o admin pela VM" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Admin de empresas

**Files:**
- Create: `web/lib/empresas.ts`
- Test: `web/lib/empresas.test.ts`
- Create: `web/app/api/admin/empresas/route.ts`, `web/app/api/admin/empresas/[id]/route.ts`
- Create: `web/components/Topo.tsx`, `web/components/BotaoSair.tsx`, `web/components/admin/PainelEmpresas.tsx`
- Create: `web/app/admin/layout.tsx`, `web/app/admin/page.tsx`

**Interfaces:**
- Consumes: `transacao` (Task 2); `inserirUsuario`, `normalizarEmail`, `definirSenha`, `entrar`, `usuarioPorToken` (Task 3); `gerarSenhaTemporaria`, `hashSenha` (Task 3); `HttpErro` (Task 3); `exigirUsuario`, `exigirPagina` (Task 4); `chamarApi`, `Campo` (Task 4).
- Produces:
  - `lib/empresas.ts`:
    - `type ResumoEmpresa = { id: string; nome: string; cidade: string; segmento: string; ativa: boolean; criadaEm: string; emailGestor: string | null; ultimoAcesso: string | null; funcoes: number; ocupantes: number; trilhas: number }`;
    - `criarEmpresaComGestor(db, dados: Record<string, unknown>, agora?): Promise<{ empresaId: string; email: string; senhaTemporaria: string }>`;
    - `listarEmpresas(db): ResumoEmpresa[]`;
    - `definirEmpresaAtiva(db, empresaId: string, ativa: boolean): void`;
    - `redefinirSenhaGestor(db, empresaId: string): Promise<string>`.
  - `components/Topo.tsx`: `Topo({ subtitulo, inicio? })`.

- [ ] **Step 1: Escrever os testes que falham**

Crie `web/lib/empresas.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste } from './apoio-testes.ts';
import { entrar, usuarioPorToken } from './auth.ts';
import { criarEmpresaComGestor, definirEmpresaAtiva, listarEmpresas, redefinirSenhaGestor } from './empresas.ts';

test('cria empresa com gestor e senha temporária que exige troca', async () => {
  const db = bancoDeTeste();
  const r = await criarEmpresaComGestor(db, { nome: ' Loja Azul ', cidade: 'Curitiba', segmento: 'Material de construção', email: 'Dono@Azul.com' });
  assert.equal(r.email, 'dono@azul.com');
  assert.match(r.senhaTemporaria, /^[A-Za-z2-9]{12}$/);
  const { usuario } = await entrar(db, 'dono@azul.com', r.senhaTemporaria);
  assert.equal(usuario.trocarSenha, true);
  assert.equal(usuario.empresaNome, 'Loja Azul');
  assert.equal(usuario.empresaId, r.empresaId);
});

test('recusa e-mail repetido sem deixar empresa sem gestor', async () => {
  const db = bancoDeTeste();
  await criarEmpresaComGestor(db, { nome: 'A', email: 'x@x.com' });
  await assert.rejects(criarEmpresaComGestor(db, { nome: 'B', email: 'X@x.com' }), { status: 409 });
  assert.equal(listarEmpresas(db).length, 1);
});

test('exige nome e e-mail válidos', async () => {
  const db = bancoDeTeste();
  await assert.rejects(criarEmpresaComGestor(db, { nome: '  ', email: 'x@x.com' }), { status: 400 });
  await assert.rejects(criarEmpresaComGestor(db, { nome: 'A', email: 'sem-arroba' }), { status: 400 });
  await assert.rejects(criarEmpresaComGestor(db, { nome: 'A'.repeat(121), email: 'x@x.com' }), { status: 400 });
});

test('desativar derruba a sessão do gestor; redefinir senha troca a credencial', async () => {
  const db = bancoDeTeste();
  const r = await criarEmpresaComGestor(db, { nome: 'A', email: 'x@x.com' });
  const { token } = await entrar(db, 'x@x.com', r.senhaTemporaria);
  definirEmpresaAtiva(db, r.empresaId, false);
  assert.equal(usuarioPorToken(db, token), null);
  assert.equal(listarEmpresas(db)[0].ativa, false);
  definirEmpresaAtiva(db, r.empresaId, true);
  const nova = await redefinirSenhaGestor(db, r.empresaId);
  await assert.rejects(entrar(db, 'x@x.com', r.senhaTemporaria), { status: 401 });
  assert.equal((await entrar(db, 'x@x.com', nova)).usuario.trocarSenha, true);
});

test('empresa inexistente responde 404', async () => {
  const db = bancoDeTeste();
  assert.throws(() => definirEmpresaAtiva(db, crypto.randomUUID(), false), { status: 404 });
  await assert.rejects(redefinirSenhaGestor(db, crypto.randomUUID()), { status: 404 });
});

test('lista com gestor e contagens de funções, ocupantes e trilhas ativos', async () => {
  const db = bancoDeTeste();
  const r = await criarEmpresaComGestor(db, { nome: 'Loja', email: 'g@l.com' });
  const gestor = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('g@l.com') as { id: string };
  const agora = new Date().toISOString();
  const funcao = (id: string, arquivada: number) => db.prepare("INSERT INTO funcoes (id, empresa_id, nome, estrutura, origem, arquivada, criada_em, atualizada_em) VALUES (?, ?, 'F', '{}', 'branco', ?, ?, ?)").run(id, r.empresaId, arquivada, agora, agora);
  const f1 = crypto.randomUUID();
  funcao(f1, 0);
  funcao(crypto.randomUUID(), 1);
  const o1 = crypto.randomUUID();
  db.prepare("INSERT INTO ocupantes (id, funcao_id, apelido, criado_em, atualizado_em) VALUES (?, ?, 'A1', ?, ?)").run(o1, f1, agora, agora);
  db.prepare("INSERT INTO execucoes (id, tipo, empresa_id, funcao_id, ocupante_id, criada_por, criada_em) VALUES (?, 'trilha', ?, ?, ?, ?, ?)").run(crypto.randomUUID(), r.empresaId, f1, o1, gestor.id, agora);
  db.prepare("INSERT INTO execucoes (id, tipo, empresa_id, funcao_id, ocupante_id, criada_por, criada_em) VALUES (?, 'diagnostico', ?, ?, ?, ?, ?)").run(crypto.randomUUID(), r.empresaId, f1, o1, gestor.id, agora);
  const [e] = listarEmpresas(db);
  assert.deepEqual({ email: e.emailGestor, funcoes: e.funcoes, ocupantes: e.ocupantes, trilhas: e.trilhas, ultimoAcesso: e.ultimoAcesso }, { email: 'g@l.com', funcoes: 1, ocupantes: 1, trilhas: 1, ultimoAcesso: null });
  assert.equal(Object.getPrototypeOf(e), Object.prototype);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `empresas.ts`.

- [ ] **Step 3: Implementar `web/lib/empresas.ts`**

```ts
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
```

- [ ] **Step 4: Rodar os testes**

Run: `cd web && npm test`
Expected: PASS.

- [ ] **Step 5: Criar as rotas do admin**

`web/app/api/admin/empresas/route.ts`:

```ts
import { db } from '@/lib/db';
import { criarEmpresaComGestor, listarEmpresas } from '@/lib/empresas';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await exigirUsuario({ papel: 'admin' });
    return Response.json({ empresas: listarEmpresas(db()) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await exigirUsuario({ papel: 'admin' });
    const criada = await criarEmpresaComGestor(db(), await lerJson(request, 5000));
    return Response.json(criada, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/app/api/admin/empresas/[id]/route.ts`:

```ts
import { db } from '@/lib/db';
import { definirEmpresaAtiva, redefinirSenhaGestor } from '@/lib/empresas';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function PATCH(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    await exigirUsuario({ papel: 'admin' });
    const { id } = await contexto.params;
    const { acao } = await lerJson(request, 1000);
    if (acao === 'ativar' || acao === 'desativar') {
      definirEmpresaAtiva(db(), id, acao === 'ativar');
      return Response.json({ ok: true });
    }
    if (acao === 'redefinir-senha') {
      return Response.json({ senhaTemporaria: await redefinirSenhaGestor(db(), id) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    throw new HttpErro(400, 'Ação inválida.');
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 6: Criar o topo e o botão de sair**

`web/components/BotaoSair.tsx`:

```tsx
'use client';

export default function BotaoSair() {
  const sair = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/login');
  };
  return <button className="button secondary small" onClick={() => void sair()}>Sair</button>;
}
```

`web/components/Topo.tsx`:

```tsx
import BotaoSair from './BotaoSair';

export default function Topo({ subtitulo, inicio = '/' }: { subtitulo: string; inicio?: string }) {
  return (
    <header className="topbar">
      <a className="brand" href={inicio}><span className="brand-mark">M</span><span>MRCC<span className="brand-suffix">/PV</span><small>{subtitulo}</small></span></a>
      <div className="header-actions"><BotaoSair /></div>
    </header>
  );
}
```

- [ ] **Step 7: Criar o painel do admin**

`web/components/admin/PainelEmpresas.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';
import type { ResumoEmpresa } from '@/lib/empresas';

const VAZIO = { nome: '', cidade: '', segmento: '', email: '' };
type Acao = 'ativar' | 'desativar' | 'redefinir-senha';

export default function PainelEmpresas({ iniciais }: { iniciais: ResumoEmpresa[] }) {
  const [empresas, setEmpresas] = useState(iniciais);
  const [form, setForm] = useState(VAZIO);
  const [credencial, setCredencial] = useState<{ email: string; senha: string } | null>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const executar = async (acao: () => Promise<void>) => {
    setErro('');
    setOcupado(true);
    try { await acao(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível concluir.'); } finally { setOcupado(false); }
  };
  const recarregar = async () => setEmpresas((await chamarApi<{ empresas: ResumoEmpresa[] }>('/api/admin/empresas')).empresas);
  const criar = (e: React.FormEvent) => {
    e.preventDefault();
    void executar(async () => {
      const r = await chamarApi<{ email: string; senhaTemporaria: string }>('/api/admin/empresas', { method: 'POST', json: form });
      setCredencial({ email: r.email, senha: r.senhaTemporaria });
      setForm(VAZIO);
      await recarregar();
    });
  };
  const alterar = (empresa: ResumoEmpresa, acao: Acao) => {
    const perguntas: Record<Acao, string> = {
      ativar: `Reativar ${empresa.nome}?`,
      desativar: `Desativar ${empresa.nome}? O gestor perde o acesso até a reativação.`,
      'redefinir-senha': `Gerar nova senha temporária para ${empresa.emailGestor}? A senha atual deixa de funcionar.`,
    };
    if (!window.confirm(perguntas[acao])) return;
    void executar(async () => {
      const r = await chamarApi<{ senhaTemporaria?: string }>(`/api/admin/empresas/${empresa.id}`, { method: 'PATCH', json: { acao } });
      if (r.senhaTemporaria) setCredencial({ email: empresa.emailGestor ?? '', senha: r.senhaTemporaria });
      await recarregar();
    });
  };
  const mudar = (campo: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [campo]: e.target.value });
  return (
    <main className="page">
      <div className="page-heading"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Empresas participantes</h1><p>Cadastre cada loja com o e-mail do gestor. A senha temporária aparece uma única vez.</p></div></div>
      {erro && <div className="alert error" role="alert">{erro}<button onClick={() => setErro('')} aria-label="Fechar aviso">×</button></div>}
      {credencial && (
        <div className="alert info" role="status">
          <strong>Acesso de {credencial.email}</strong>
          <p>Senha temporária: <code className="secret">{credencial.senha}</code></p>
          <p>Copie e envie ao gestor agora. Ela não será mostrada de novo; no primeiro acesso o gestor cria a própria senha.</p>
          <button className="text-button" onClick={() => setCredencial(null)}>Já copiei</button>
        </div>
      )}
      <form className="panel form-grid" onSubmit={criar}>
        <h2 className="wide">Nova empresa</h2>
        <Campo rotulo="Nome da loja"><input required maxLength={120} value={form.nome} onChange={mudar('nome')} /></Campo>
        <Campo rotulo="E-mail do gestor"><input type="email" required maxLength={200} value={form.email} onChange={mudar('email')} /></Campo>
        <Campo rotulo="Cidade"><input maxLength={120} value={form.cidade} onChange={mudar('cidade')} /></Campo>
        <Campo rotulo="Segmento"><input maxLength={120} value={form.segmento} onChange={mudar('segmento')} placeholder="Ex.: material de construção" /></Campo>
        <div className="wide"><button className="button primary" disabled={ocupado}>Cadastrar empresa</button></div>
      </form>
      <div className="priority-table">
        <div className="section-title"><h2>Empresas <span>{empresas.length}</span></h2></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Loja</th><th>Gestor</th><th>Último acesso</th><th>Funções</th><th>Ocupantes</th><th>Trilhas</th><th>Situação</th><th></th></tr></thead>
            <tbody>{empresas.map(e => (
              <tr key={e.id}>
                <td><strong>{e.nome}</strong><br /><span className="helper">{[e.segmento, e.cidade].filter(Boolean).join(' · ')}</span></td>
                <td>{e.emailGestor ?? '—'}</td>
                <td>{e.ultimoAcesso ? new Date(e.ultimoAcesso).toLocaleString('pt-BR') : 'Nunca'}</td>
                <td>{e.funcoes}</td><td>{e.ocupantes}</td><td>{e.trilhas}</td>
                <td><span className={`badge ${e.ativa ? 'medium' : 'none'}`}>{e.ativa ? 'Ativa' : 'Desativada'}</span></td>
                <td><div className="row-actions">
                  <button className="text-button" disabled={ocupado} onClick={() => alterar(e, 'redefinir-senha')}>Nova senha</button>
                  <button className="text-button danger" disabled={ocupado} onClick={() => alterar(e, e.ativa ? 'desativar' : 'ativar')}>{e.ativa ? 'Desativar' : 'Reativar'}</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
```

`web/app/admin/layout.tsx`:

```tsx
import Topo from '@/components/Topo';
import { exigirPagina } from '@/lib/sessao-web';

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await exigirPagina({ papel: 'admin' });
  return <><Topo subtitulo="Administração da pesquisa" inicio="/admin" />{children}</>;
}
```

`web/app/admin/page.tsx`:

```tsx
import PainelEmpresas from '@/components/admin/PainelEmpresas';
import { db } from '@/lib/db';
import { listarEmpresas } from '@/lib/empresas';
import { exigirPagina } from '@/lib/sessao-web';

export default async function Admin() {
  await exigirPagina({ papel: 'admin' });
  return <PainelEmpresas iniciais={listarEmpresas(db())} />;
}
```

- [ ] **Step 8: Verificar build e fluxo**

Run: `cd web && npm test && npm run build`
Expected: PASS e build com `/admin`, `/api/admin/empresas`, `/api/admin/empresas/[id]`.

Com `npm run dev`, entre como `admin@local.test` / `admin-local-456`:
1. Cadastre "Loja Demo", e-mail `demo@local.test`. Deve aparecer o aviso com a senha temporária.
2. Clique em "Nova senha" e confirme: aparece outra senha temporária.
3. Clique em "Desativar" e confirme: a situação muda para "Desativada". Clique em "Reativar".
4. Em outra janela anônima, entre com `demo@local.test` e a última senha: deve cair em "Crie sua senha".
5. Acesse `/admin` com essa conta de gestor: deve redirecionar para `/` (ou `/trocar-senha`, se a troca ainda estiver pendente).

- [ ] **Step 9: Commit**

```bash
git add web/lib/empresas.ts web/lib/empresas.test.ts web/app/api/admin web/components/Topo.tsx web/components/BotaoSair.tsx web/components/admin web/app/admin
git commit -m "Adiciona painel do admin para cadastrar e gerenciar empresas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Funções e ocupantes — repositórios e API

**Files:**
- Create: `web/lib/funcoes.ts`, `web/lib/ocupantes.ts`
- Test: `web/lib/funcoes.test.ts`, `web/lib/ocupantes.test.ts`
- Create: `web/app/api/funcoes/route.ts`, `web/app/api/funcoes/[id]/route.ts`, `web/app/api/funcoes/[id]/ocupantes/route.ts`, `web/app/api/ocupantes/[id]/route.ts`

**Interfaces:**
- Consumes: `validarEstrutura`, `pendenciasEstrutura`, `estruturaVazia`, `NIVEIS`, `type Estrutura`, `type Niveis`, `type Nivel` (Task 1); `bancoDeTeste`, `inserirEmpresa` (Task 2); `HttpErro`, `errorResponse`, `lerJson`, `sameOrigin` (Task 3); `exigirGestor` (Task 4).
- Produces:
  - `lib/funcoes.ts`:
    - `type Funcao = { id: string; empresaId: string; nome: string; estrutura: Estrutura; origem: string; criadaEm: string; atualizadaEm: string }`;
    - `type ResumoFuncao = { id: string; nome: string; atualizadaEm: string; tarefas: number; competencias: number; salvaguardasRespondidas: number; pendencias: number; ocupantes: number; trilhas: number }`;
    - `validarNomeFuncao(v: unknown): string`, `estruturaValida(v: unknown): Estrutura` (lança `HttpErro` 400);
    - `criarFuncao(db, empresaId: string, dados: { nome: unknown; estrutura: unknown; origem: string }, agora?): string`;
    - `obterFuncao(db, empresaId: string | null, id: string): Funcao` (`null` = admin, sem filtro);
    - `salvarFuncao(db, empresaId: string, id: string, dados: { nome: unknown; estrutura: unknown }, agora?): void`;
    - `arquivarFuncao(db, empresaId: string, id: string): void`;
    - `listarFuncoes(db, empresaId: string): ResumoFuncao[]`.
  - `lib/ocupantes.ts`:
    - `type Ocupante = { id: string; funcaoId: string; empresaId: string; apelido: string; niveis: Niveis; prazoDias: number; criadoEm: string; atualizadoEm: string }`;
    - `type ResumoOcupante = { id: string; apelido: string; niveisPreenchidos: number; trilhas: number; atualizadoEm: string }`;
    - `validarApelido(v)`, `validarPrazo(v)`, `validarNiveis(v): Niveis`;
    - `criarOcupante(db, empresaId: string, funcaoId: string, dados: { apelido: unknown; niveis?: Niveis }, agora?): string`;
    - `obterOcupante(db, empresaId: string | null, id: string): Ocupante`;
    - `salvarOcupante(db, empresaId: string, id: string, dados: { apelido: unknown; niveis: unknown; prazoDias: unknown }, agora?): void`;
    - `arquivarOcupante(db, empresaId: string, id: string): void`;
    - `listarOcupantes(db, empresaId: string | null, funcaoId: string): ResumoOcupante[]`.

- [ ] **Step 1: Escrever os testes de funções que falham**

Crie `web/lib/funcoes.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { estruturaVazia } from './estrutura.ts';
import { arquivarFuncao, criarFuncao, listarFuncoes, obterFuncao, salvarFuncao } from './funcoes.ts';

test('cria, obtém e salva função dentro da própria empresa', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const id = criarFuncao(db, a, { nome: ' Caixa ', estrutura: estruturaVazia(), origem: 'branco' });
  assert.equal(obterFuncao(db, a, id).nome, 'Caixa');
  assert.throws(() => obterFuncao(db, b, id), { status: 404 });
  assert.equal(obterFuncao(db, null, id).id, id);
  const e = estruturaVazia();
  e.tarefas[0].tarefa = 'Registrar vendas';
  salvarFuncao(db, a, id, { nome: 'Operador de caixa', estrutura: e });
  assert.equal(obterFuncao(db, a, id).estrutura.tarefas[0].tarefa, 'Registrar vendas');
  assert.throws(() => salvarFuncao(db, b, id, { nome: 'Invasão', estrutura: e }), { status: 404 });
});

test('rejeita nome vazio e estrutura inválida sem alterar a função', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  assert.throws(() => criarFuncao(db, a, { nome: '  ', estrutura: estruturaVazia(), origem: 'branco' }), { status: 400 });
  const id = criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  assert.throws(() => salvarFuncao(db, a, id, { nome: 'Caixa', estrutura: { versao: 1 } }), { status: 400 });
  assert.equal(obterFuncao(db, a, id).estrutura.tarefas.length, 1);
});

test('lista com contagens e esconde arquivadas', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  const id = criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  const [r] = listarFuncoes(db, a);
  assert.deepEqual({ ...r, atualizadaEm: '' }, { id, nome: 'Caixa', atualizadaEm: '', tarefas: 1, competencias: 0, salvaguardasRespondidas: 0, pendencias: 3, ocupantes: 0, trilhas: 0 });
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
  arquivarFuncao(db, a, id);
  assert.deepEqual(listarFuncoes(db, a), []);
  assert.throws(() => obterFuncao(db, a, id), { status: 404 });
});
```

As 3 pendências da estrutura vazia são: tarefa sem descrição, tarefa sem efeito e nenhuma competência.

- [ ] **Step 2: Escrever os testes de ocupantes que falham**

Crie `web/lib/ocupantes.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, ID, inserirEmpresa } from './apoio-testes.ts';
import { estruturaVazia } from './estrutura.ts';
import { arquivarFuncao, criarFuncao } from './funcoes.ts';
import { arquivarOcupante, criarOcupante, listarOcupantes, obterOcupante, salvarOcupante, validarNiveis } from './ocupantes.ts';

function cenario() {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const funcaoId = criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  return { db, a, b, funcaoId };
}

test('cria ocupante com prazo padrão e respeita a empresa', () => {
  const { db, a, b, funcaoId } = cenario();
  const id = criarOcupante(db, a, funcaoId, { apelido: ' Atendente 1 ' });
  const o = obterOcupante(db, a, id);
  assert.deepEqual({ apelido: o.apelido, prazoDias: o.prazoDias, niveis: o.niveis, funcaoId: o.funcaoId, empresaId: o.empresaId }, { apelido: 'Atendente 1', prazoDias: 14, niveis: {}, funcaoId, empresaId: a });
  assert.throws(() => obterOcupante(db, b, id), { status: 404 });
  assert.throws(() => criarOcupante(db, b, funcaoId, { apelido: 'X' }), { status: 404 });
});

test('salva níveis, apelido e prazo validados', () => {
  const { db, a, funcaoId } = cenario();
  const id = criarOcupante(db, a, funcaoId, { apelido: 'A1' });
  salvarOcupante(db, a, id, { apelido: 'A2', niveis: { [ID(1)]: { nivel: 'N1', respostas: [true, false, null] } }, prazoDias: 30 });
  const o = obterOcupante(db, a, id);
  assert.deepEqual({ apelido: o.apelido, prazoDias: o.prazoDias, niveis: o.niveis }, { apelido: 'A2', prazoDias: 30, niveis: { [ID(1)]: { nivel: 'N1', respostas: [true, false, null] } } });
  assert.throws(() => salvarOcupante(db, a, id, { apelido: 'A2', niveis: {}, prazoDias: 0 }), { status: 400 });
  assert.throws(() => salvarOcupante(db, a, id, { apelido: 'A2', niveis: {}, prazoDias: 1.5 }), { status: 400 });
  assert.throws(() => salvarOcupante(db, a, id, { apelido: '', niveis: {}, prazoDias: 14 }), { status: 400 });
});

test('rejeita níveis malformados', () => {
  assert.throws(() => validarNiveis({ [ID(1)]: { nivel: 'N4', respostas: null } }), { status: 400 });
  assert.throws(() => validarNiveis({ 'nao-uuid': { nivel: 'N1', respostas: null } }), { status: 400 });
  assert.throws(() => validarNiveis({ [ID(1)]: { nivel: 'N1', respostas: [true] } }), { status: 400 });
  assert.throws(() => validarNiveis([]), { status: 400 });
  assert.deepEqual(validarNiveis({ [ID(1)]: { nivel: 'N3', respostas: null, extra: 1 } }), { [ID(1)]: { nivel: 'N3', respostas: null } });
});

test('lista ocupantes ativos com níveis preenchidos das competências atuais', () => {
  const { db, a, funcaoId } = cenario();
  const id = criarOcupante(db, a, funcaoId, { apelido: 'A1', niveis: { [ID(99)]: { nivel: 'N1', respostas: null } } });
  const outro = criarOcupante(db, a, funcaoId, { apelido: 'A2' });
  arquivarOcupante(db, a, outro);
  const lista = listarOcupantes(db, a, funcaoId);
  assert.deepEqual(lista.map(o => [o.id, o.apelido, o.niveisPreenchidos, o.trilhas]), [[id, 'A1', 0, 0]]);
  arquivarFuncao(db, a, funcaoId);
  assert.throws(() => obterOcupante(db, a, id), { status: 404 });
});
```

`niveisPreenchidos` é 0 porque `ID(99)` não é uma competência da função atual.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `funcoes.ts` e `ocupantes.ts`.

- [ ] **Step 4: Implementar `web/lib/funcoes.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import { pendenciasEstrutura, validarEstrutura, type Estrutura } from './estrutura.ts';
import { HttpErro } from './http.ts';

export type Funcao = { id: string; empresaId: string; nome: string; estrutura: Estrutura; origem: string; criadaEm: string; atualizadaEm: string };
export type ResumoFuncao = {
  id: string; nome: string; atualizadaEm: string; tarefas: number; competencias: number;
  salvaguardasRespondidas: number; pendencias: number; ocupantes: number; trilhas: number;
};
type Linha = { id: string; empresa_id: string; nome: string; estrutura: string; origem: string; criada_em: string; atualizada_em: string };

export function validarNomeFuncao(v: unknown): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > 120) throw new HttpErro(400, 'Informe o nome da função (até 120 caracteres).');
  return v.trim();
}

export function estruturaValida(v: unknown): Estrutura {
  try {
    return validarEstrutura(v);
  } catch (erro) {
    throw new HttpErro(400, (erro as Error).message);
  }
}

export function criarFuncao(db: DatabaseSync, empresaId: string, dados: { nome: unknown; estrutura: unknown; origem: string }, agora = Date.now()): string {
  const id = crypto.randomUUID();
  const momento = new Date(agora).toISOString();
  db.prepare('INSERT INTO funcoes (id, empresa_id, nome, estrutura, origem, criada_em, atualizada_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, empresaId, validarNomeFuncao(dados.nome), JSON.stringify(estruturaValida(dados.estrutura)), dados.origem, momento, momento);
  return id;
}

export function obterFuncao(db: DatabaseSync, empresaId: string | null, id: string): Funcao {
  const l = db.prepare('SELECT id, empresa_id, nome, estrutura, origem, criada_em, atualizada_em FROM funcoes WHERE id = ? AND arquivada = 0').get(id) as Linha | undefined;
  if (!l || (empresaId !== null && l.empresa_id !== empresaId)) throw new HttpErro(404, 'Função não encontrada.');
  return { id: l.id, empresaId: l.empresa_id, nome: l.nome, estrutura: JSON.parse(l.estrutura) as Estrutura, origem: l.origem, criadaEm: l.criada_em, atualizadaEm: l.atualizada_em };
}

export function salvarFuncao(db: DatabaseSync, empresaId: string, id: string, dados: { nome: unknown; estrutura: unknown }, agora = Date.now()): void {
  obterFuncao(db, empresaId, id);
  const nome = validarNomeFuncao(dados.nome);
  const estrutura = estruturaValida(dados.estrutura);
  db.prepare('UPDATE funcoes SET nome = ?, estrutura = ?, atualizada_em = ? WHERE id = ?').run(nome, JSON.stringify(estrutura), new Date(agora).toISOString(), id);
}

export function arquivarFuncao(db: DatabaseSync, empresaId: string, id: string): void {
  obterFuncao(db, empresaId, id);
  db.prepare('UPDATE funcoes SET arquivada = 1 WHERE id = ?').run(id);
}

export function listarFuncoes(db: DatabaseSync, empresaId: string): ResumoFuncao[] {
  const linhas = db.prepare(`SELECT f.id, f.nome, f.estrutura, f.atualizada_em,
      (SELECT COUNT(*) FROM ocupantes o WHERE o.funcao_id = f.id AND o.arquivado = 0) AS ocupantes,
      (SELECT COUNT(*) FROM execucoes x WHERE x.funcao_id = f.id AND x.tipo = 'trilha') AS trilhas
    FROM funcoes f WHERE f.empresa_id = ? AND f.arquivada = 0 ORDER BY f.atualizada_em DESC`).all(empresaId) as
    { id: string; nome: string; estrutura: string; atualizada_em: string; ocupantes: number; trilhas: number }[];
  return linhas.map(l => {
    const e = JSON.parse(l.estrutura) as Estrutura;
    return {
      id: l.id, nome: l.nome, atualizadaEm: l.atualizada_em, tarefas: e.tarefas.length, competencias: e.competencias.length,
      salvaguardasRespondidas: e.salvaguardas.filter(s => s.resposta !== 'Não sei').length, pendencias: pendenciasEstrutura(e).length,
      ocupantes: Number(l.ocupantes), trilhas: Number(l.trilhas),
    };
  });
}
```

- [ ] **Step 5: Implementar `web/lib/ocupantes.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import { NIVEIS, type Nivel, type Niveis } from './estrutura.ts';
import { obterFuncao } from './funcoes.ts';
import { HttpErro } from './http.ts';

export type Ocupante = { id: string; funcaoId: string; empresaId: string; apelido: string; niveis: Niveis; prazoDias: number; criadoEm: string; atualizadoEm: string };
export type ResumoOcupante = { id: string; apelido: string; niveisPreenchidos: number; trilhas: number; atualizadoEm: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function validarApelido(v: unknown): string {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > 60) throw new HttpErro(400, 'Informe um apelido de até 60 caracteres (ex.: Atendente 1).');
  return v.trim();
}

export function validarPrazo(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 180) throw new HttpErro(400, 'Informe um prazo inteiro entre 1 e 180 dias.');
  return v;
}

export function validarNiveis(v: unknown): Niveis {
  const invalido = () => new HttpErro(400, 'Níveis inválidos.');
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalido();
  const entradas = Object.entries(v as Record<string, unknown>);
  if (entradas.length > 50) throw invalido();
  const niveis: Niveis = {};
  for (const [id, valor] of entradas) {
    if (!UUID.test(id) || !valor || typeof valor !== 'object') throw invalido();
    const { nivel, respostas } = valor as { nivel?: unknown; respostas?: unknown };
    if (typeof nivel !== 'string' || !(NIVEIS as readonly string[]).includes(nivel)) throw invalido();
    const respostasValidas = respostas === null || (Array.isArray(respostas) && respostas.length === 3 && respostas.every(r => r === null || typeof r === 'boolean'));
    if (!respostasValidas) throw invalido();
    niveis[id] = { nivel: nivel as Nivel, respostas: respostas === null ? null : [...(respostas as (boolean | null)[])] };
  }
  return niveis;
}

type Linha = { id: string; funcao_id: string; empresa_id: string; apelido: string; niveis: string; prazo_dias: number; criado_em: string; atualizado_em: string };

export function criarOcupante(db: DatabaseSync, empresaId: string, funcaoId: string, dados: { apelido: unknown; niveis?: Niveis }, agora = Date.now()): string {
  obterFuncao(db, empresaId, funcaoId);
  const id = crypto.randomUUID();
  const momento = new Date(agora).toISOString();
  db.prepare('INSERT INTO ocupantes (id, funcao_id, apelido, niveis, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, funcaoId, validarApelido(dados.apelido), JSON.stringify(validarNiveis(dados.niveis ?? {})), momento, momento);
  return id;
}

export function obterOcupante(db: DatabaseSync, empresaId: string | null, id: string): Ocupante {
  const l = db.prepare(`SELECT o.id, o.funcao_id, f.empresa_id, o.apelido, o.niveis, o.prazo_dias, o.criado_em, o.atualizado_em
    FROM ocupantes o JOIN funcoes f ON f.id = o.funcao_id WHERE o.id = ? AND o.arquivado = 0 AND f.arquivada = 0`).get(id) as Linha | undefined;
  if (!l || (empresaId !== null && l.empresa_id !== empresaId)) throw new HttpErro(404, 'Ocupante não encontrado.');
  return {
    id: l.id, funcaoId: l.funcao_id, empresaId: l.empresa_id, apelido: l.apelido, niveis: JSON.parse(l.niveis) as Niveis,
    prazoDias: Number(l.prazo_dias), criadoEm: l.criado_em, atualizadoEm: l.atualizado_em,
  };
}

export function salvarOcupante(db: DatabaseSync, empresaId: string, id: string, dados: { apelido: unknown; niveis: unknown; prazoDias: unknown }, agora = Date.now()): void {
  obterOcupante(db, empresaId, id);
  const apelido = validarApelido(dados.apelido);
  const niveis = validarNiveis(dados.niveis);
  const prazo = validarPrazo(dados.prazoDias);
  db.prepare('UPDATE ocupantes SET apelido = ?, niveis = ?, prazo_dias = ?, atualizado_em = ? WHERE id = ?')
    .run(apelido, JSON.stringify(niveis), prazo, new Date(agora).toISOString(), id);
}

export function arquivarOcupante(db: DatabaseSync, empresaId: string, id: string): void {
  obterOcupante(db, empresaId, id);
  db.prepare('UPDATE ocupantes SET arquivado = 1 WHERE id = ?').run(id);
}

export function listarOcupantes(db: DatabaseSync, empresaId: string | null, funcaoId: string): ResumoOcupante[] {
  const funcao = obterFuncao(db, empresaId, funcaoId);
  const competencias = funcao.estrutura.competencias.map(c => c.id);
  const linhas = db.prepare(`SELECT o.id, o.apelido, o.niveis, o.atualizado_em,
      (SELECT COUNT(*) FROM execucoes x WHERE x.ocupante_id = o.id AND x.tipo = 'trilha') AS trilhas
    FROM ocupantes o WHERE o.funcao_id = ? AND o.arquivado = 0 ORDER BY o.criado_em`).all(funcaoId) as
    { id: string; apelido: string; niveis: string; atualizado_em: string; trilhas: number }[];
  return linhas.map(l => {
    const niveis = JSON.parse(l.niveis) as Niveis;
    return { id: l.id, apelido: l.apelido, niveisPreenchidos: competencias.filter(c => niveis[c]).length, trilhas: Number(l.trilhas), atualizadoEm: l.atualizado_em };
  });
}
```

- [ ] **Step 6: Rodar os testes**

Run: `cd web && npm test`
Expected: PASS.

- [ ] **Step 7: Criar as rotas**

`web/app/api/funcoes/route.ts`:

```ts
import { db } from '@/lib/db';
import { estruturaVazia } from '@/lib/estrutura';
import { criarFuncao } from '@/lib/funcoes';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const corpo = await lerJson(request, 2000);
    const id = criarFuncao(db(), gestor.empresaId, { nome: corpo.nome, estrutura: estruturaVazia(), origem: 'branco' });
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/app/api/funcoes/[id]/route.ts`:

```ts
import { db } from '@/lib/db';
import { arquivarFuncao, obterFuncao, salvarFuncao } from '@/lib/funcoes';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { listarOcupantes } from '@/lib/ocupantes';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, contexto: Contexto) {
  try {
    const gestor = await exigirGestor();
    const { id } = await contexto.params;
    const funcao = obterFuncao(db(), gestor.empresaId, id);
    return Response.json({ funcao, ocupantes: listarOcupantes(db(), gestor.empresaId, id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { id } = await contexto.params;
    const corpo = await lerJson(request);
    salvarFuncao(db(), gestor.empresaId, id, { nome: corpo.nome, estrutura: corpo.estrutura });
    return Response.json({ salvo: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    arquivarFuncao(db(), gestor.empresaId, (await contexto.params).id);
    return Response.json({ arquivada: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/app/api/funcoes/[id]/ocupantes/route.ts`:

```ts
import { db } from '@/lib/db';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { criarOcupante } from '@/lib/ocupantes';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { apelido } = await lerJson(request, 1000);
    const id = criarOcupante(db(), gestor.empresaId, (await contexto.params).id, { apelido });
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/app/api/ocupantes/[id]/route.ts`:

```ts
import { db } from '@/lib/db';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { arquivarOcupante, obterOcupante, salvarOcupante } from '@/lib/ocupantes';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, contexto: Contexto) {
  try {
    const gestor = await exigirGestor();
    return Response.json(obterOcupante(db(), gestor.empresaId, (await contexto.params).id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const corpo = await lerJson(request, 20_000);
    salvarOcupante(db(), gestor.empresaId, (await contexto.params).id, { apelido: corpo.apelido, niveis: corpo.niveis, prazoDias: corpo.prazoDias });
    return Response.json({ salvo: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    arquivarOcupante(db(), gestor.empresaId, (await contexto.params).id);
    return Response.json({ arquivado: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 8: Verificar build e API**

Run: `cd web && npm test && npm run build`
Expected: PASS e build com as quatro rotas novas.

Com `npm run dev`, entre como gestor (`gestor@local.test`, senha trocada na Task 4) e teste com `curl`:

```bash
curl -s -c /tmp/g.txt -H 'Content-Type: application/json' -d '{"email":"gestor@local.test","senha":"gestor-local-123"}' http://localhost:3000/api/auth/login
curl -s -b /tmp/g.txt -H 'Content-Type: application/json' -d '{"nome":"Caixa"}' http://localhost:3000/api/funcoes
curl -s -b /tmp/g.txt http://localhost:3000/api/funcoes/00000000-0000-4000-8000-000000000000
curl -s -H 'Content-Type: application/json' -d '{"nome":"Caixa"}' http://localhost:3000/api/funcoes
```

Expected:
1. `{"destino":"/"}`;
2. `{"id":"<uuid>"}`;
3. `{"error":"Função não encontrada."}`;
4. `{"error":"Sua sessão expirou. Entre novamente."}` (sem cookie, status 401).

- [ ] **Step 9: Commit**

```bash
git add web/lib/funcoes.ts web/lib/ocupantes.ts web/lib/funcoes.test.ts web/lib/ocupantes.test.ts web/app/api/funcoes web/app/api/ocupantes
git commit -m "Adiciona funcoes e ocupantes por empresa com API protegida" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Lacunas, catálogo e entrada do motor

**Files:**
- Modify: `web/lib/apoio-testes.ts` (acrescentar `exemploAtendente`)
- Create: `web/lib/lacunas.ts`, `web/lib/catalogo.ts`, `web/lib/entrada-motor.ts`
- Test: `web/lib/lacunas.test.ts`, `web/lib/catalogo.test.ts`, `web/lib/entrada-motor.test.ts`

**Interfaces:**
- Consumes: tipos, constantes e `pendenciasEstrutura`, `validarEstrutura`, `novoId` (Task 1); `CATALOGO_BASE`, `SALVAGUARDAS`, `type AcaoCatalogo` (Task 2); `HttpErro` (Task 3).
- Produces:
  - `lib/apoio-testes.ts`: `exemploAtendente(): { nome: string; estrutura: Estrutura; niveis: Niveis }`. A função tem as tarefas `ID(1..4)` e as competências `ID(11..14)`, iguais à planilha de exemplo.
  - `lib/lacunas.ts`: `PESOS`, `type Lacuna = { competenciaId; competencia; eixo; tarefa; atual: Nivel | null; alvo: Nivel; lacuna: number | null; score: number | null; prioridade: 'Alta' | 'Média' | 'Nenhuma' | 'Sem nível' }`, `calcularLacunas(estrutura, niveis): Lacuna[]`.
  - `lib/catalogo.ts`: `listarCatalogoAtivo(db, empresaId: string): AcaoCatalogo[]`.
  - `lib/entrada-motor.ts`: `type EntradaMotor`, `montarEntrada(funcao: { nome: string; estrutura: Estrutura }, ocupante: { niveis: Niveis; prazoDias: number }, catalogo: AcaoCatalogo[]): EntradaMotor` (lança `HttpErro` 400 com a primeira pendência), `estruturaDaEntrada(entrada: Record<string, unknown>): { nome: string; estrutura: Estrutura; niveis: Niveis }`.

- [ ] **Step 1: Acrescentar o exemplo ao `web/lib/apoio-testes.ts`**

Troque a primeira linha de imports por:

```ts
import { DatabaseSync } from 'node:sqlite';
import { prepararBanco } from './db.ts';
import type { Estrutura, Niveis } from './estrutura.ts';
```

E acrescente no fim do arquivo:

```ts
/** A função "Atendente de balcão" da planilha MRCC-PV de exemplo. */
export function exemploAtendente(): { nome: string; estrutura: Estrutura; niveis: Niveis } {
  const ferramenta = 'Assistente de IA interno (catálogo)';
  const estrutura: Estrutura = {
    versao: 1,
    tarefas: [
      { id: ID(1), tarefa: 'Consultar preço e estoque', frequencia: 'Diária', criticidade: 'Média', ferramenta, efeito_ia: 'A', origem: 'planilha', editada: false },
      { id: ID(2), tarefa: 'Montar orçamento para o cliente', frequencia: 'Diária', criticidade: 'Alta', ferramenta, efeito_ia: 'P', origem: 'planilha', editada: false },
      { id: ID(3), tarefa: 'Negociar prazo com cliente insatisfeito', frequencia: 'Semanal', criticidade: 'Alta', ferramenta: '', efeito_ia: 'I', origem: 'planilha', editada: false },
      { id: ID(4), tarefa: 'Revisar o orçamento gerado pela IA', frequencia: 'Diária', criticidade: 'Alta', ferramenta, efeito_ia: 'N', origem: 'planilha', editada: false },
    ],
    competencias: [
      { id: ID(11), competencia: 'Letramento em IA', eixo: 'Letramento em IA', tarefa_id: ID(4), alvo: 'N2', origem: 'planilha', editada: false },
      { id: ID(12), competencia: 'Proficiência na ferramenta de orçamento', eixo: 'Proficiência técnica', tarefa_id: ID(2), alvo: 'N2', origem: 'planilha', editada: false },
      { id: ID(13), competencia: 'Adaptabilidade a novos fluxos de trabalho', eixo: 'Adaptabilidade', tarefa_id: ID(1), alvo: 'N2', origem: 'planilha', editada: false },
      { id: ID(14), competencia: 'Julgamento em situação de atendimento difícil', eixo: 'Relacionais e de julgamento', tarefa_id: ID(3), alvo: 'N3', origem: 'planilha', editada: false },
    ],
    perdem_centralidade: [],
    salvaguardas: [
      { numero: 1, resposta: 'Sim', observacao: 'O atendente ainda consulta, negocia e monta orçamento — a IA assumiu só uma parte.', ajuste: '' },
      { numero: 2, resposta: 'Sim', observacao: 'Ele continua fechando o atendimento do início ao fim.', ajuste: '' },
      { numero: 3, resposta: 'Não', observacao: 'Ele revisa o orçamento da IA por instrução do gerente, mas não sabe por que essa checagem existe.', ajuste: 'Incluir, na sessão de letramento em IA, uma explicação do motivo da checagem: evitar erro de preço que gera prejuízo à loja.' },
      { numero: 4, resposta: 'Sim', observacao: 'Ele decide como conduzir a negociação e como revisar o orçamento.', ajuste: '' },
      { numero: 5, resposta: 'Sim', observacao: 'O gerente confere o orçamento fechado e comenta o resultado.', ajuste: '' },
      { numero: 6, resposta: 'Sim', observacao: 'O guia de aplicação instrui checar manualmente sempre que o valor do orçamento ultrapassar R$ 2.000.', ajuste: '' },
    ],
  };
  const niveis: Niveis = {
    [ID(11)]: { nivel: 'N0', respostas: null }, [ID(12)]: { nivel: 'N1', respostas: null },
    [ID(13)]: { nivel: 'N2', respostas: null }, [ID(14)]: { nivel: 'N2', respostas: null },
  };
  return { nome: 'Atendente de balcão', estrutura, niveis };
}
```

- [ ] **Step 2: Escrever os testes que falham**

`web/lib/lacunas.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exemploAtendente, ID } from './apoio-testes.ts';
import { calcularLacunas } from './lacunas.ts';

test('reproduz lacunas, scores e ordem do exemplo preenchido (ANALISE_CIENTIFICA.md)', () => {
  const { estrutura, niveis } = exemploAtendente();
  assert.deepEqual(calcularLacunas(estrutura, niveis).map(l => [l.competencia, l.lacuna, l.score, l.prioridade]), [
    ['Letramento em IA', 2, 26, 'Alta'],
    ['Proficiência na ferramenta de orçamento', 1, 16, 'Média'],
    ['Julgamento em situação de atendimento difícil', 1, 15, 'Média'],
    ['Adaptabilidade a novos fluxos de trabalho', 0, 5, 'Nenhuma'],
  ]);
});

test('nível atual acima do alvo vira lacuna zero; sem nível vai para o fim', () => {
  const { estrutura, niveis } = exemploAtendente();
  niveis[ID(11)] = { nivel: 'N3', respostas: null };
  delete niveis[ID(12)];
  const lacunas = calcularLacunas(estrutura, niveis);
  assert.deepEqual(lacunas.find(l => l.competenciaId === ID(11))?.lacuna, 0);
  assert.deepEqual(lacunas.at(-1), { competenciaId: ID(12), competencia: 'Proficiência na ferramenta de orçamento', eixo: 'Proficiência técnica', tarefa: 'Montar orçamento para o cliente', atual: null, alvo: 'N2', lacuna: null, score: null, prioridade: 'Sem nível' });
});
```

`web/lib/catalogo.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { listarCatalogoAtivo } from './catalogo.ts';
import { CATALOGO_BASE } from './seed.ts';

test('lista catálogo global ativo mais as ações da própria empresa', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const inserir = (empresa: string, acao: string, ativa: number) =>
    db.prepare("INSERT INTO catalogo_acoes (id, empresa_id, eixo, acao, recurso, custo, ativa, criada_em) VALUES (?, ?, 'Geral', ?, 'Interno', 'R$ 0', ?, '2026-10-15')").run(crypto.randomUUID(), empresa, acao, ativa);
  inserir(a, 'Ação da loja A', 1);
  inserir(a, 'Ação desativada', 0);
  inserir(b, 'Ação da loja B', 1);
  const lista = listarCatalogoAtivo(db, a);
  assert.equal(lista.length, CATALOGO_BASE.length + 1);
  assert.deepEqual(lista.slice(0, CATALOGO_BASE.length), CATALOGO_BASE);
  assert.deepEqual(lista.at(-1), { eixo: 'Geral', acao: 'Ação da loja A', recurso: 'Interno', custo: 'R$ 0' });
});
```

`web/lib/entrada-motor.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exemploAtendente, ID } from './apoio-testes.ts';
import { estruturaDaEntrada, montarEntrada } from './entrada-motor.ts';
import { CATALOGO_BASE, SALVAGUARDAS } from './seed.ts';

test('monta a entrada do motor no formato da planilha', () => {
  const { nome, estrutura, niveis } = exemploAtendente();
  const entrada = montarEntrada({ nome, estrutura }, { niveis, prazoDias: 30 }, CATALOGO_BASE);
  assert.deepEqual(entrada.tarefas[2], { funcao: 'Atendente de balcão', tarefa: 'Negociar prazo com cliente insatisfeito', frequencia: 'Semanal', criticidade: 'Alta', ferramenta: null, efeito_ia: 'I' });
  assert.deepEqual(entrada.competencias[0], { funcao: 'Atendente de balcão', competencia: 'Letramento em IA', eixo: 'Letramento em IA', tarefa: 'Revisar o orçamento gerado pela IA', atual: 'N0 - Não exposto', alvo: 'N2 - Usuário autônomo' });
  assert.deepEqual(entrada.salvaguardas[2], { numero: 3, ancora: 'Significado da tarefa', verificacao: SALVAGUARDAS[2].verificacao, resposta: 'Não', observacao: estrutura.salvaguardas[2].observacao, ajuste: estrutura.salvaguardas[2].ajuste });
  assert.equal(entrada.salvaguardas[1].ajuste, null);
  assert.deepEqual(entrada.trilha, []);
  assert.equal(entrada.prazo_dias_proposto, 30);
  assert.deepEqual(entrada.catalogo, CATALOGO_BASE);
});

test('bloqueia geração quando a tarefa da competência foi removida', () => {
  const { nome, estrutura, niveis } = exemploAtendente();
  estrutura.competencias[0].tarefa_id = '';
  assert.throws(() => montarEntrada({ nome, estrutura }, { niveis, prazoDias: 14 }, CATALOGO_BASE), { status: 400, message: /Competência 1: escolha a tarefa associada/ });
});

test('bloqueia geração quando falta o nível atual de uma competência', () => {
  const { nome, estrutura, niveis } = exemploAtendente();
  delete niveis[ID(14)];
  assert.throws(() => montarEntrada({ nome, estrutura }, { niveis, prazoDias: 14 }, CATALOGO_BASE), { status: 400, message: /Julgamento em situação de atendimento difícil/ });
});

test('importação da planilha volta à mesma entrada, com IDs novos', () => {
  const { nome, estrutura, niveis } = exemploAtendente();
  const entrada = montarEntrada({ nome, estrutura }, { niveis, prazoDias: 30 }, CATALOGO_BASE);
  const daPlanilha = { ...entrada, tarefas: entrada.tarefas.map(t => (t.ferramenta === null ? { ...t, ferramenta: '—' } : t)) };
  const importada = estruturaDaEntrada(daPlanilha);
  assert.equal(importada.nome, 'Atendente de balcão');
  assert.equal(importada.estrutura.tarefas[2].ferramenta, '');
  assert.notEqual(importada.estrutura.tarefas[0].id, ID(1));
  assert.ok(importada.estrutura.tarefas.every(t => t.origem === 'planilha'));
  assert.deepEqual(montarEntrada({ nome: importada.nome, estrutura: importada.estrutura }, { niveis: importada.niveis, prazoDias: 30 }, CATALOGO_BASE), entrada);
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `lacunas.ts`, `catalogo.ts` e `entrada-motor.ts`.

- [ ] **Step 4: Implementar `web/lib/lacunas.ts`**

Espelha `recomendar.analisar`: `lacuna = max(0, alvo - atual)`, `score = lacuna * 10 + peso(criticidade) + peso(frequência)` e desempate pela ordem da lista.

```ts
import type { Estrutura, Nivel, Niveis } from './estrutura.ts';

export const PESOS: Record<string, number> = { Alta: 3, 'Média': 2, Baixa: 1, 'Diária': 3, Semanal: 2, Eventual: 1 };

export type Lacuna = {
  competenciaId: string; competencia: string; eixo: string; tarefa: string; atual: Nivel | null; alvo: Nivel;
  lacuna: number | null; score: number | null; prioridade: 'Alta' | 'Média' | 'Nenhuma' | 'Sem nível';
};

const numero = (n: Nivel) => Number(n[1]);

export function calcularLacunas(estrutura: Estrutura, niveis: Niveis): Lacuna[] {
  const tarefas = new Map(estrutura.tarefas.map(t => [t.id, t]));
  const lacunas = estrutura.competencias.map((c, ordem) => {
    const tarefa = tarefas.get(c.tarefa_id);
    const atual = niveis[c.id]?.nivel ?? null;
    const lacuna = atual ? Math.max(0, numero(c.alvo) - numero(atual)) : null;
    const score = lacuna === null || !tarefa ? null : lacuna * 10 + PESOS[tarefa.criticidade] + PESOS[tarefa.frequencia];
    const prioridade: Lacuna['prioridade'] = lacuna === null ? 'Sem nível' : lacuna === 0 ? 'Nenhuma' : lacuna >= 2 ? 'Alta' : 'Média';
    return { ordem, item: { competenciaId: c.id, competencia: c.competencia, eixo: c.eixo, tarefa: tarefa?.tarefa ?? '', atual, alvo: c.alvo, lacuna, score, prioridade } };
  });
  return lacunas.sort((a, b) => (b.item.score ?? -1) - (a.item.score ?? -1) || a.ordem - b.ordem).map(l => l.item);
}
```

- [ ] **Step 5: Implementar `web/lib/catalogo.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { AcaoCatalogo } from './seed.ts';

export function listarCatalogoAtivo(db: DatabaseSync, empresaId: string): AcaoCatalogo[] {
  const linhas = db.prepare(`SELECT eixo, acao, recurso, custo FROM catalogo_acoes
    WHERE ativa = 1 AND (empresa_id IS NULL OR empresa_id = ?)
    ORDER BY empresa_id IS NOT NULL, criada_em, rowid`).all(empresaId) as AcaoCatalogo[];
  return linhas.map(l => ({ eixo: l.eixo, acao: l.acao, recurso: l.recurso, custo: l.custo }));
}
```

- [ ] **Step 6: Implementar `web/lib/entrada-motor.ts`**

```ts
import {
  CRITICIDADES, EFEITOS, EIXOS, FREQUENCIAS, LIMITES, NIVEIS, RESPOSTAS, ROTULOS_NIVEL,
  novoId, pendenciasEstrutura, validarEstrutura, type Estrutura, type Nivel, type Niveis,
} from './estrutura.ts';
import { HttpErro } from './http.ts';
import { SALVAGUARDAS, type AcaoCatalogo } from './seed.ts';

export type EntradaMotor = {
  tarefas: { funcao: string; tarefa: string; frequencia: string; criticidade: string; ferramenta: string | null; efeito_ia: string }[];
  competencias: { funcao: string; competencia: string; eixo: string; tarefa: string; atual: string; alvo: string }[];
  catalogo: AcaoCatalogo[];
  salvaguardas: { numero: number; ancora: string; verificacao: string; resposta: string; observacao: string | null; ajuste: string | null }[];
  trilha: never[];
  prazo_dias_proposto: number;
};

/** Converte função + ocupante no JSON que `web_bridge.py` já aceita (mesmas colunas da planilha). */
export function montarEntrada(funcao: { nome: string; estrutura: Estrutura }, ocupante: { niveis: Niveis; prazoDias: number }, catalogo: AcaoCatalogo[]): EntradaMotor {
  const e = funcao.estrutura;
  const pendencias = pendenciasEstrutura(e);
  if (pendencias.length) throw new HttpErro(400, `Complete a função antes de gerar. ${pendencias[0]}`);
  const faltando = e.competencias.filter(c => !ocupante.niveis[c.id]);
  if (faltando.length) throw new HttpErro(400, `Informe o nível atual de: ${faltando.map(c => c.competencia.trim()).join(', ')}.`);
  const tarefas = new Map(e.tarefas.map(t => [t.id, t.tarefa.trim()]));
  return {
    tarefas: e.tarefas.map(t => ({
      funcao: funcao.nome, tarefa: t.tarefa.trim(), frequencia: t.frequencia, criticidade: t.criticidade,
      ferramenta: t.ferramenta.trim() || null, efeito_ia: t.efeito_ia as string,
    })),
    competencias: e.competencias.map(c => ({
      funcao: funcao.nome, competencia: c.competencia.trim(), eixo: c.eixo, tarefa: tarefas.get(c.tarefa_id) as string,
      atual: ROTULOS_NIVEL[ocupante.niveis[c.id].nivel], alvo: ROTULOS_NIVEL[c.alvo],
    })),
    catalogo: catalogo.map(a => ({ eixo: a.eixo, acao: a.acao, recurso: a.recurso, custo: a.custo })),
    salvaguardas: SALVAGUARDAS.map(s => {
      const r = e.salvaguardas[s.numero - 1];
      return { numero: s.numero, ancora: s.ancora, verificacao: s.verificacao, resposta: r.resposta, observacao: r.observacao.trim() || null, ajuste: r.ajuste.trim() || null };
    }),
    trilha: [],
    prazo_dias_proposto: ocupante.prazoDias,
  };
}

const texto = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
function opcaoOu<T extends string, P>(v: string, opcoes: readonly T[], padrao: P): T | P {
  return (opcoes as readonly string[]).includes(v) ? (v as T) : padrao;
}
const nivelDe = (v: unknown): Nivel | null => opcaoOu(texto(v).slice(0, 2), NIVEIS, null);

/** Converte a saída de `web_bridge.py importar` (planilha) em estrutura com IDs e níveis do primeiro ocupante. */
export function estruturaDaEntrada(entrada: Record<string, unknown>): { nome: string; estrutura: Estrutura; niveis: Niveis } {
  const linhas = (chave: string) => (Array.isArray(entrada[chave]) ? entrada[chave] : []) as Record<string, unknown>[];
  const tarefasPlanilha = linhas('tarefas').slice(0, LIMITES.tarefas);
  const nome = (texto(tarefasPlanilha[0]?.funcao) || 'Função importada').slice(0, 120);
  const tarefas = tarefasPlanilha.map(t => {
    const ferramenta = texto(t.ferramenta);
    return {
      id: novoId(), tarefa: texto(t.tarefa).slice(0, LIMITES.texto),
      frequencia: opcaoOu(texto(t.frequencia), FREQUENCIAS, 'Diária' as const),
      criticidade: opcaoOu(texto(t.criticidade), CRITICIDADES, 'Média' as const),
      ferramenta: ferramenta === '—' ? '' : ferramenta.slice(0, LIMITES.ferramenta),
      efeito_ia: opcaoOu(texto(t.efeito_ia), EFEITOS, null),
      origem: 'planilha' as const, editada: false,
    };
  });
  const porTexto = new Map(tarefas.map(t => [t.tarefa, t.id]));
  const niveis: Niveis = {};
  const competencias = linhas('competencias').slice(0, LIMITES.competencias).map(c => {
    const id = novoId();
    const atual = nivelDe(c.atual);
    if (atual) niveis[id] = { nivel: atual, respostas: null };
    return {
      id, competencia: texto(c.competencia).slice(0, LIMITES.texto), eixo: opcaoOu(texto(c.eixo), EIXOS, EIXOS[0]),
      tarefa_id: porTexto.get(texto(c.tarefa)) ?? '', alvo: nivelDe(c.alvo) ?? 'N2', origem: 'planilha' as const, editada: false,
    };
  });
  const salvaguardas = [1, 2, 3, 4, 5, 6].map(numero => {
    const s = linhas('salvaguardas').find(x => Number(x.numero) === numero);
    return {
      numero, resposta: opcaoOu(texto(s?.resposta), RESPOSTAS, 'Não sei' as const),
      observacao: texto(s?.observacao).slice(0, LIMITES.nota), ajuste: texto(s?.ajuste).slice(0, LIMITES.nota),
    };
  });
  return { nome, estrutura: validarEstrutura({ versao: 1, tarefas, competencias, perdem_centralidade: [], salvaguardas }), niveis };
}
```

- [ ] **Step 7: Rodar os testes e o build**

Run: `cd web && npm test && npm run build`
Expected: PASS e build concluído.

- [ ] **Step 8: Commit**

```bash
git add web/lib/apoio-testes.ts web/lib/lacunas.ts web/lib/catalogo.ts web/lib/entrada-motor.ts web/lib/lacunas.test.ts web/lib/catalogo.test.ts web/lib/entrada-motor.test.ts
git commit -m "Monta a entrada do motor a partir de funcao, ocupante e catalogo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Fila e execuções (API nova, sem remover a antiga)

**Files:**
- Create: `web/lib/fila.ts`, `web/lib/status-execucao.ts`, `web/lib/execucoes.ts`
- Test: `web/lib/fila.test.ts`, `web/lib/status-execucao.test.ts`
- Modify: `web/lib/server.ts` (exportar `python` e `bridge`)
- Create: `web/app/api/ocupantes/[id]/execucoes/route.ts`, `web/app/api/execucoes/[id]/route.ts`, `web/app/api/execucoes/[id]/download/route.ts`

**Interfaces:**
- Consumes: `HttpErro` (Task 3); `exigirGestor`, `exigirUsuario` (Task 4); `obterFuncao`, `obterOcupante` (Task 7); `listarCatalogoAtivo`, `montarEntrada` (Task 8); `runBridge`, `jobPath`, `dataDir`, `root` (já em `lib/server.ts`).
- Produces:
  - `lib/fila.ts`: `type ItemFila = { id: string; empresaId: string; executar: () => Promise<void> }`, `class Fila { constructor(maxAguardando?: number); enfileirar(item): number; posicao(id): number | null }`. A posição 0 indica que o item está executando; 1..n, que está aguardando.
  - `lib/status-execucao.ts`: `type TipoExecucao = 'trilha' | 'diagnostico'`, `type EstadoExecucao`, `type StatusExecucao`, `LIMITE_EXECUCAO_MS`, `normalizarStatus(s, runnerAtual, agora?): { status: StatusExecucao; alterado: boolean }`.
  - `lib/execucoes.ts`:
    - `iniciarExecucao(db, dados: { tipo; empresaId; funcaoId; ocupanteId; usuarioId; entrada }): Promise<ExecucaoPublica>`;
    - `lerExecucao(db, usuario: Usuario, id: string): Promise<ExecucaoPublica & { result: unknown | null; ocupanteId: string | null; funcaoId: string | null }>`;
    - `listarExecucoes(db, ocupanteId): { id: string; tipo: string; criadaEm: string }[]`;
    - `type ExecucaoPublica = { id; tipo; status; criadaEm; iniciadaEm?; error?; posicao: number | null }`.
  - Rotas: `POST /api/ocupantes/[id]/execucoes` com `{ tipo: 'trilha' | 'diagnostico' }` responde 202 com `ExecucaoPublica`; `GET /api/execucoes/[id]`; `GET /api/execucoes/[id]/download?type=excel|json|report|evaluation|input`.

- [ ] **Step 1: Escrever os testes que falham**

`web/lib/fila.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Fila } from './fila.ts';

function adiado() {
  let resolver!: () => void;
  let rejeitar!: (e: Error) => void;
  const promessa = new Promise<void>((ok, falha) => { resolver = ok; rejeitar = falha; });
  return { promessa, resolver, rejeitar };
}
const esperarCiclo = () => new Promise(r => setImmediate(r));
const nunca = () => new Promise<void>(() => undefined);

test('executa um item por vez, na ordem de chegada, e informa a posição', async () => {
  const fila = new Fila(6);
  const ordem: string[] = [];
  const a = adiado();
  const b = adiado();
  assert.equal(fila.enfileirar({ id: 'a', empresaId: 'e1', executar: async () => { ordem.push('a'); await a.promessa; } }), 0);
  assert.equal(fila.enfileirar({ id: 'b', empresaId: 'e2', executar: async () => { ordem.push('b'); await b.promessa; } }), 1);
  assert.deepEqual(ordem, ['a']);
  a.resolver();
  await esperarCiclo();
  assert.deepEqual(ordem, ['a', 'b']);
  assert.equal(fila.posicao('b'), 0);
  assert.equal(fila.posicao('a'), null);
  b.resolver();
});

test('aceita só um pedido por loja e no máximo N aguardando', () => {
  const fila = new Fila(2);
  fila.enfileirar({ id: 'a', empresaId: 'e1', executar: nunca });
  assert.throws(() => fila.enfileirar({ id: 'a2', empresaId: 'e1', executar: nunca }), { status: 429, message: /desta loja/ });
  fila.enfileirar({ id: 'b', empresaId: 'e2', executar: nunca });
  fila.enfileirar({ id: 'c', empresaId: 'e3', executar: nunca });
  assert.throws(() => fila.enfileirar({ id: 'd', empresaId: 'e4', executar: nunca }), { status: 429, message: /Muitas solicitações/ });
  assert.equal(fila.posicao('c'), 2);
});

test('falha de um item não trava a fila', async () => {
  const fila = new Fila(6);
  const a = adiado();
  let rodouB = false;
  fila.enfileirar({ id: 'a', empresaId: 'e1', executar: () => a.promessa });
  fila.enfileirar({ id: 'b', empresaId: 'e2', executar: async () => { rodouB = true; } });
  a.rejeitar(new Error('python caiu'));
  await esperarCiclo();
  assert.equal(rodouB, true);
});
```

`web/lib/status-execucao.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITE_EXECUCAO_MS, normalizarStatus, type StatusExecucao } from './status-execucao.ts';

const base: StatusExecucao = { id: 'x', tipo: 'trilha', status: 'aguardando', criadaEm: '2026-10-15T12:00:00.000Z', runnerId: 'r1' };

test('pedido aguardando ou executando de outro processo vira erro de reinício', () => {
  for (const status of ['aguardando', 'executando'] as const) {
    const r = normalizarStatus({ ...base, status }, 'r2');
    assert.equal(r.alterado, true);
    assert.equal(r.status.status, 'erro');
    assert.match(r.status.error ?? '', /reinício do serviço/);
  }
});

test('execução acima do limite expira; dentro do limite continua', () => {
  const iniciadaEm = '2026-10-15T12:00:00.000Z';
  const inicio = Date.parse(iniciadaEm);
  const executando: StatusExecucao = { ...base, status: 'executando', iniciadaEm };
  assert.equal(normalizarStatus(executando, 'r1', inicio + LIMITE_EXECUCAO_MS - 1).status.status, 'executando');
  const expirada = normalizarStatus(executando, 'r1', inicio + LIMITE_EXECUCAO_MS + 1);
  assert.deepEqual([expirada.status.status, expirada.alterado], ['erro', false]);
});

test('concluída e erro não mudam', () => {
  for (const status of ['concluida', 'erro'] as const) assert.deepEqual(normalizarStatus({ ...base, status }, 'r2'), { status: { ...base, status }, alterado: false });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `fila.ts` e `status-execucao.ts`.

- [ ] **Step 3: Implementar `web/lib/fila.ts`**

```ts
import { HttpErro } from './http.ts';

export type ItemFila = { id: string; empresaId: string; executar: () => Promise<void> };

/** Um worker: as LLMs não disputam os 2 núcleos da VM. Fica em memória; reinício encerra a fila. */
export class Fila {
  #aguardando: ItemFila[] = [];
  #atual: ItemFila | null = null;
  #maxAguardando: number;

  constructor(maxAguardando = 6) {
    this.#maxAguardando = maxAguardando;
  }

  enfileirar(item: ItemFila): number {
    if (this.#atual?.empresaId === item.empresaId || this.#aguardando.some(i => i.empresaId === item.empresaId)) {
      throw new HttpErro(429, 'Já há uma geração desta loja em andamento ou na fila. Aguarde ela terminar.');
    }
    if (this.#aguardando.length >= this.#maxAguardando) throw new HttpErro(429, 'Muitas solicitações agora; tente em alguns minutos.');
    this.#aguardando.push(item);
    this.#processar();
    return this.posicao(item.id) ?? 0;
  }

  posicao(id: string): number | null {
    if (this.#atual?.id === id) return 0;
    const indice = this.#aguardando.findIndex(i => i.id === id);
    return indice < 0 ? null : indice + 1;
  }

  #processar(): void {
    if (this.#atual || !this.#aguardando.length) return;
    const item = this.#aguardando.shift() as ItemFila;
    this.#atual = item;
    void item.executar().catch(() => undefined).finally(() => {
      this.#atual = null;
      this.#processar();
    });
  }
}
```

- [ ] **Step 4: Implementar `web/lib/status-execucao.ts`**

```ts
export type TipoExecucao = 'trilha' | 'diagnostico';
export type EstadoExecucao = 'aguardando' | 'executando' | 'concluida' | 'erro';
export type StatusExecucao = { id: string; tipo: TipoExecucao; status: EstadoExecucao; criadaEm: string; iniciadaEm?: string; runnerId: string; error?: string };

export const LIMITE_EXECUCAO_MS = 2_600_000;

/** Pedidos de um processo anterior não terminam mais: viram erro visível em vez de girar para sempre. */
export function normalizarStatus(s: StatusExecucao, runnerAtual: string, agora = Date.now()): { status: StatusExecucao; alterado: boolean } {
  if ((s.status === 'aguardando' || s.status === 'executando') && s.runnerId !== runnerAtual) {
    return { status: { ...s, status: 'erro', error: 'A geração foi interrompida por um reinício do serviço. Você pode iniciar novamente.' }, alterado: true };
  }
  if (s.status === 'executando' && s.iniciadaEm && agora - Date.parse(s.iniciadaEm) > LIMITE_EXECUCAO_MS) {
    return { status: { ...s, status: 'erro', error: 'A geração expirou. Você pode iniciar novamente.' }, alterado: false };
  }
  return { status: s, alterado: false };
}
```

- [ ] **Step 5: Rodar os testes**

Run: `cd web && npm test`
Expected: PASS.

- [ ] **Step 6: Exportar caminhos do motor em `web/lib/server.ts`**

Troque as duas linhas:

```ts
const python = process.env.MRCC_PYTHON || path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
```
```ts
const bridge = path.join(root, 'web_bridge.py');
```

por:

```ts
export const python = process.env.MRCC_PYTHON || path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
```
```ts
export const bridge = path.join(root, 'web_bridge.py');
```

O restante de `server.ts` (inclusive `createJob` e `readJob`, usados pelas rotas antigas) fica como está até a Task 10.

- [ ] **Step 7: Implementar `web/lib/execucoes.ts`**

```ts
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { Usuario } from './auth.ts';
import { Fila } from './fila.ts';
import { HttpErro } from './http.ts';
import { bridge, dataDir, jobPath, python, root } from './server.ts';
import { normalizarStatus, type StatusExecucao, type TipoExecucao } from './status-execucao.ts';

export type ExecucaoPublica = Omit<StatusExecucao, 'runnerId'> & { posicao: number | null };

const estado = globalThis as typeof globalThis & { mrccFila?: Fila; mrccRunnerId?: string };
const fila = (estado.mrccFila ??= new Fila(6));
const runnerId = (estado.mrccRunnerId ??= randomUUID());
const ARQUIVO_MANUTENCAO = process.env.MRCC_MAINTENANCE_FILE || '/var/lib/mrcc-pv-deploy/maintenance';
// Nomes exigidos pelo wait_idle do publicador (pgrep "web_bridge.py (analise|llm)").
const MODO_BRIDGE: Record<TipoExecucao, string> = { trilha: 'llm', diagnostico: 'analise' };

const gravarStatus = (s: StatusExecucao) => writeFile(path.join(jobPath(s.id), 'status.json'), JSON.stringify(s));
function publico(s: StatusExecucao): ExecucaoPublica {
  const { runnerId: _interno, ...resto } = s;
  return { ...resto, posicao: fila.posicao(s.id) };
}

async function rodar(inicial: StatusExecucao): Promise<void> {
  const s: StatusExecucao = { ...inicial, status: 'executando', iniciadaEm: new Date().toISOString() };
  await gravarStatus(s);
  const pasta = jobPath(s.id);
  await new Promise<void>(resolve => {
    const filho = spawn(python, [bridge, MODO_BRIDGE[s.tipo], '--entrada', path.join(pasta, 'input.json'), '--saida', pasta], {
      cwd: root, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, stdio: ['ignore', 'ignore', 'pipe'],
    });
    let erro = '';
    filho.stderr.on('data', (parte: Buffer) => { erro = (erro + parte.toString('utf8')).slice(-3000); });
    const limite = setTimeout(() => filho.kill('SIGTERM'), 2_500_000);
    let terminou = false;
    const fim = (mensagem?: string) => {
      if (terminou) return;
      terminou = true;
      clearTimeout(limite);
      gravarStatus({ ...s, status: mensagem ? 'erro' : 'concluida', error: mensagem }).catch(() => undefined).finally(resolve);
    };
    filho.on('error', e => fim(e.message));
    filho.on('close', codigo => fim(codigo === 0 ? undefined : erro.trim() || 'A geração foi interrompida. Tente novamente.'));
  });
}

export async function iniciarExecucao(db: DatabaseSync, dados: { tipo: TipoExecucao; empresaId: string; funcaoId: string; ocupanteId: string; usuarioId: string; entrada: unknown }): Promise<ExecucaoPublica> {
  if (dados.tipo === 'trilha' && existsSync(ARQUIVO_MANUTENCAO)) throw new HttpErro(503, 'O site está sendo atualizado. Aguarde um minuto e tente novamente.');
  const conteudo = JSON.stringify(dados.entrada);
  if (conteudo.length > 100_000) throw new HttpErro(413, 'Formulário extenso demais. Reduza as descrições.');
  const id = randomUUID();
  const status: StatusExecucao = { id, tipo: dados.tipo, status: 'aguardando', criadaEm: new Date().toISOString(), runnerId };
  let liberar!: (pronto: boolean) => void;
  const preparado = new Promise<boolean>(r => { liberar = r; });
  const executar = async () => { if (await preparado) await rodar(status); };
  // Reserva o lugar antes de criar arquivos: com a fila cheia, nada é gravado.
  if (dados.tipo === 'trilha') fila.enfileirar({ id, empresaId: dados.empresaId, executar });
  try {
    await mkdir(path.join(dataDir, id), { recursive: true, mode: 0o700 });
    await writeFile(path.join(dataDir, id, 'input.json'), conteudo);
    await gravarStatus(status);
    db.prepare('INSERT INTO execucoes (id, tipo, empresa_id, funcao_id, ocupante_id, criada_por, criada_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, dados.tipo, dados.empresaId, dados.funcaoId, dados.ocupanteId, dados.usuarioId, status.criadaEm);
  } catch (erro) {
    liberar(false);
    throw erro;
  }
  liberar(true);
  // Diagnóstico não usa LLM e leva segundos: roda fora da fila. O catch evita rejeição não tratada.
  if (dados.tipo === 'diagnostico') void executar().catch(() => undefined);
  return publico(status);
}

export async function lerExecucao(db: DatabaseSync, usuario: Usuario, id: string) {
  const linha = db.prepare('SELECT empresa_id, funcao_id, ocupante_id FROM execucoes WHERE id = ?').get(id) as
    { empresa_id: string; funcao_id: string | null; ocupante_id: string | null } | undefined;
  if (!linha || (usuario.papel !== 'admin' && linha.empresa_id !== usuario.empresaId)) throw new HttpErro(404, 'Análise não encontrada.');
  const pasta = jobPath(id);
  const { status, alterado } = normalizarStatus(JSON.parse(await readFile(path.join(pasta, 'status.json'), 'utf8')) as StatusExecucao, runnerId);
  if (alterado) await gravarStatus(status);
  const result = status.status === 'concluida' ? JSON.parse(await readFile(path.join(pasta, 'analise.json'), 'utf8')) as unknown : null;
  return { ...publico(status), result, ocupanteId: linha.ocupante_id, funcaoId: linha.funcao_id };
}

export function listarExecucoes(db: DatabaseSync, ocupanteId: string): { id: string; tipo: string; criadaEm: string }[] {
  const linhas = db.prepare("SELECT id, tipo, criada_em FROM execucoes WHERE ocupante_id = ? AND tipo IN ('trilha', 'diagnostico') ORDER BY criada_em DESC LIMIT 10")
    .all(ocupanteId) as { id: string; tipo: string; criada_em: string }[];
  return linhas.map(l => ({ id: l.id, tipo: l.tipo, criadaEm: l.criada_em }));
}
```

- [ ] **Step 8: Criar as rotas**

`web/app/api/ocupantes/[id]/execucoes/route.ts`:

```ts
import { listarCatalogoAtivo } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { montarEntrada } from '@/lib/entrada-motor';
import { iniciarExecucao } from '@/lib/execucoes';
import { obterFuncao } from '@/lib/funcoes';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { obterOcupante } from '@/lib/ocupantes';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { tipo } = await lerJson(request, 1000);
    if (tipo !== 'trilha' && tipo !== 'diagnostico') throw new HttpErro(400, 'Tipo de geração inválido.');
    const banco = db();
    const ocupante = obterOcupante(banco, gestor.empresaId, (await contexto.params).id);
    const funcao = obterFuncao(banco, gestor.empresaId, ocupante.funcaoId);
    const entrada = montarEntrada(funcao, ocupante, listarCatalogoAtivo(banco, gestor.empresaId));
    const execucao = await iniciarExecucao(banco, { tipo, empresaId: gestor.empresaId, funcaoId: funcao.id, ocupanteId: ocupante.id, usuarioId: gestor.id, entrada });
    return Response.json(execucao, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/app/api/execucoes/[id]/route.ts`:

```ts
import { db } from '@/lib/db';
import { lerExecucao } from '@/lib/execucoes';
import { errorResponse } from '@/lib/http';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await exigirUsuario();
    return Response.json(await lerExecucao(db(), usuario, (await contexto.params).id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e, 404);
  }
}
```

`web/app/api/execucoes/[id]/download/route.ts`:

```ts
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/db';
import { lerExecucao } from '@/lib/execucoes';
import { errorResponse, HttpErro } from '@/lib/http';
import { jobPath, runBridge } from '@/lib/server';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';

const ARQUIVOS: Record<string, [string, string, string?]> = {
  excel: ['MRCC-PV_com_propostas.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  json: ['analise.json', 'application/json'],
  report: ['relatorio-v2.pdf', 'application/pdf', 'relatorio.pdf'],
  evaluation: ['avaliacao_humana.json', 'application/json'],
  input: ['entrada.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

export async function GET(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await exigirUsuario();
    const { id } = await contexto.params;
    const arquivo = ARQUIVOS[new URL(request.url).searchParams.get('type') || 'excel'];
    if (!arquivo || (await lerExecucao(db(), usuario, id)).status !== 'concluida') throw new HttpErro(404, 'Arquivo indisponível.');
    if (arquivo === ARQUIVOS.report) {
      try {
        await stat(path.join(jobPath(id), arquivo[0]));
      } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro;
        await runBridge(['pdf', '--saida', jobPath(id)]);
      }
    }
    const conteudo = await readFile(path.join(jobPath(id), arquivo[0]));
    return new Response(new Uint8Array(conteudo), {
      headers: { 'Content-Type': arquivo[1], 'Content-Disposition': `attachment; filename="${arquivo[2] || arquivo[0]}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (e) {
    return errorResponse(e, 404);
  }
}
```

- [ ] **Step 9: Preparar o Python local e verificar o diagnóstico pela API**

Se a raiz do repositório ainda não tiver `.venv`:

```bash
cd "$(git rev-parse --show-toplevel)" && python -m venv .venv && .venv/Scripts/python.exe -m pip install -r requirements.txt
```

(Em Linux/macOS: `.venv/bin/python`.)

Run: `cd web && npm test && npm run build`
Expected: PASS e build com as três rotas novas.

Com `npm run dev` e o cookie de gestor de `/tmp/g.txt` (Task 7), crie uma função completa e um ocupante, e peça um diagnóstico:

```bash
F=$(curl -s -b /tmp/g.txt -H 'Content-Type: application/json' -d '{"nome":"Caixa"}' http://localhost:3000/api/funcoes | sed 's/.*"id":"\([^"]*\)".*/\1/')
T=00000000-0000-4000-8000-000000000001; C=00000000-0000-4000-8000-000000000011
curl -s -b /tmp/g.txt -X PUT -H 'Content-Type: application/json' -d "{\"nome\":\"Caixa\",\"estrutura\":{\"versao\":1,\"tarefas\":[{\"id\":\"$T\",\"tarefa\":\"Registrar vendas\",\"frequencia\":\"Diária\",\"criticidade\":\"Alta\",\"ferramenta\":\"Sistema com IA\",\"efeito_ia\":\"P\",\"origem\":\"manual\",\"editada\":false}],\"competencias\":[{\"id\":\"$C\",\"competencia\":\"Uso do sistema\",\"eixo\":\"Proficiência técnica\",\"tarefa_id\":\"$T\",\"alvo\":\"N2\",\"origem\":\"manual\",\"editada\":false}],\"perdem_centralidade\":[],\"salvaguardas\":[{\"numero\":1,\"resposta\":\"Sim\",\"observacao\":\"\",\"ajuste\":\"\"},{\"numero\":2,\"resposta\":\"Sim\",\"observacao\":\"\",\"ajuste\":\"\"},{\"numero\":3,\"resposta\":\"Sim\",\"observacao\":\"\",\"ajuste\":\"\"},{\"numero\":4,\"resposta\":\"Sim\",\"observacao\":\"\",\"ajuste\":\"\"},{\"numero\":5,\"resposta\":\"Sim\",\"observacao\":\"\",\"ajuste\":\"\"},{\"numero\":6,\"resposta\":\"Sim\",\"observacao\":\"\",\"ajuste\":\"\"}]}}" http://localhost:3000/api/funcoes/$F
O=$(curl -s -b /tmp/g.txt -H 'Content-Type: application/json' -d '{"apelido":"Caixa 1"}' http://localhost:3000/api/funcoes/$F/ocupantes | sed 's/.*"id":"\([^"]*\)".*/\1/')
curl -s -b /tmp/g.txt -H 'Content-Type: application/json' -d '{"tipo":"diagnostico"}' http://localhost:3000/api/ocupantes/$O/execucoes
curl -s -b /tmp/g.txt -X PUT -H 'Content-Type: application/json' -d "{\"apelido\":\"Caixa 1\",\"prazoDias\":14,\"niveis\":{\"$C\":{\"nivel\":\"N1\",\"respostas\":null}}}" http://localhost:3000/api/ocupantes/$O
E=$(curl -s -b /tmp/g.txt -H 'Content-Type: application/json' -d '{"tipo":"diagnostico"}' http://localhost:3000/api/ocupantes/$O/execucoes | sed 's/.*"id":"\([^"]*\)".*/\1/')
sleep 8; curl -s -b /tmp/g.txt http://localhost:3000/api/execucoes/$E | head -c 300
curl -s -o /tmp/d.xlsx -w '%{http_code}\n' -b /tmp/g.txt "http://localhost:3000/api/execucoes/$E/download?type=input"
```

Expected:
- o primeiro POST de execução responde `{"error":"Informe o nível atual de: Uso do sistema."}`;
- a leitura começa com `{"id":"…","tipo":"diagnostico","status":"concluida"` e inclui `"result":{`;
- o download responde `200`.

- [ ] **Step 10: Commit**

```bash
git add web/lib/fila.ts web/lib/fila.test.ts web/lib/status-execucao.ts web/lib/status-execucao.test.ts web/lib/execucoes.ts web/lib/server.ts web/app/api/ocupantes/[id]/execucoes web/app/api/execucoes
git commit -m "Adiciona fila de geracao e execucoes por ocupante" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Painel da loja substitui o modo anônimo

**Files:**
- Delete: `web/app/page.tsx`, `web/app/api/session/`, `web/app/api/seed/`, `web/app/api/jobs/`, `web/lib/session.ts`, `web/test-repeat.cjs` (experimento que dependia de `/api/session` e `/api/jobs`)
- Modify: `web/lib/server.ts` (conteúdo final abaixo)
- Modify: `web/app/api/import/route.ts` (importar cria função + ocupante)
- Create: `web/app/(loja)/layout.tsx`, `web/app/(loja)/page.tsx`, `web/app/(loja)/funcoes/nova/page.tsx`
- Create: `web/components/loja/NovaFuncao.tsx`

**Interfaces:**
- Consumes: `exigirPaginaGestor`, `exigirGestor` (Task 4); `Topo` (Task 6); `listarFuncoes`, `criarFuncao` (Task 7); `criarOcupante` (Task 7); `estruturaDaEntrada` (Task 8); `transacao` (Task 2); `chamarApi`, `Campo` (Task 4).
- Produces:
  - `lib/server.ts` passa a exportar só `root`, `python`, `dataDir`, `bridge`, `runBridge(args): Promise<string>` e `jobPath(id): string` (lança `HttpErro` 404).
  - `POST /api/import` (multipart `file`) responde 201 com `{ funcaoId }`.
  - Páginas `/` (painel) e `/funcoes/nova`.

- [ ] **Step 1: Remover o modo anônimo**

```bash
git rm -r web/app/page.tsx web/app/api/session web/app/api/seed web/app/api/jobs web/lib/session.ts web/test-repeat.cjs
```

- [ ] **Step 2: Substituir `web/lib/server.ts` inteiro**

```ts
import { execFile } from 'node:child_process';
import path from 'node:path';
import { HttpErro } from './http.ts';

export const root = process.env.MRCC_ROOT || path.resolve(process.cwd(), '..');
export const python = process.env.MRCC_PYTHON || path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export const dataDir = path.join(process.cwd(), 'data');
export const bridge = path.join(root, 'web_bridge.py');

export function runBridge(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => execFile(python, [bridge, ...args], { cwd: root, timeout: 45000, maxBuffer: 2_000_000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } },
    (error, stdout, stderr) => (error ? reject(new HttpErro(400, stderr.trim().slice(-1500) || 'Não foi possível processar a planilha.')) : resolve(stdout))));
}

export function jobPath(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new HttpErro(404, 'Resultado não encontrado.');
  return path.join(dataDir, id);
}
```

- [ ] **Step 3: Substituir `web/app/api/import/route.ts` inteiro**

```ts
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db, transacao } from '@/lib/db';
import { estruturaDaEntrada } from '@/lib/entrada-motor';
import { criarFuncao } from '@/lib/funcoes';
import { errorResponse, HttpErro, sameOrigin } from '@/lib/http';
import { criarOcupante } from '@/lib/ocupantes';
import { dataDir, runBridge } from '@/lib/server';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let caminho: string | undefined;
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const arquivo = (await request.formData()).get('file');
    if (!(arquivo instanceof File) || !arquivo.name.toLowerCase().endsWith('.xlsx') || arquivo.size > 2_000_000) throw new HttpErro(400, 'Envie uma planilha .xlsx de até 2 MB.');
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    caminho = path.join(dataDir, `upload-${randomUUID()}.xlsx`);
    await writeFile(caminho, new Uint8Array(await arquivo.arrayBuffer()));
    const { nome, estrutura, niveis } = estruturaDaEntrada(JSON.parse(await runBridge(['importar', '--entrada', caminho])) as Record<string, unknown>);
    const banco = db();
    const funcaoId = transacao(banco, () => {
      const id = criarFuncao(banco, gestor.empresaId, { nome, estrutura, origem: 'planilha' });
      criarOcupante(banco, gestor.empresaId, id, { apelido: 'Ocupante 1', niveis });
      return id;
    });
    return Response.json({ funcaoId }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  } finally {
    if (caminho) await unlink(caminho).catch(() => undefined);
  }
}
```

- [ ] **Step 4: Criar o layout e o painel da loja**

`web/app/(loja)/layout.tsx`:

```tsx
import Topo from '@/components/Topo';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function LayoutLoja({ children }: { children: React.ReactNode }) {
  const gestor = await exigirPaginaGestor();
  return <><Topo subtitulo={gestor.empresaNome} />{children}</>;
}
```

`web/app/(loja)/page.tsx`:

```tsx
import Link from 'next/link';
import { db } from '@/lib/db';
import { listarFuncoes } from '@/lib/funcoes';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function PainelLoja() {
  const gestor = await exigirPaginaGestor();
  const funcoes = listarFuncoes(db(), gestor.empresaId);
  return (
    <main className="page">
      <div className="page-heading">
        <div><p className="eyebrow">PAINEL DA LOJA</p><h1>Funções da loja</h1><p>Cada função reúne as tarefas, as competências e a salvaguarda. Depois, avalie cada pessoa que ocupa a função.</p></div>
        <Link className="button primary" href="/funcoes/nova">+ Nova função</Link>
      </div>
      {funcoes.length ? (
        <div className="cards">{funcoes.map(f => (
          <Link key={f.id} className="card" href={`/funcoes/${f.id}`}>
            <h2>{f.nome}</h2>
            <p className="helper">{f.tarefas} tarefa(s) · {f.competencias} competência(s) · salvaguarda {f.salvaguardasRespondidas}/6</p>
            <p className="helper">{f.ocupantes} ocupante(s) · {f.trilhas} trilha(s)</p>
            {f.pendencias > 0 ? <span className="badge review">{f.pendencias} pendência(s)</span> : <span className="badge medium">Estrutura completa</span>}
          </Link>
        ))}</div>
      ) : (
        <div className="empty-state"><span className="empty-mark">↳</span><h3>Nenhuma função cadastrada.</h3><p>Comece pela função em que a IA mais mudou o trabalho.</p></div>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Criar a tela de nova função**

`web/components/loja/NovaFuncao.tsx`:

```tsx
'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';

export default function NovaFuncao() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const executar = async (criar: () => Promise<string>) => {
    setErro('');
    setOcupado(true);
    try {
      router.push(`/funcoes/${await criar()}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a função.');
      setOcupado(false);
    }
  };
  const emBranco = (e: React.FormEvent) => {
    e.preventDefault();
    void executar(async () => (await chamarApi<{ id: string }>('/api/funcoes', { method: 'POST', json: { nome } })).id);
  };
  const importar = (selecionado?: File) => {
    if (!selecionado) return;
    const corpo = new FormData();
    corpo.set('file', selecionado);
    void executar(async () => (await chamarApi<{ funcaoId: string }>('/api/import', { method: 'POST', body: corpo })).funcaoId)
      .finally(() => { if (arquivo.current) arquivo.current.value = ''; });
  };
  return (
    <main className="page narrow">
      <a className="text-button" href="/">← Painel da loja</a>
      <div className="page-heading"><div><p className="eyebrow">NOVA FUNÇÃO</p><h1>Qual função vamos analisar?</h1><p>Comece pela função em que a IA mais mudou o trabalho. Você pode ajustar tudo depois.</p></div></div>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <form className="panel" onSubmit={emBranco}>
        <Campo rotulo="Nome da função"><input required maxLength={120} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Atendente de balcão" /></Campo>
        <div><button className="button primary" disabled={ocupado}>Começar em branco</button></div>
      </form>
      <p className="helper">Já tem a planilha MRCC-PV preenchida? <button type="button" className="text-button" disabled={ocupado} onClick={() => arquivo.current?.click()}>Importar planilha (.xlsx)</button></p>
      <input ref={arquivo} type="file" accept=".xlsx" hidden onChange={e => importar(e.target.files?.[0])} />
    </main>
  );
}
```

`web/app/(loja)/funcoes/nova/page.tsx`:

```tsx
import NovaFuncao from '@/components/loja/NovaFuncao';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function PaginaNovaFuncao() {
  await exigirPaginaGestor();
  return <NovaFuncao />;
}
```

- [ ] **Step 6: Verificar que não sobrou referência ao modo anônimo**

Run: `cd web && grep -rn "lib/session\|api/session\|api/seed\|api/jobs\|createJob\|readJob" app components lib`
Expected: nenhuma linha.

Run: `cd web && npm test && npm run build`
Expected: PASS. O build lista `/`, `/funcoes/nova`, `/api/import` e não lista `/api/session`, `/api/seed` nem `/api/jobs`.

- [ ] **Step 7: Verificar no navegador**

Com `npm run dev`:
1. Em janela anônima, abra `http://localhost:3000/`: deve redirecionar para `/login`.
2. Entre como `gestor@local.test`: aparece "Funções da loja" com o nome "Loja Local" no topo e os cartões criados nas Tasks 7 e 9.
3. "+ Nova função" → "Importar planilha (.xlsx)" → escolha `MRCC-PV_Exemplo_Preenchido_1 (1).xlsx` da raiz do repositório. O navegador vai para `/funcoes/<id>`, que dá 404 até a Task 11, e isso é esperado. Volte a `/`: aparece o cartão "Atendente de balcão" com 4 tarefas, 4 competências, salvaguarda 6/6, 1 ocupante e "Estrutura completa".
4. Entre como `admin@local.test` e abra `/`: deve redirecionar para `/admin`.
5. Clique em "Sair": volta para `/login`; abrir `/` de novo redireciona para `/login`.

- [ ] **Step 8: Commit**

```bash
git add -A web/app web/lib/server.ts web/components/loja
git commit -m "Substitui o modo anonimo pelo painel da loja com login" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Editor da função

**Files:**
- Create: `web/components/useAutosave.ts`
- Create: `web/components/funcao/EditorFuncao.tsx`, `EtapaTarefas.tsx`, `EtapaCompetencias.tsx`, `EtapaSalvaguarda.tsx`, `EtapaOcupantes.tsx` (todos em `web/components/funcao/`)
- Create: `web/app/(loja)/funcoes/[id]/page.tsx`

**Interfaces:**
- Consumes: tipos e funções de `lib/estrutura` (Task 1); `SALVAGUARDAS` (Task 2); `chamarApi`, `Campo`, `Selecao` (Task 4); `exigirPaginaGestor`, `ou404` (Task 4); `obterFuncao`, `listarOcupantes`, `type ResumoOcupante` (Task 7); `PUT/DELETE /api/funcoes/[id]` e `POST /api/funcoes/[id]/ocupantes` (Task 7).
- Produces:
  - `components/useAutosave.ts`: `useAutosave(url: string, corpo: unknown): { estado: 'salvo' | 'pendente' | 'erro'; erro: string; salvarAgora: () => Promise<void> }`. Salva com debounce de 700 ms, em série; avisa no `beforeunload`; ao desmontar, faz um PUT `keepalive` se ainda houver alteração pendente.
  - `components/funcao/EditorFuncao.tsx`: `EditorFuncao({ funcao: { id; nome; estrutura }, ocupantes: ResumoOcupante[] })`. Expõe `navegar(href)`, que salva antes de trocar de página.
  - Página `/funcoes/[id]`.

- [ ] **Step 1: Criar `web/components/useAutosave.ts`**

```ts
'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chamarApi } from './api';

export type EstadoSalvamento = 'salvo' | 'pendente' | 'erro';

/** Salva com debounce de 700 ms, em série, e permite forçar o salvamento antes de navegar ou gerar. */
export function useAutosave(url: string, corpo: unknown) {
  const serializado = JSON.stringify(corpo);
  const salvo = useRef(serializado);
  const atual = useRef(serializado);
  const cadeia = useRef<Promise<void>>(Promise.resolve());
  const [estado, setEstado] = useState<EstadoSalvamento>('salvo');
  const [erro, setErro] = useState('');
  useLayoutEffect(() => { atual.current = serializado; }, [serializado]);

  const salvarAgora = useCallback((): Promise<void> => {
    const tarefa = cadeia.current.then(async () => {
      const valor = atual.current;
      if (valor === salvo.current) return;
      await chamarApi(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: valor });
      salvo.current = valor;
      if (atual.current === valor) {
        setEstado('salvo');
        setErro('');
      }
    });
    cadeia.current = tarefa.catch((e: unknown) => {
      setEstado('erro');
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    });
    return tarefa;
  }, [url]);

  useEffect(() => {
    if (serializado === salvo.current) return;
    setEstado('pendente');
    const timer = setTimeout(() => { salvarAgora().catch(() => undefined); }, 700);
    return () => clearTimeout(timer);
  }, [serializado, salvarAgora]);

  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => { if (atual.current !== salvo.current) e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => {
      window.removeEventListener('beforeunload', avisar);
      // Saída por navegação interna sem salvarAgora: última tentativa, sem bloquear a troca de página.
      if (atual.current !== salvo.current) {
        void fetch(url, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: atual.current }).catch(() => undefined);
      }
    };
  }, [url]);

  return { estado, erro, salvarAgora };
}
```

- [ ] **Step 2: Criar a etapa de tarefas**

`web/components/funcao/EtapaTarefas.tsx`:

```tsx
'use client';
import { Campo, Selecao } from '@/components/Campo';
import { CRITICIDADES, EFEITOS, FREQUENCIAS, LIMITES, novaTarefa, type Estrutura, type Tarefa } from '@/lib/estrutura';

const ROTULO_EFEITO: Record<string, string> = { A: 'A · A IA faz por ele', P: 'P · A IA ajuda', I: 'I · Não mudou', N: 'N · Nova por causa da IA' };

export default function EtapaTarefas({ estrutura, aoMudar }: { estrutura: Estrutura; aoMudar: (e: Estrutura) => void }) {
  const alterar = (id: string, campos: Partial<Tarefa>) =>
    aoMudar({ ...estrutura, tarefas: estrutura.tarefas.map(t => (t.id === id ? { ...t, ...campos, editada: true } : t)) });
  // Competências da tarefa removida ficam "sem tarefa" e aparecem como pendência.
  const remover = (id: string) => aoMudar({
    ...estrutura,
    tarefas: estrutura.tarefas.filter(t => t.id !== id),
    competencias: estrutura.competencias.map(c => (c.tarefa_id === id ? { ...c, tarefa_id: '' } : c)),
    perdem_centralidade: estrutura.perdem_centralidade.filter(p => p.tarefa_id !== id),
  });
  return (
    <>
      <div className="section-title">
        <h2>Mapa de tarefas <span>{estrutura.tarefas.length}</span></h2>
        <button className="button secondary small" disabled={estrutura.tarefas.length >= LIMITES.tarefas} onClick={() => aoMudar({ ...estrutura, tarefas: [...estrutura.tarefas, novaTarefa()] })}>+ Adicionar tarefa</button>
      </div>
      {estrutura.tarefas.map((t, i) => (
        <article className="entry" key={t.id}>
          <div className="entry-number">{String(i + 1).padStart(2, '0')}</div>
          <div className="entry-fields">
            <Campo rotulo="Tarefa" largo><input value={t.tarefa} maxLength={LIMITES.texto} onChange={e => alterar(t.id, { tarefa: e.target.value })} placeholder="Descreva uma atividade, começando por um verbo" /></Campo>
            <Campo rotulo="Frequência"><Selecao valor={t.frequencia} opcoes={FREQUENCIAS} aoMudar={v => alterar(t.id, { frequencia: v as Tarefa['frequencia'] })} /></Campo>
            <Campo rotulo="Criticidade"><Selecao valor={t.criticidade} opcoes={CRITICIDADES} aoMudar={v => alterar(t.id, { criticidade: v as Tarefa['criticidade'] })} /></Campo>
            <Campo rotulo="Ferramenta de IA"><input value={t.ferramenta} maxLength={LIMITES.ferramenta} onChange={e => alterar(t.id, { ferramenta: e.target.value })} placeholder="Se houver" /></Campo>
            <Campo rotulo="Efeito da IA"><Selecao valor={t.efeito_ia ?? ''} vazio="Escolha o efeito" opcoes={EFEITOS.map(e => ({ valor: e, rotulo: ROTULO_EFEITO[e] }))} aoMudar={v => alterar(t.id, { efeito_ia: v as Tarefa['efeito_ia'] })} /></Campo>
          </div>
          <button className="remove" disabled={estrutura.tarefas.length <= 1} onClick={() => remover(t.id)} aria-label={`Remover tarefa ${i + 1}`}>×</button>
        </article>
      ))}
      <div className="legend"><span><b>A</b> Automatizada</span><span><b>P</b> Aprimorada</span><span><b>I</b> Inalterada</span><span><b>N</b> Nova</span></div>
    </>
  );
}
```

- [ ] **Step 3: Criar a etapa de competências**

`web/components/funcao/EtapaCompetencias.tsx`:

```tsx
'use client';
import { Campo, Selecao } from '@/components/Campo';
import { EIXOS, LIMITES, NIVEIS, ROTULOS_NIVEL, novaCompetencia, type Competencia, type Estrutura } from '@/lib/estrutura';

export default function EtapaCompetencias({ estrutura, aoMudar }: { estrutura: Estrutura; aoMudar: (e: Estrutura) => void }) {
  const alterar = (id: string, campos: Partial<Competencia>) =>
    aoMudar({ ...estrutura, competencias: estrutura.competencias.map(c => (c.id === id ? { ...c, ...campos, editada: true } : c)) });
  const tarefas = estrutura.tarefas.map((t, i) => ({ valor: t.id, rotulo: t.tarefa.trim() || `Tarefa ${i + 1} (sem descrição)` }));
  const niveis = NIVEIS.map(n => ({ valor: n, rotulo: ROTULOS_NIVEL[n] }));
  return (
    <>
      <div className="section-title">
        <h2>Perfil de competências <span>{estrutura.competencias.length}</span></h2>
        <button className="button secondary small" disabled={estrutura.competencias.length >= LIMITES.competencias}
          onClick={() => aoMudar({ ...estrutura, competencias: [...estrutura.competencias, novaCompetencia(estrutura.tarefas[0]?.id ?? '')] })}>+ Adicionar competência</button>
      </div>
      {estrutura.competencias.length === 0 && <p className="helper">Nenhuma competência ainda. Pense no que a pessoa precisa saber para executar as tarefas que a IA mudou.</p>}
      {estrutura.competencias.map((c, i) => (
        <article className="entry" key={c.id}>
          <div className="entry-number">{String(i + 1).padStart(2, '0')}</div>
          <div className="entry-fields">
            <Campo rotulo="Competência" largo><input value={c.competencia} maxLength={LIMITES.texto} onChange={e => alterar(c.id, { competencia: e.target.value })} placeholder="Ex.: Revisar o resultado da IA antes de enviar ao cliente" /></Campo>
            <Campo rotulo="Eixo"><Selecao valor={c.eixo} opcoes={EIXOS} aoMudar={v => alterar(c.id, { eixo: v as Competencia['eixo'] })} /></Campo>
            <Campo rotulo="Tarefa associada"><Selecao valor={c.tarefa_id} vazio="Escolha a tarefa" opcoes={tarefas} aoMudar={v => alterar(c.id, { tarefa_id: v })} /></Campo>
            <Campo rotulo="Nível-alvo da função"><Selecao valor={c.alvo} opcoes={niveis} aoMudar={v => alterar(c.id, { alvo: v as Competencia['alvo'] })} /></Campo>
          </div>
          <button className="remove" onClick={() => aoMudar({ ...estrutura, competencias: estrutura.competencias.filter(x => x.id !== c.id) })} aria-label={`Remover competência ${i + 1}`}>×</button>
        </article>
      ))}
      <p className="helper">O nível atual é registrado por ocupante, na última etapa. Aqui você define o nível que a função exige.</p>
    </>
  );
}
```

- [ ] **Step 4: Criar a etapa de salvaguarda**

`web/components/funcao/EtapaSalvaguarda.tsx`:

```tsx
'use client';
import { Campo, Selecao } from '@/components/Campo';
import { LIMITES, RESPOSTAS, type Estrutura, type RespostaSalvaguarda } from '@/lib/estrutura';
import { SALVAGUARDAS } from '@/lib/seed';

export default function EtapaSalvaguarda({ estrutura, aoMudar }: { estrutura: Estrutura; aoMudar: (e: Estrutura) => void }) {
  const alterar = (numero: number, campos: Partial<RespostaSalvaguarda>) =>
    aoMudar({ ...estrutura, salvaguardas: estrutura.salvaguardas.map(s => (s.numero === numero ? { ...s, ...campos } : s)) });
  return (
    <>
      <div className="alert info"><strong>Validação com duas pessoas</strong><p>Esta tela registra uma resposta por âncora. Ela não comprova as respostas separadas e a concordância entre gestor e ocupante previstas em UC7.</p></div>
      {SALVAGUARDAS.map(a => {
        const s = estrutura.salvaguardas[a.numero - 1];
        const precisaAjuste = s.resposta !== 'Sim';
        return (
          <article className="safeguard" key={a.numero}>
            <div className="safeguard-top">
              <div><span className="eyebrow">ÂNCORA {a.numero}</span><h2>{a.ancora}</h2><p>{a.verificacao}</p></div>
              <Campo rotulo="Resposta"><Selecao valor={s.resposta} opcoes={RESPOSTAS} aoMudar={v => alterar(a.numero, { resposta: v as RespostaSalvaguarda['resposta'] })} /></Campo>
            </div>
            <div className="entry-fields">
              <Campo rotulo="Observação"><textarea value={s.observacao} maxLength={LIMITES.nota} onChange={e => alterar(a.numero, { observacao: e.target.value })} /></Campo>
              <Campo rotulo={precisaAjuste ? 'Ajuste registrado — necessário' : 'Ajuste registrado (se necessário)'}>
                <textarea value={s.ajuste} maxLength={LIMITES.nota} className={precisaAjuste && !s.ajuste.trim() ? 'needs-adjustment' : ''} onChange={e => alterar(a.numero, { ajuste: e.target.value })} />
              </Campo>
            </div>
          </article>
        );
      })}
    </>
  );
}
```

- [ ] **Step 5: Criar a etapa de ocupantes**

`web/components/funcao/EtapaOcupantes.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';
import type { ResumoOcupante } from '@/lib/ocupantes';

type Props = { funcaoId: string; ocupantes: ResumoOcupante[]; pendencias: string[]; totalCompetencias: number; navegar: (href: string) => Promise<void> };

export default function EtapaOcupantes({ funcaoId, ocupantes, pendencias, totalCompetencias, navegar }: Props) {
  const [apelido, setApelido] = useState('');
  const [erro, setErro] = useState('');
  const [criando, setCriando] = useState(false);
  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCriando(true);
    try {
      const { id } = await chamarApi<{ id: string }>(`/api/funcoes/${funcaoId}/ocupantes`, { method: 'POST', json: { apelido } });
      await navegar(`/funcoes/${funcaoId}/ocupantes/${id}`);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível adicionar.');
      setCriando(false);
    }
  };
  return (
    <>
      {pendencias.length > 0 && <div className="alert info"><strong>Complete a função para gerar trilhas</strong>{pendencias.map(p => <p key={p}>{p}</p>)}</div>}
      <div className="section-title"><h2>Ocupantes <span>{ocupantes.length}</span></h2></div>
      {ocupantes.length ? (
        <div className="cards">{ocupantes.map(o => (
          <button key={o.id} className="card" onClick={() => void navegar(`/funcoes/${funcaoId}/ocupantes/${o.id}`)}>
            <h2>{o.apelido}</h2>
            <p className="helper">Níveis informados: {o.niveisPreenchidos}/{totalCompetencias} · {o.trilhas} trilha(s)</p>
          </button>
        ))}</div>
      ) : <p className="helper">Nenhum ocupante ainda. Adicione cada pessoa que exerce esta função.</p>}
      <form className="panel" onSubmit={adicionar}>
        {erro && <div className="alert error" role="alert">{erro}</div>}
        <Campo rotulo="Apelido do ocupante"><input required maxLength={60} value={apelido} onChange={e => setApelido(e.target.value)} placeholder="Ex.: Atendente 1" /></Campo>
        <div><button className="button primary" disabled={criando}>Adicionar ocupante</button></div>
        <p className="helper">Use um apelido. Não registre nome completo, CPF ou outros dados pessoais.</p>
      </form>
    </>
  );
}
```

- [ ] **Step 6: Criar o editor**

`web/components/funcao/EditorFuncao.tsx`:

```tsx
'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';
import { useAutosave } from '@/components/useAutosave';
import { pendenciasCompetencias, pendenciasEstrutura, pendenciasTarefas, type Estrutura } from '@/lib/estrutura';
import type { ResumoOcupante } from '@/lib/ocupantes';
import EtapaCompetencias from './EtapaCompetencias';
import EtapaOcupantes from './EtapaOcupantes';
import EtapaSalvaguarda from './EtapaSalvaguarda';
import EtapaTarefas from './EtapaTarefas';

const ETAPAS = [
  { nome: 'Tarefas', detalhe: 'Impacto da IA no trabalho', titulo: 'Entenda o trabalho.', texto: 'Registre as tarefas da função e como a IA participa de cada uma.', tag: 'M1 · Diagnóstico' },
  { nome: 'Competências', detalhe: 'O que a função exige', titulo: 'Defina as competências.', texto: 'Relacione cada competência a uma tarefa e escolha o nível que a função exige.', tag: 'M2 · Competências' },
  { nome: 'Salvaguarda', detalhe: 'Qualidade do trabalho', titulo: 'Preserve a qualidade.', texto: 'Confira as condições do trabalho com quem ocupa a função.', tag: 'Salvaguarda · UC7' },
  { nome: 'Ocupantes', detalhe: 'Níveis e trilhas', titulo: 'Avalie cada pessoa.', texto: 'Para cada ocupante, registre o nível atual e gere a trilha de desenvolvimento.', tag: 'M3 + M4 · Trilha' },
];

type Props = { funcao: { id: string; nome: string; estrutura: Estrutura }; ocupantes: ResumoOcupante[] };

export default function EditorFuncao({ funcao, ocupantes }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState(funcao.nome);
  const [estrutura, setEstrutura] = useState(funcao.estrutura);
  const [etapa, setEtapa] = useState(0);
  const [erroAcao, setErroAcao] = useState('');
  const { estado, erro, salvarAgora } = useAutosave(`/api/funcoes/${funcao.id}`, { nome, estrutura });
  const pendTarefas = useMemo(() => pendenciasTarefas(estrutura), [estrutura]);
  const pendCompetencias = useMemo(() => pendenciasCompetencias(estrutura), [estrutura]);
  const bloqueio = etapa === 0 ? pendTarefas : etapa === 1 ? pendCompetencias : [];
  const info = ETAPAS[etapa];

  const navegar = async (href: string) => {
    try {
      await salvarAgora();
      router.push(href);
    } catch {
      // O aviso de erro do salvamento já aparece na tela; não sai sem salvar.
    }
  };
  const irPara = (i: number) => { setEtapa(i); window.scrollTo({ top: 0 }); };
  const arquivar = async () => {
    if (!window.confirm(`Arquivar a função "${nome}"? Ela some do painel, mas as trilhas já geradas continuam registradas.`)) return;
    try {
      await chamarApi(`/api/funcoes/${funcao.id}`, { method: 'DELETE' });
      router.push('/');
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível arquivar.');
    }
  };

  return (
    <main className="shell sem-resumo">
      <aside className="sidebar">
        <p className="eyebrow">FUNÇÃO</p>
        <nav aria-label="Etapas da função">{ETAPAS.map((e, i) => (
          <button key={e.nome} className={`step ${etapa === i ? 'active' : ''}`} onClick={() => irPara(i)}>
            <span className="step-number">0{i + 1}</span><span>{e.nome}<small>{e.detalhe}</small></span>
          </button>
        ))}</nav>
        <div className="side-note">
          <button className="text-button" onClick={() => void navegar('/')}>← Voltar ao painel</button><br />
          <button className="text-button danger" style={{ marginTop: 14 }} onClick={() => void arquivar()}>Arquivar função</button>
        </div>
        <div className="side-footer">MRCC-PV · PBL4<br />Pesquisa aplicada / Pessoas e cultura</div>
      </aside>
      <section className="workspace">
        <div className="page-heading"><div><p className="eyebrow">PASSO 0{etapa + 1} / 04</p><h1>{info.titulo}</h1><p>{info.texto}</p></div><span className="stage-tag">{info.tag}</span></div>
        {(erro || erroAcao) && <div className="alert error" role="alert">{erroAcao || erro}</div>}
        <div className="role-strip">
          <Campo rotulo="Nome da função"><input value={nome} maxLength={120} onChange={e => setNome(e.target.value)} placeholder="Ex.: Atendente de balcão" /></Campo>
          <div className="role-caption">Descreva funções e tarefas.<br />Evite nomes e dados pessoais.</div>
        </div>
        {etapa === 0 && <EtapaTarefas estrutura={estrutura} aoMudar={setEstrutura} />}
        {etapa === 1 && <EtapaCompetencias estrutura={estrutura} aoMudar={setEstrutura} />}
        {etapa === 2 && <EtapaSalvaguarda estrutura={estrutura} aoMudar={setEstrutura} />}
        {etapa === 3 && <EtapaOcupantes funcaoId={funcao.id} ocupantes={ocupantes} pendencias={pendenciasEstrutura(estrutura)} totalCompetencias={estrutura.competencias.length} navegar={navegar} />}
        {bloqueio.length > 0 && <div className="alert info"><strong>Antes de continuar</strong>{bloqueio.map(p => <p key={p}>{p}</p>)}</div>}
        <footer className="workspace-footer">
          <span>{estado === 'salvo' ? 'Alterações salvas.' : estado === 'pendente' ? 'Salvando…' : 'Não foi possível salvar. Veja o aviso acima.'}</span>
          {etapa < 3 && <button className="button primary" disabled={bloqueio.length > 0} onClick={() => irPara(etapa + 1)}>Continuar</button>}
        </footer>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Criar a página**

`web/app/(loja)/funcoes/[id]/page.tsx`:

```tsx
import EditorFuncao from '@/components/funcao/EditorFuncao';
import { db } from '@/lib/db';
import { obterFuncao } from '@/lib/funcoes';
import { listarOcupantes } from '@/lib/ocupantes';
import { exigirPaginaGestor, ou404 } from '@/lib/sessao-web';

export default async function PaginaFuncao({ params }: { params: Promise<{ id: string }> }) {
  const gestor = await exigirPaginaGestor();
  const { id } = await params;
  const funcao = ou404(() => obterFuncao(db(), gestor.empresaId, id));
  const ocupantes = listarOcupantes(db(), gestor.empresaId, id);
  return <EditorFuncao funcao={{ id: funcao.id, nome: funcao.nome, estrutura: funcao.estrutura }} ocupantes={ocupantes} />;
}
```

- [ ] **Step 8: Verificar build e fluxo no navegador**

Run: `cd web && npm test && npm run build`
Expected: PASS e build com `/funcoes/[id]`.

Com `npm run dev`, entre como gestor:
1. Abra o cartão "Atendente de balcão" (importado na Task 10). As 4 etapas mostram os dados da planilha.
2. **Tarefas:** clique em "+ Adicionar tarefa". O botão "Continuar" fica desabilitado e aparece "Tarefa 5: descreva a atividade." e "Tarefa 5: indique o efeito da IA.". Remova a tarefa 5: o botão volta a habilitar.
3. **Tarefa removida com competência ligada:** remova a tarefa "Negociar prazo com cliente insatisfeito". Em Competências, "Julgamento em situação de atendimento difícil" aparece com "Escolha a tarefa" e a pendência "Competência 4: escolha a tarefa associada.". Escolha outra tarefa para resolver.
4. **Review Focus 1:** altere o nome da função e, em menos de 1 segundo, clique em "← Voltar ao painel". O cartão no painel deve mostrar o nome novo. Repita alterando uma tarefa e clicando no cartão de um ocupante (na etapa Ocupantes); depois volte e confira que a alteração está lá.
5. Recarregue a página (F5) logo após digitar: o navegador pergunta se quer sair com alterações não salvas.
6. Na etapa Ocupantes, adicione "Atendente 2": a página do ocupante dá 404 até a Task 12, e isso é esperado; voltando, o cartão "Atendente 2" aparece.
7. Teste o isolamento entre lojas: como admin, crie a "Loja Demo 2" e entre com o gestor dela. Abrir a URL `/funcoes/<id da função da Loja Local>` deve mostrar 404.

- [ ] **Step 9: Commit**

```bash
git add web/components/useAutosave.ts web/components/funcao "web/app/(loja)/funcoes/[id]/page.tsx"
git commit -m "Adiciona editor da funcao em etapas com salvamento automatico" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Página do ocupante (níveis, trilha, resultado e histórico)

**Files:**
- Create: `web/components/ocupante/ResultadoTrilha.tsx`, `web/components/ocupante/PaginaOcupante.tsx`
- Create: `web/app/(loja)/funcoes/[id]/ocupantes/[oid]/page.tsx`

**Interfaces:**
- Consumes: `useAutosave` (Task 11); `chamarApi`, `Campo`, `Selecao` (Task 4); `NIVEIS`, `ROTULOS_NIVEL`, `pendenciasEstrutura`, tipos (Task 1); `calcularLacunas` (Task 8); `type AcaoCatalogo` (Task 2); `obterFuncao`, `obterOcupante` (Task 7); `listarCatalogoAtivo` (Task 8); `listarExecucoes` e as rotas `POST /api/ocupantes/[id]/execucoes`, `GET /api/execucoes/[id]` e `GET /api/execucoes/[id]/download` (Task 9); `PUT/DELETE /api/ocupantes/[id]` (Task 7).
- Produces:
  - `components/ocupante/ResultadoTrilha.tsx`: `type ResultadoAnalise`, `ResultadoTrilha({ resultado, execucaoId })`. Mostra as propostas, as orientações registradas e os downloads, como no formulário antigo.
  - Página `/funcoes/[id]/ocupantes/[oid]`.

- [ ] **Step 1: Criar `web/components/ocupante/ResultadoTrilha.tsx`**

Mesma apresentação do formulário antigo. As orientações vêm de `diagnostico.salvaguardas` do `analise.json`.

```tsx
type Linha = Record<string, string | number | null>;
type Proposta = {
  competencia_id: string; decisao: string; acao_id: string | null; justificativa: string; responsavel_sugerido: string | null;
  prazo_dias_sugerido: number | null; criterio_conclusao: string | null; orientacao_ao_gestor: string;
};
export type ResultadoAnalise = {
  diagnostico: { competencias: Linha[]; catalogo: Linha[]; salvaguardas: Linha[] };
  plano: { resumo: string; recomendacoes: Proposta[] } | null;
  metadados: { tempo_segundos?: number };
};

const valor = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export default function ResultadoTrilha({ resultado, execucaoId }: { resultado: ResultadoAnalise; execucaoId: string }) {
  const { diagnostico, plano, metadados } = resultado;
  const base = `/api/execucoes/${execucaoId}/download?type=`;
  return (
    <>
      <div className="result-heading">
        <span className="badge review">Proposta · revisão pendente</span>
        <span className="helper">{metadados.tempo_segundos ? `Gerada em ${Math.round(metadados.tempo_segundos)} segundos` : 'Diagnóstico calculado'}</span>
      </div>
      {plano?.recomendacoes.map(p => {
        const c = diagnostico.competencias.find(x => x.id === p.competencia_id);
        const a = diagnostico.catalogo.find(x => x.id === p.acao_id);
        return (
          <article className="recommendation" key={p.competencia_id}>
            <div className="recommendation-top"><span className={`badge ${c?.prioridade === 'Alta' ? 'high' : 'medium'}`}>{valor(c?.prioridade)}</span><span className="helper">{p.decisao === 'recomendada' ? 'Ação do catálogo' : 'Decisão pendente'}</span></div>
            <h2>{valor(c?.competencia)}</h2>
            <h3>{a ? valor(a.acao) : p.decisao === 'sem_acao_adequada' ? 'Nenhuma ação adequada disponível' : 'Informações insuficientes'}</h3>
            <p className="justification">{p.justificativa}</p>
            {a && (
              <div className="action-facts">
                <div><small>RECURSO</small><strong>{valor(a.recurso)}</strong></div>
                <div><small>RESPONSÁVEL SUGERIDO</small><strong>{p.responsavel_sugerido}</strong></div>
                <div><small>PRAZO SUGERIDO</small><strong>{p.prazo_dias_sugerido} dias</strong></div>
                <div><small>CUSTO NO CATÁLOGO</small><strong>{valor(a.custo)}</strong></div>
              </div>
            )}
            {p.criterio_conclusao && <div className="criterion"><span>COMO OBSERVAR A CONCLUSÃO</span><p>{p.criterio_conclusao}</p></div>}
            <details><summary>Orientação ao gestor e evidências</summary><p>{p.orientacao_ao_gestor}</p><p className="helper">Tarefa: {valor(c?.tarefa)} · Referências: PBL4, RF09, RF10, RNF08 e UC6.</p></details>
          </article>
        );
      })}
      {plano?.recomendacoes.length === 0 && <div className="alert info">Não há lacunas positivas nesta rodada. Revise as salvaguardas e acompanhe o trabalho.</div>}
      <div className="recorded">
        <h3>Orientações registradas na salvaguarda</h3>
        {diagnostico.salvaguardas.filter(s => valor(s.ajuste).trim() || s.ancora === 'Diretriz de uso crítico').map(s => (
          <p key={valor(s.ancora)}><strong>{valor(s.ancora)}:</strong> {valor(s.ajuste) || valor(s.observacao)}</p>
        ))}
        <p className="helper">Estas orientações vêm das respostas, independentemente do texto gerado. Validação bilateral ainda não verificada.</p>
      </div>
      <div className="downloads">
        <a className="button secondary" href={`${base}${plano ? 'excel' : 'input'}`}>Baixar planilha</a>
        <a className="button secondary" href={`${base}report`}>Baixar relatório (PDF)</a>
        <a className="text-button" href={`${base}json`}>Registro completo (JSON)</a>
        {plano && <a className="text-button" href={`${base}evaluation`}>Ficha de avaliação</a>}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Criar `web/components/ocupante/PaginaOcupante.tsx`**

**Review Focus 2:** `gerar()` chama `await salvarAgora()` **antes** do POST. Assim, a execução usa os níveis que estão na tela, mesmo dentro dos 700 ms do debounce.

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { chamarApi } from '@/components/api';
import { Campo, Selecao } from '@/components/Campo';
import { useAutosave } from '@/components/useAutosave';
import { NIVEIS, ROTULOS_NIVEL, pendenciasEstrutura, type Estrutura, type Nivel, type Niveis } from '@/lib/estrutura';
import { calcularLacunas } from '@/lib/lacunas';
import type { AcaoCatalogo } from '@/lib/seed';
import ResultadoTrilha, { type ResultadoAnalise } from './ResultadoTrilha';

type Execucao = { id: string; tipo: 'trilha' | 'diagnostico'; status: 'aguardando' | 'executando' | 'concluida' | 'erro'; criadaEm: string; error?: string; posicao: number | null; result: ResultadoAnalise | null };
type Historico = { id: string; tipo: string; criadaEm: string };
type Props = {
  funcao: { id: string; nome: string; estrutura: Estrutura };
  ocupante: { id: string; apelido: string; niveis: Niveis; prazoDias: number };
  historico: Historico[];
  catalogo: AcaoCatalogo[];
};

export default function PaginaOcupante({ funcao, ocupante, historico: historicoInicial, catalogo }: Props) {
  const router = useRouter();
  const [apelido, setApelido] = useState(ocupante.apelido);
  const [niveis, setNiveis] = useState<Niveis>(ocupante.niveis);
  const [prazoDias, setPrazoDias] = useState(ocupante.prazoDias);
  const [execucao, setExecucao] = useState<Execucao | null>(null);
  const [historico, setHistorico] = useState(historicoInicial);
  const [erro, setErro] = useState('');
  const [iniciando, setIniciando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const { estado, erro: erroSalvar, salvarAgora } = useAutosave(`/api/ocupantes/${ocupante.id}`, { apelido, niveis, prazoDias });
  const emAndamento = execucao?.status === 'aguardando' || execucao?.status === 'executando';
  const ocupado = iniciando || emAndamento;
  const { estrutura } = funcao;
  const lacunas = useMemo(() => calcularLacunas(estrutura, niveis), [estrutura, niveis]);
  const pendencias = useMemo(() => [
    ...pendenciasEstrutura(estrutura),
    ...estrutura.competencias.filter(c => !niveis[c.id]).map(c => `Informe o nível atual de "${c.competencia.trim() || 'competência sem nome'}".`),
  ], [estrutura, niveis]);

  useEffect(() => {
    chamarApi<{ modelReady?: boolean }>('/api/health').then(d => setPronto(Boolean(d.modelReady))).catch(() => setPronto(false));
  }, []);

  const idEmAndamento = emAndamento ? execucao?.id : undefined;
  useEffect(() => {
    if (!idEmAndamento) return;
    let parado = false;
    const consultar = async () => {
      try {
        const dados = await chamarApi<Execucao>(`/api/execucoes/${idEmAndamento}`);
        if (parado) return;
        setExecucao(dados);
        if (dados.status === 'erro') setErro(dados.error ?? 'A geração falhou.');
      } catch (e) {
        if (!parado) setErro(e instanceof Error ? e.message : 'Falha ao consultar a geração.');
      }
    };
    const timer = setInterval(() => void consultar(), 4000);
    return () => { parado = true; clearInterval(timer); };
  }, [idEmAndamento]);

  useEffect(() => {
    if (!ocupado) return;
    setSegundos(0);
    const timer = setInterval(() => setSegundos(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [ocupado]);

  const gerar = async (tipo: 'trilha' | 'diagnostico') => {
    if (ocupado) return;
    setErro('');
    setIniciando(true);
    try {
      await salvarAgora();
      const dados = await chamarApi<Execucao>(`/api/ocupantes/${ocupante.id}/execucoes`, { method: 'POST', json: { tipo } });
      setExecucao({ ...dados, result: null });
      setHistorico(h => [{ id: dados.id, tipo, criadaEm: dados.criadaEm }, ...h].slice(0, 10));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível iniciar.');
    } finally {
      setIniciando(false);
    }
  };
  const abrir = async (id: string) => {
    if (ocupado) return;
    try {
      const dados = await chamarApi<Execucao>(`/api/execucoes/${id}`);
      setExecucao(dados);
      setErro(dados.status === 'erro' ? dados.error ?? 'A geração falhou.' : '');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Análise indisponível.');
    }
  };
  const mudarNivel = (competenciaId: string, nivel: string) => {
    setExecucao(null);
    setNiveis(n => ({ ...n, [competenciaId]: { nivel: nivel as Nivel, respostas: null } }));
  };
  const voltar = async () => {
    try {
      await salvarAgora();
      router.push(`/funcoes/${funcao.id}`);
    } catch {
      // O aviso de erro do salvamento já aparece na tela.
    }
  };
  const arquivar = async () => {
    if (!window.confirm(`Arquivar ${apelido}? As trilhas já geradas continuam registradas.`)) return;
    try {
      await chamarApi(`/api/ocupantes/${ocupante.id}`, { method: 'DELETE' });
      router.push(`/funcoes/${funcao.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível arquivar.');
    }
  };
  const resultado = execucao?.status === 'concluida' ? execucao.result : null;
  const naFila = execucao?.status === 'aguardando' && (execucao.posicao ?? 0) > 0;

  return (
    <main className="page">
      <button className="text-button" onClick={() => void voltar()}>← {funcao.nome}</button>
      <div className="page-heading">
        <div><p className="eyebrow">OCUPANTE DA FUNÇÃO</p><h1>{apelido.trim() || 'Ocupante'}</h1><p>Registre o nível atual em cada competência. A lacuna é a distância até o nível que a função exige.</p></div>
        <span className="stage-tag">M3 + M4 · Trilha</span>
      </div>
      {(erro || erroSalvar) && <div className="alert error" role="alert">{erro || erroSalvar}<button onClick={() => setErro('')} aria-label="Fechar aviso">×</button></div>}
      <div className="role-strip">
        <Campo rotulo="Apelido"><input value={apelido} maxLength={60} disabled={ocupado} onChange={e => setApelido(e.target.value)} /></Campo>
        <div className="role-caption">Use um apelido.<br />Não registre dados pessoais.</div>
      </div>
      <fieldset className="editor" disabled={ocupado}>
        <div className="section-title"><h2>Nível atual <span>{estrutura.competencias.length}</span></h2></div>
        {estrutura.competencias.map((c, i) => {
          const tarefa = estrutura.tarefas.find(t => t.id === c.tarefa_id);
          return (
            <article className="entry" key={c.id}>
              <div className="entry-number">{String(i + 1).padStart(2, '0')}</div>
              <div className="entry-fields">
                <div className="wide"><strong>{c.competencia.trim() || 'Competência sem nome'}</strong><p className="helper">{c.eixo} · Tarefa: {tarefa?.tarefa || 'não associada'} · A função exige: {ROTULOS_NIVEL[c.alvo]}</p></div>
                <Campo rotulo="Nível atual"><Selecao valor={niveis[c.id]?.nivel ?? ''} vazio="Escolha o nível" opcoes={NIVEIS.map(n => ({ valor: n, rotulo: ROTULOS_NIVEL[n] }))} aoMudar={v => mudarNivel(c.id, v)} /></Campo>
              </div>
            </article>
          );
        })}
      </fieldset>
      <div className="priority-table">
        <div className="section-title"><h2>Lacunas deste ocupante</h2><span className="helper">Maior score primeiro</span></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Competência</th><th>Níveis</th><th>Lacuna</th><th>Score</th><th>Prioridade</th></tr></thead>
          <tbody>{lacunas.map(l => (
            <tr key={l.competenciaId}>
              <td>{l.competencia}</td><td>{l.atual ?? '—'} → {l.alvo}</td><td>{l.lacuna ?? '—'}</td><td>{l.score ?? '—'}</td>
              <td><span className={`badge ${l.prioridade === 'Alta' ? 'high' : l.prioridade === 'Média' ? 'medium' : 'none'}`}>{l.prioridade}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      <Campo rotulo="Prazo inicial proposto (dias)">
        <input type="number" min={1} max={180} step={1} disabled={ocupado} value={prazoDias} onChange={e => { setExecucao(null); setPrazoDias(Number(e.target.value)); }} />
      </Campo>
      <p className="helper">Confirme o prazo com a equipe. Os critérios são referências do protótipo; a IA escolhe a atividade e justifica a escolha.</p>
      {pendencias.length > 0 && <div className="alert info"><strong>Para gerar a trilha</strong>{pendencias.map(p => <p key={p}>{p}</p>)}</div>}
      <div className="generation-bar">
        <div><h2>Propostas para o gestor</h2><p>Escolhas dentro do catálogo, com justificativa e evidência de conclusão.</p></div>
        <button className="button primary" disabled={ocupado || !pronto || pendencias.length > 0} onClick={() => void gerar('trilha')}>{ocupado ? 'Gerando…' : 'Gerar recomendações'}</button>
      </div>
      {!pronto && <p className="helper">As recomendações estão indisponíveis no momento (modelo de IA não carregado). O diagnóstico continua disponível.</p>}
      {ocupado && (
        <div className="processing" role="status"><span className="spinner" /><div>
          <strong>{naFila ? `Na fila · posição ${execucao?.posicao}` : execucao?.tipo === 'diagnostico' ? 'Calculando o diagnóstico' : 'Preparando a trilha'}</strong>
          <p>A geração pode levar alguns minutos nesta máquina. Você pode manter a página aberta; o pedido continua em segundo plano.</p>
          <span className="helper">Tempo nesta página: {Math.floor(segundos / 60)} min {segundos % 60} s</span>
        </div></div>
      )}
      {!ocupado && !resultado && (
        <div className="empty-state"><span className="empty-mark">↳</span><h3>O próximo passo é desenvolver.</h3><p>Gere a trilha para transformar as lacunas em propostas de ação.</p>
          <button className="text-button" disabled={pendencias.length > 0} onClick={() => void gerar('diagnostico')}>Conferir diagnóstico sem gerar a trilha</button></div>
      )}
      {resultado && execucao && <ResultadoTrilha resultado={resultado} execucaoId={execucao.id} />}
      <div className="catalog">
        <button className="catalog-toggle" onClick={() => setCatalogoAberto(!catalogoAberto)} aria-expanded={catalogoAberto}><span>Catálogo de ações disponíveis <b>{catalogo.length}</b></span><span>{catalogoAberto ? '−' : '+'}</span></button>
        {catalogoAberto && <div className="catalog-items">{catalogo.map(a => <div key={`${a.eixo}|${a.acao}`}><span className="eyebrow">{a.eixo}</span><p>{a.acao}</p><small>{a.recurso} · {a.custo}</small></div>)}</div>}
      </div>
      <div className="session-history">
        <p className="eyebrow">ANÁLISES DESTE OCUPANTE</p>
        {historico.length ? historico.map((h, i) => (
          <button key={h.id} className="history-item" disabled={ocupado} onClick={() => void abrir(h.id)}>
            <span>{h.tipo === 'trilha' ? 'Trilha' : 'Diagnóstico'} {historico.length - i}</span>
            <small>{new Date(h.criadaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
          </button>
        )) : <p className="helper">O histórico aparecerá aqui.</p>}
      </div>
      <footer className="workspace-footer">
        <span>{estado === 'salvo' ? 'Alterações salvas.' : estado === 'pendente' ? 'Salvando…' : 'Não foi possível salvar. Veja o aviso acima.'} Prazos e critérios precisam de revisão. R$ 0 não inclui o tempo de trabalho.</span>
        <button className="text-button danger" disabled={ocupado} onClick={() => void arquivar()}>Arquivar ocupante</button>
      </footer>
    </main>
  );
}
```

- [ ] **Step 3: Criar a página**

`web/app/(loja)/funcoes/[id]/ocupantes/[oid]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import PaginaOcupante from '@/components/ocupante/PaginaOcupante';
import { listarCatalogoAtivo } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { listarExecucoes } from '@/lib/execucoes';
import { obterFuncao } from '@/lib/funcoes';
import { obterOcupante } from '@/lib/ocupantes';
import { exigirPaginaGestor, ou404 } from '@/lib/sessao-web';

export default async function Pagina({ params }: { params: Promise<{ id: string; oid: string }> }) {
  const gestor = await exigirPaginaGestor();
  const { id, oid } = await params;
  const banco = db();
  const funcao = ou404(() => obterFuncao(banco, gestor.empresaId, id));
  const ocupante = ou404(() => obterOcupante(banco, gestor.empresaId, oid));
  if (ocupante.funcaoId !== funcao.id) notFound();
  return (
    <PaginaOcupante
      funcao={{ id: funcao.id, nome: funcao.nome, estrutura: funcao.estrutura }}
      ocupante={{ id: ocupante.id, apelido: ocupante.apelido, niveis: ocupante.niveis, prazoDias: ocupante.prazoDias }}
      historico={listarExecucoes(banco, ocupante.id)}
      catalogo={listarCatalogoAtivo(banco, gestor.empresaId)}
    />
  );
}
```

- [ ] **Step 4: Verificar build e fluxo no navegador**

Run: `cd web && npm test && npm run build`
Expected: PASS e build com `/funcoes/[id]/ocupantes/[oid]`.

Com `npm run dev`, entre como gestor e abra "Atendente de balcão" → Ocupantes → "Ocupante 1":
1. Os níveis importados aparecem (N0, N1, N2, N2) e a tabela mostra Letramento 26/Alta, Proficiência 16/Média, Julgamento 15/Média e Adaptabilidade 5/Nenhuma.
2. **Review Focus 2:** troque o nível de Letramento para N1 e, em menos de 1 segundo, clique em "Conferir diagnóstico sem gerar a trilha". Quando concluir, baixe o "Registro completo (JSON)" e confira em `diagnostico.competencias` que Letramento tem `"atual": "N1 - Usuário assistido"`.
3. O diagnóstico concluído mostra "Diagnóstico calculado", as orientações registradas (Significado da tarefa e Diretriz de uso crítico) e os downloads; "Baixar planilha" e "Baixar relatório (PDF)" baixam arquivos válidos.
4. O histórico lista "Diagnóstico 1"; clicar nele reabre o resultado.
5. Sem Ollama local, o botão "Gerar recomendações" fica desabilitado e aparece o aviso de indisponibilidade. Com Ollama e `qwen3:4b`, gere a trilha: aparece "Preparando a trilha" e, depois, as propostas.
6. Volte pela seta "← Atendente de balcão": o cartão do ocupante mostra "Níveis informados: 4/4".
7. Abra a URL de um ocupante com o `[id]` de outra função da mesma loja: deve dar 404.

- [ ] **Step 5: Commit**

```bash
git add web/components/ocupante "web/app/(loja)/funcoes/[id]/ocupantes"
git commit -m "Adiciona pagina do ocupante com niveis, lacunas e trilha" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Tempo ativo de preenchimento (RNF01)

**Files:**
- Create: `web/lib/tempo.ts`
- Test: `web/lib/tempo.test.ts`
- Create: `web/app/api/tempo/route.ts`, `web/components/useTempoAtivo.ts`
- Modify: `web/components/funcao/EditorFuncao.tsx`, `web/components/ocupante/PaginaOcupante.tsx` (chamar o hook)

**Interfaces:**
- Consumes: `bancoDeTeste`, `inserirEmpresa` (Task 2); `estruturaVazia` (Task 1); `criarFuncao`, `criarOcupante` (Task 7); `HttpErro`, `errorResponse`, `lerJson`, `sameOrigin` (Task 3); `exigirGestor` (Task 4).
- Produces:
  - `lib/tempo.ts`: `INTERVALO_S = 30`, `type AlvoTempo = { tipo: 'funcao' | 'ocupante'; id: string }`, `registrarTempo(db, alvo, empresaId: string, ultimos: Map<string, number>, agora?): boolean`. Soma 30 s; ignora batidas com menos de 25 s de intervalo para o mesmo alvo; lança `HttpErro` 404 se o alvo não for da empresa.
  - `POST /api/tempo` com `{ tipo, id }` responde 204.
  - `components/useTempoAtivo.ts`: `useTempoAtivo(tipo: 'funcao' | 'ocupante', id: string): void`. Envia uma batida a cada 30 s enquanto a aba está visível e houve interação nos últimos 2 min.

- [ ] **Step 1: Escrever os testes que falham**

`web/lib/tempo.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { estruturaVazia } from './estrutura.ts';
import { criarFuncao } from './funcoes.ts';
import { criarOcupante } from './ocupantes.ts';
import { registrarTempo } from './tempo.ts';

function cenario() {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const funcaoId = criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  const ocupanteId = criarOcupante(db, a, funcaoId, { apelido: 'Caixa 1' });
  return { db, a, b, funcaoId, ocupanteId };
}
const segundos = (db: ReturnType<typeof bancoDeTeste>, tabela: string, id: string) =>
  Number((db.prepare(`SELECT tempo_ativo_s AS s FROM ${tabela} WHERE id = ?`).get(id) as { s: number }).s);

test('soma 30 s por batida e ignora batidas muito próximas', () => {
  const { db, a, funcaoId } = cenario();
  const mapa = new Map<string, number>();
  const t0 = 1_000_000;
  assert.equal(registrarTempo(db, { tipo: 'funcao', id: funcaoId }, a, mapa, t0), true);
  assert.equal(registrarTempo(db, { tipo: 'funcao', id: funcaoId }, a, mapa, t0 + 10_000), false);
  assert.equal(registrarTempo(db, { tipo: 'funcao', id: funcaoId }, a, mapa, t0 + 30_000), true);
  assert.equal(segundos(db, 'funcoes', funcaoId), 60);
});

test('registra o tempo do ocupante separado do tempo da função', () => {
  const { db, a, funcaoId, ocupanteId } = cenario();
  registrarTempo(db, { tipo: 'ocupante', id: ocupanteId }, a, new Map());
  assert.equal(segundos(db, 'ocupantes', ocupanteId), 30);
  assert.equal(segundos(db, 'funcoes', funcaoId), 0);
});

test('não registra tempo em função ou ocupante de outra empresa', () => {
  const { db, b, funcaoId, ocupanteId } = cenario();
  assert.throws(() => registrarTempo(db, { tipo: 'funcao', id: funcaoId }, b, new Map()), { status: 404 });
  assert.throws(() => registrarTempo(db, { tipo: 'ocupante', id: ocupanteId }, b, new Map()), { status: 404 });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `tempo.ts`.

- [ ] **Step 3: Implementar `web/lib/tempo.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import { HttpErro } from './http.ts';

export const INTERVALO_S = 30;
const MIN_INTERVALO_MS = 25_000;
const LIMPEZA_MS = 60 * 60 * 1000;

export type AlvoTempo = { tipo: 'funcao' | 'ocupante'; id: string };

/** Soma tempo ativo de preenchimento (indicador de RNF01). `ultimos` guarda a última batida aceita por alvo. */
export function registrarTempo(db: DatabaseSync, alvo: AlvoTempo, empresaId: string, ultimos: Map<string, number>, agora = Date.now()): boolean {
  const chave = `${alvo.tipo}:${alvo.id}`;
  const anterior = ultimos.get(chave);
  if (anterior !== undefined && agora - anterior < MIN_INTERVALO_MS) return false;
  const sql = alvo.tipo === 'funcao'
    ? 'UPDATE funcoes SET tempo_ativo_s = tempo_ativo_s + ? WHERE id = ? AND empresa_id = ? AND arquivada = 0'
    : 'UPDATE ocupantes SET tempo_ativo_s = tempo_ativo_s + ? WHERE id = ? AND arquivado = 0 AND funcao_id IN (SELECT id FROM funcoes WHERE empresa_id = ? AND arquivada = 0)';
  const r = db.prepare(sql).run(INTERVALO_S, alvo.id, empresaId);
  if (Number(r.changes) === 0) throw new HttpErro(404, 'Registro não encontrado.');
  if (ultimos.size > 1000) for (const [k, v] of ultimos) if (agora - v > LIMPEZA_MS) ultimos.delete(k);
  ultimos.set(chave, agora);
  return true;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd web && npm test`
Expected: PASS.

- [ ] **Step 5: Criar a rota e o hook**

`web/app/api/tempo/route.ts`:

```ts
import { db } from '@/lib/db';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';
import { registrarTempo } from '@/lib/tempo';

export const runtime = 'nodejs';
const estado = globalThis as typeof globalThis & { mrccTempo?: Map<string, number> };

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { tipo, id } = await lerJson(request, 500);
    if ((tipo !== 'funcao' && tipo !== 'ocupante') || typeof id !== 'string') throw new HttpErro(400, 'Solicitação inválida.');
    registrarTempo(db(), { tipo, id }, gestor.empresaId, (estado.mrccTempo ??= new Map()));
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/components/useTempoAtivo.ts`:

```ts
'use client';
import { useEffect } from 'react';

/** A cada 30 s, se a aba está visível e houve interação nos últimos 2 min, registra tempo ativo. */
export function useTempoAtivo(tipo: 'funcao' | 'ocupante', id: string): void {
  useEffect(() => {
    let ultimaInteracao = Date.now();
    const marcar = () => { ultimaInteracao = Date.now(); };
    const eventos = ['keydown', 'pointerdown', 'input', 'scroll'];
    eventos.forEach(e => window.addEventListener(e, marcar, { passive: true }));
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - ultimaInteracao > 120_000) return;
      void fetch('/api/tempo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, id }) }).catch(() => undefined);
    }, 30_000);
    return () => {
      clearInterval(timer);
      eventos.forEach(e => window.removeEventListener(e, marcar));
    };
  }, [tipo, id]);
}
```

- [ ] **Step 6: Ligar o hook nas duas telas**

Em `web/components/funcao/EditorFuncao.tsx`:
- acrescente `import { useTempoAtivo } from '@/components/useTempoAtivo';` junto aos outros imports de `@/components`;
- logo depois da linha `const { estado, erro, salvarAgora } = useAutosave(...)`, acrescente `useTempoAtivo('funcao', funcao.id);`.

Em `web/components/ocupante/PaginaOcupante.tsx`:
- acrescente `import { useTempoAtivo } from '@/components/useTempoAtivo';` junto aos outros imports de `@/components`;
- logo depois da linha `const { estado, erro: erroSalvar, salvarAgora } = useAutosave(...)`, acrescente `useTempoAtivo('ocupante', ocupante.id);`.

- [ ] **Step 7: Verificar**

Run: `cd web && npm test && npm run build`
Expected: PASS e build com `/api/tempo`.

Com `npm run dev`, abra uma função, digite algo e mantenha a aba aberta por pouco mais de 1 minuto, interagindo. Depois rode, dentro de `web/`:

```bash
node --disable-warning=ExperimentalWarning -e "import('./lib/db.ts').then(({ db }) => console.log(db().prepare('SELECT nome, tempo_ativo_s FROM funcoes ORDER BY atualizada_em DESC LIMIT 1').get()))"
```

Expected: `tempo_ativo_s` igual a 30 ou 60 para a função editada. Com a aba em segundo plano, o valor não aumenta.

- [ ] **Step 8: Commit**

```bash
git add web/lib/tempo.ts web/lib/tempo.test.ts web/app/api/tempo web/components/useTempoAtivo.ts web/components/funcao/EditorFuncao.tsx web/components/ocupante/PaginaOcupante.tsx
git commit -m "Registra tempo ativo de preenchimento por funcao e ocupante" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Publicação, documentação e verificação final

**Files:**
- Modify: `deploy/nginx.conf` (conteúdo final abaixo)
- Modify: `web/test-browser.cjs` (fluxo com login)
- Modify: `README.md`, `SITE_WEB.md`, `DEPLOY_GITHUB.md`

**Interfaces:**
- Consumes: todas as rotas e telas das Tasks 4–13.
- Produces:
  - Configuração do Nginx com limite de login e de geração na rota nova (aplicada manualmente na VM).
  - Roteiro de ponta a ponta (`node test-browser.cjs`).
  - Documentação do primeiro acesso.

- [ ] **Step 1: Substituir `deploy/nginx.conf` inteiro**

A rota de geração mudou de `/api/jobs` para `/api/ocupantes/<id>/execucoes`, e o login ganha um limite próprio. O aviso de manutenção também é conferido pela aplicação (Task 9). Mesmo assim, o Nginx mantém a checagem para responder sem acordar o Node.

```nginx
limit_req_zone $binary_remote_addr zone=mrcc_generation:10m rate=2r/m;
limit_req_zone $binary_remote_addr zone=mrcc_login:10m rate=10r/m;
server {
 listen 80 default_server;
 server_name 147.15.89.156;
 location /.well-known/acme-challenge/ { root /var/www/mrcc-acme; }
 location / { return 301 https://147.15.89.156$request_uri; }
}
server {
 listen 443 ssl http2;
 server_name 147.15.89.156;
 ssl_certificate /etc/letsencrypt/live/147.15.89.156/fullchain.pem;
 ssl_certificate_key /etc/letsencrypt/live/147.15.89.156/privkey.pem;
 ssl_protocols TLSv1.2 TLSv1.3;
 client_max_body_size 2m;
 add_header X-Content-Type-Options nosniff always;
 add_header X-Frame-Options DENY always;
 add_header Referrer-Policy same-origin always;
 location = /api/auth/login {
   limit_req zone=mrcc_login burst=5 nodelay;
   limit_req_status 429;
   proxy_pass http://127.0.0.1:3000;
   proxy_set_header Host $host;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header X-Forwarded-For $remote_addr;
 }
 location ~ ^/api/ocupantes/[0-9a-f-]+/execucoes$ {
   if (-f /var/lib/mrcc-pv-deploy/maintenance) {
     return 503 '{"error":"O site está sendo atualizado. Aguarde um minuto e tente novamente."}';
   }
   limit_req zone=mrcc_generation burst=2 nodelay;
   limit_req_status 429;
   proxy_pass http://127.0.0.1:3000;
   proxy_set_header Host $host;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header X-Forwarded-For $remote_addr;
 }
 location / {
   proxy_pass http://127.0.0.1:3000;
   proxy_set_header Host $host;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header X-Forwarded-For $remote_addr;
   proxy_read_timeout 60s;
 }
}
```

- [ ] **Step 2: Substituir `web/test-browser.cjs` inteiro**

```js
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
  await page.getByLabel('Nome da função').fill(nome);
  await page.getByRole('button', { name: 'Começar em branco' }).click();
  await expect(page.getByRole('heading', { name: 'Entenda o trabalho.' })).toBeVisible();
  await page.getByLabel('Tarefa', { exact: true }).fill('Montar orçamento para o cliente');
  await page.getByLabel('Efeito da IA').selectOption('P');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: '+ Adicionar competência' }).click();
  await page.getByLabel('Competência', { exact: true }).fill('Proficiência na ferramenta de orçamento');
  await page.getByRole('button', { name: /Ocupantes/ }).click();
  await expect(page.getByText('Alterações salvas.')).toBeVisible();
  await page.getByLabel('Apelido do ocupante').fill('Atendente 1');
  await page.getByRole('button', { name: 'Adicionar ocupante' }).click();
  await expect(page.getByRole('heading', { name: 'Atendente 1' })).toBeVisible();
  await page.getByLabel('Nível atual').selectOption('N1');
  await page.getByRole('button', { name: 'Conferir diagnóstico sem gerar a trilha' }).click();
  await expect(page.getByRole('link', { name: 'Baixar planilha' })).toBeVisible({ timeout: 60000 });
  fs.mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/ocupante.png', fullPage: true });

  await page.goto('/');
  await expect(page.getByRole('link', { name: new RegExp(nome) })).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Fluxo do gestor verificado.');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Atualizar a documentação**

Em `README.md`, troque a frase:

```
Também disponível como site em **https://147.15.89.156**, com preenchimento direto, sessão anônima, histórico e inferência na própria VM.
```

por:

```
Também disponível como site em **https://147.15.89.156**, com login por empresa (criado pela equipe da pesquisa), funções e ocupantes, histórico e inferência na própria VM.
```

Em `SITE_WEB.md`, substitua tudo entre `## Uso` e `## Instalação e serviços` (exclusive) por:

```markdown
## Uso

O acesso exige login. A equipe da pesquisa (admin) cadastra cada empresa com o e-mail do gestor e entrega a senha temporária, que é trocada no primeiro acesso.

1. **Admin** (`/admin`): cadastra empresas, gera nova senha temporária e desativa ou reativa o acesso.
2. **Gestor** (`/`): vê as funções da loja e cria uma nova, em branco ou importando a planilha MRCC-PV.
3. Em cada função, preenche Tarefas, Competências (com o nível-alvo da função) e Salvaguarda. O salvamento é automático.
4. Na etapa Ocupantes, adiciona cada pessoa por apelido, sem dados pessoais. Na página do ocupante, informa o nível atual de cada competência.
5. Clica em **Gerar recomendações**. Os pedidos entram em uma fila (uma geração por vez na VM, uma por loja). A página mostra a posição e o resultado.

O histórico de análises fica em cada ocupante. **Baixar relatório (PDF)** produz o documento A4 a partir da análise salva, sem nova inferência. Os downloads só são liberados para a empresa dona da análise (e para o admin).

O tempo ativo de preenchimento de cada função e de cada ocupante é registrado para o indicador de RNF01 (até 90 minutos por função).

As análises anônimas feitas antes do login continuam no banco e nas pastas de `web/data/`, mas não aparecem mais no site.

```

Em `DEPLOY_GITHUB.md`, acrescente antes de `## Credencial de publicação`:

```markdown
## Contas: passos manuais na primeira publicação

A versão com login cria as tabelas novas sozinha na inicialização. Três passos são feitos uma única vez, por SSH administrativo:

1. **Criar o admin** (dentro do código ativo):

   ```bash
   cd /home/ubuntu/mrcc-deploy/current/web
   node scripts/criar-admin.mjs email-do-admin@exemplo.com
   ```

   O script pede a senha duas vezes, sem mostrá-la. Rodar de novo com o mesmo e-mail redefine a senha do admin.

2. **Aplicar o Nginx** de `deploy/nginx.conf` (limite de login e rota nova de geração):

   ```bash
   sudo cp /home/ubuntu/mrcc-deploy/current/deploy/nginx.conf /etc/nginx/sites-available/mrcc-pv
   sudo nginx -t && sudo systemctl reload nginx
   ```

   Confira antes o nome do arquivo de site em uso com `ls /etc/nginx/sites-enabled/`.

3. **Conferir** `https://147.15.89.156/login` e entrar como admin.

Se houver rollback para a versão anterior ao login, o modo anônimo volta temporariamente; as tabelas novas ficam intactas e são usadas de novo na próxima publicação.

```

- [ ] **Step 4: Verificação completa**

Run (na raiz): `python -m unittest test_recomendar test_web_bridge test_deploy`
Expected: OK (o motor Python não mudou nesta fase).

Run: `cd web && npm test && npm run build`
Expected: todos os testes passam e o build conclui.

Com `npm run dev` e o gestor local com senha trocada:

Run: `cd web && MRCC_TEST_EMAIL=gestor@local.test MRCC_TEST_SENHA=gestor-local-123 node test-browser.cjs`
Expected: `Fluxo do gestor verificado.`

- [ ] **Step 5: Revisão de segurança da autenticação**

Revise `web/lib/auth.ts`, `web/lib/senha.ts`, `web/lib/sessao-web.ts`, `web/lib/execucoes.ts` e todas as rotas em `web/app/api/`. Confira cada item e anote no PR:
- toda rota que lê ou altera dados chama `exigirUsuario`, `exigirGestor` ou `exigirPagina` antes de tocar no banco;
- toda mutação chama `sameOrigin`;
- toda consulta do gestor recebe `empresaId` da sessão, nunca do corpo da requisição;
- nenhuma resposta inclui `senha_hash`, `token_hash` ou `runnerId`;
- o login responde a mesma mensagem para e-mail inexistente, senha errada, conta bloqueada e empresa desativada;
- `/api/health` continua público e sem dados de empresas.

Corrija o que encontrar, rode o Step 4 de novo e faça commit da correção.

- [ ] **Step 6: Commit**

```bash
git add deploy/nginx.conf web/test-browser.cjs README.md SITE_WEB.md DEPLOY_GITHUB.md
git commit -m "Documenta primeiro acesso e atualiza Nginx para o fluxo com login" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Cobertura do spec (fase 1)

| Spec | Onde |
|---|---|
| §5 Modelo de dados (tabelas da fase 1) | Task 2 |
| §5 Estrutura JSON, validação e IDs estáveis | Task 1 |
| §6 Senha, sessão, bloqueio, troca, reset | Tasks 3, 4 e 6 |
| §6 Primeiro admin por script | Task 5 |
| §6 Autorização por empresa, 404 | Tasks 4, 7, 9 e 12 |
| §7 Painel, nova função, editor em 4 etapas, ocupantes | Tasks 10, 11 e 12 |
| §8.5 Importar planilha | Task 10 |
| §9 Fila (1 worker, 6 aguardando, 1 por empresa, posição, reinício) | Task 9 |
| §10 Integração com o motor (mesmo JSON) | Tasks 8 e 9 |
| §11 Tempo ativo (base para métricas) | Task 13 |
| §14 Esquema aditivo, rotas anônimas removidas, Nginx, documentação | Tasks 2, 10 e 14 |

Ficam para as fases 2–4, com planos próprios: regras RF05/RF07, perguntas de nível, modelos, ferramentas da loja, copiar função, catálogo da loja (e o limite de 40 ações no Python), texto livre com IA, leitura pelo admin, métricas, CSV e avaliação de facilidade.
