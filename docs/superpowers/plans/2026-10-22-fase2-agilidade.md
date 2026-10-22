# Fase 2 — Agilidade sem LLM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir o esforço do gestor com recursos determinísticos: competências sugeridas por regra (RF05) e perda de centralidade (RF07), nível atual por três perguntas de sim/não, modelos de cargo mantidos pelo admin, ferramentas de IA da loja, copiar função, catálogo global + ações da loja e controles com linguagem simples.

**Architecture:** Mesma base da fase 1 (Next.js 16, `node:sqlite`, módulos puros em `web/lib/*.ts` testados com `node --test`). Duas tabelas novas e aditivas (`modelos_funcao`, `ferramentas_ia`). A estrutura da função ganha um campo opcional (`sugestoes_ignoradas`), sem mudar `versao`. O motor Python só muda o limite do catálogo (16 → 40).

**Tech Stack:** Node 24, Next.js 16.3.8, React 19, TypeScript 5.9, `node:sqlite`, `node:test`, Python 3.10 (`unittest`).

**Spec:** `docs/superpowers/specs/2026-10-15-contas-e-celeridade-design.md` (fase 2 do §15; §7, §8.1, §8.2, §8.3, §8.5, §10).

## Global Constraints

- Nenhuma dependência nova de npm ou pip.
- Módulos de `web/lib/*.ts` usam imports relativos com extensão `.ts`; proibido `enum`, `namespace` e *parameter properties*. `app/` e `components/` importam por `@/lib/<nome>`.
- Linhas do `node:sqlite` têm protótipo nulo: toda função que devolve dados para página ou cliente mapeia para objeto literal.
- Esquema só aditivo (`CREATE TABLE/INDEX IF NOT EXISTS`). Nada de `ALTER`/`DROP`.
- Toda mutação: `sameOrigin(request)` + `lerJson(request, limite)`. Recurso de outra empresa → 404. Sem sessão → 401. Papel errado → 403.
- O gestor só escreve no escopo da própria empresa; o admin escreve em modelos e no catálogo global.
- Limites do motor: 12 tarefas, 8 competências; catálogo total enviado ao motor ≤ 40 ações (20 globais + 20 da loja, ativas).
- Ações do catálogo não podem repetir eixo + ação (sem diferenciar maiúsculas) entre global e loja: o motor rejeita IDs duplicados.
- Ferramentas são texto livre (RNF05): categorias sugeridas são genéricas, sem marcas.
- Textos em pt-BR sem jargão; nenhum dado pessoal.
- Commits em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Aceitar todas com pouco espaço (já há 6 competências e a regra sugere 4).** Esperado: aceita 2 pela ordem de peso e avisa quais ficaram de fora. Teste na Task 1 (`aceitarSugestoes`).
2. **Gestor cria uma ação da loja com o mesmo texto de uma ação global.** Esperado: recusa com mensagem clara, em vez de quebrar a geração no Python. Teste na Task 5.
3. **Admin desativa um modelo enquanto o gestor está na tela de nova função.** Esperado: criar a partir dele responde 404 com mensagem, sem criar função vazia. Teste na Task 3 (`obterModelo` com `apenasAtivo`).
4. **Responder "Não" na pergunta 1 depois de já ter respondido as três.** Esperado: as respostas seguintes são apagadas e o nível vira N0. Teste na Task 2 (`responder`).
5. **Copiar uma função de outra empresa pelo id.** Esperado: 404. Teste na Task 3 (rota usa `obterFuncao` com `empresaId` da sessão).

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `web/lib/estrutura.ts` | (alterado) `sugestoes_ignoradas`, `copiarEstrutura`, `efeitoAutomatico` |
| `web/lib/regras.ts` | Sugestões R1–R4 e R7, aceitar e ignorar |
| `web/lib/niveis.ts` | Perguntas do Quadro 4, nível por respostas |
| `web/lib/seed-modelos.ts` | Conteúdo dos 5 modelos iniciais |
| `web/lib/modelos.ts` | Repositório de modelos e promoção de função |
| `web/lib/ferramentas.ts` | Ferramentas de IA da loja |
| `web/lib/catalogo.ts` | (alterado) ações registradas, criar, ativar/desativar |
| `web/lib/db.ts` | (alterado) tabelas `modelos_funcao` e `ferramentas_ia`, seed de modelos |
| `web_bridge.py`, `test_web_bridge.py` | Limite do catálogo 16 → 40 |
| `web/components/BotoesOpcao.tsx` | Botões segmentados acessíveis |
| `web/components/funcao/*` | Painel de sugestões, RF07, botões, ferramentas |
| `web/components/ocupante/PerguntasNivel.tsx` | Perguntas de nível por competência |
| `web/components/loja/*` | Nova função (modelo, copiar, branco, importar), ferramentas, ações |
| `web/components/admin/*` | Modelos e catálogo global |
| `web/app/...` | Páginas e rotas (lista em cada task) |

---
### Task 1: Regras de sugestão (RF05 e RF07)

**Files:**
- Modify: `web/lib/estrutura.ts` (campo opcional `sugestoes_ignoradas`)
- Create: `web/lib/regras.ts`
- Test: `web/lib/regras.test.ts`, `web/lib/estrutura.test.ts` (1 teste novo)

**Interfaces:**
- Consumes: `Estrutura`, `Tarefa`, `Competencia`, `PerdaCentralidade`, `LIMITES`, `novoId`, `validarEstrutura` (fase 1, `lib/estrutura.ts`); `PESOS` (fase 1, `lib/lacunas.ts`); `exemploAtendente`, `ID` (fase 1, `lib/apoio-testes.ts`).
- Produces:
  - `Estrutura` ganha `sugestoes_ignoradas?: string[]` (até 50 chaves de até 80 caracteres). `validarEstrutura` só inclui o campo quando ele vier preenchido.
  - `lib/regras.ts`:
    - `type SugestaoCompetencia = { chave: string; competencia: Competencia }`;
    - `type SugestaoPerda = { chave: string; perda: PerdaCentralidade }`;
    - `sugerir(e: Estrutura): { competencias: SugestaoCompetencia[]; perdem_centralidade: SugestaoPerda[] }`;
    - `aceitarSugestoes(e: Estrutura, chaves: string[]): { estrutura: Estrutura; recusadas: string[] }` (respeita `LIMITES.competencias`; `recusadas` traz os nomes que ficaram de fora);
    - `ignorarSugestao(e: Estrutura, chave: string): Estrutura`.

Regras (spec §8.2). Peso de uma tarefa = `PESOS[criticidade] + PESOS[frequencia]`; empate fica com a primeira da lista. Só entram tarefas com texto e efeito.

| Chave | Condição | Sugestão | Eixo | Alvo |
|---|---|---|---|---|
| `R1` | Tarefas N; se não houver, P; se não houver, A com criticidade Alta | "Letramento em IA" ligada à tarefa de maior peso do primeiro grupo não vazio | Letramento em IA | N2 |
| `R2:<ferramenta>` | Cada ferramenta distinta (minúsculas, espaços normalizados) em tarefas P; se não houver P, em tarefas N | "Proficiência em <ferramenta>" ligada à tarefa de maior peso que usa a ferramenta | Proficiência técnica | N2 |
| `R3` | Existe tarefa A | "Adaptabilidade a novos fluxos de trabalho" ligada à tarefa A de maior peso | Adaptabilidade | N2 |
| `R4:<tarefaId>` | Cada tarefa I com criticidade Alta | "Julgamento em: <tarefa>" | Relacionais e de julgamento | N3 |
| `R7:<tarefaId>` | Cada tarefa A | Perde centralidade: "Executar manualmente: <tarefa>" | — | — |

Omissões: competência já existente com mesmo eixo e mesma `tarefa_id`, ou com o mesmo nome normalizado; perda já existente para a mesma tarefa; chave presente em `sugestoes_ignoradas`. Ordem das competências sugeridas: peso da tarefa ligada (maior primeiro), depois R1, R2, R3, R4.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao fim de `web/lib/estrutura.test.ts`:

```ts
test('aceita sugestões ignoradas opcionais e valida o formato', () => {
  const e = completa();
  assert.equal('sugestoes_ignoradas' in validarEstrutura(e), false);
  assert.deepEqual(validarEstrutura({ ...e, sugestoes_ignoradas: ['R1', 'R3'] }).sugestoes_ignoradas, ['R1', 'R3']);
  assert.throws(() => validarEstrutura({ ...e, sugestoes_ignoradas: [1] }), /sugestões ignoradas/);
});
```

Crie `web/lib/regras.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exemploAtendente, ID } from './apoio-testes.ts';
import { novaCompetencia, type Estrutura } from './estrutura.ts';
import { aceitarSugestoes, ignorarSugestao, sugerir } from './regras.ts';

function semCompetencias(): Estrutura {
  return { ...exemploAtendente().estrutura, competencias: [] };
}
const resumo = (e: Estrutura) => sugerir(e).competencias.map(s => [s.chave, s.competencia.eixo, s.competencia.tarefa_id, s.competencia.alvo]);

test('reproduz as 4 competências da planilha de exemplo (eixo, tarefa e nível-alvo)', () => {
  assert.deepEqual(resumo(semCompetencias()), [
    ['R1', 'Letramento em IA', ID(4), 'N2'],
    ['R2:assistente de ia interno (catálogo)', 'Proficiência técnica', ID(2), 'N2'],
    ['R4:' + ID(3), 'Relacionais e de julgamento', ID(3), 'N3'],
    ['R3', 'Adaptabilidade', ID(1), 'N2'],
  ]);
  const [letramento] = sugerir(semCompetencias()).competencias;
  assert.equal(letramento.competencia.competencia, 'Letramento em IA');
  assert.equal(letramento.competencia.origem, 'regra');
  assert.match(letramento.competencia.motivo ?? '', /Revisar o orçamento gerado pela IA/);
});

test('com as competências da planilha não sugere nada repetido; só a perda de centralidade', () => {
  const { estrutura } = exemploAtendente();
  const s = sugerir(estrutura);
  assert.deepEqual(s.competencias, []);
  assert.deepEqual(s.perdem_centralidade.map(p => [p.chave, p.perda.descricao, p.perda.tarefa_id]), [['R7:' + ID(1), 'Executar manualmente: Consultar preço e estoque', ID(1)]]);
});

test('letramento cai para tarefa P quando não há tarefa nova; tarefa sem efeito é ignorada', () => {
  const e = semCompetencias();
  e.tarefas = e.tarefas.filter(t => t.efeito_ia !== 'N');
  e.tarefas.push({ ...e.tarefas[0], id: ID(9), tarefa: 'Tarefa sem classificação', efeito_ia: null });
  assert.deepEqual(resumo(e)[0], ['R1', 'Letramento em IA', ID(2), 'N2']);
  assert.equal(resumo(e).some(r => r[2] === ID(9)), false);
});

test('ignorar uma sugestão a remove da lista', () => {
  const e = ignorarSugestao(semCompetencias(), 'R3');
  assert.deepEqual(e.sugestoes_ignoradas, ['R3']);
  assert.equal(sugerir(e).competencias.some(s => s.chave === 'R3'), false);
  assert.deepEqual(ignorarSugestao(e, 'R3').sugestoes_ignoradas, ['R3']);
});

test('aceitar todas respeita o limite de 8 e avisa quais ficaram de fora', () => {
  const e = semCompetencias();
  // 6 competências de letramento ligadas a "Montar orçamento": nenhuma bloqueia as 4 sugestões da regra.
  e.competencias = Array.from({ length: 6 }, (_, i) => ({ ...novaCompetencia(ID(2)), competencia: `Outra ${i}` }));
  const chaves = sugerir(e).competencias.map(s => s.chave);
  const { estrutura, recusadas } = aceitarSugestoes(e, chaves);
  assert.equal(estrutura.competencias.length, 8);
  assert.equal(recusadas.length, chaves.length - 2);
  assert.ok(recusadas.every(n => typeof n === 'string' && n.length > 0));
});

test('aceitar inclui perda de centralidade e ignora chave desconhecida', () => {
  const { estrutura } = exemploAtendente();
  const { estrutura: nova, recusadas } = aceitarSugestoes(estrutura, ['R7:' + ID(1), 'R99']);
  assert.deepEqual(nova.perdem_centralidade.map(p => [p.tarefa_id, p.origem]), [[ID(1), 'regra']]);
  assert.deepEqual(recusadas, []);
  assert.deepEqual(sugerir(nova).perdem_centralidade, []);
});
```

Ordem esperada no primeiro teste: os pesos são Revisar (Alta + Diária = 6), Montar (6), Negociar (Alta + Semanal = 5) e Consultar (Média + Diária = 5). A ordenação é peso desc e, no empate, a ordem de regra R1, R2, R4, R3 (definida no Step 3): peso 6 → R1, R2; peso 5 → R4, R3.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `regras.ts` e falha no teste novo de `estrutura.test.ts` (campo removido pela validação).

- [ ] **Step 3: Implementar**

Em `web/lib/estrutura.ts`:
- no tipo `Estrutura`, acrescente `sugestoes_ignoradas?: string[]` depois de `salvaguardas`;
- no fim de `validarEstrutura`, troque `return { versao: 1, tarefas, competencias, perdem_centralidade, salvaguardas };` por:

```ts
  const resultado: Estrutura = { versao: 1, tarefas, competencias, perdem_centralidade, salvaguardas };
  if (e.sugestoes_ignoradas !== undefined) {
    resultado.sugestoes_ignoradas = lista(e.sugestoes_ignoradas, 'sugestões ignoradas', 50).map(v => texto(v, 'sugestões ignoradas', 80));
  }
  return resultado;
```

Crie `web/lib/regras.ts`. Desempate: peso da tarefa desc; em peso igual, ordem R1, R2, R4, R3 (tarefa nova, ferramenta, tarefa crítica sem IA e, por último, adaptação).

```ts
import { PESOS } from './lacunas.ts';
import { LIMITES, novoId, type Competencia, type Eixo, type Estrutura, type Nivel, type PerdaCentralidade, type Tarefa } from './estrutura.ts';

export type SugestaoCompetencia = { chave: string; competencia: Competencia };
export type SugestaoPerda = { chave: string; perda: PerdaCentralidade };

const ORDEM_REGRA: Record<string, number> = { R1: 0, R2: 1, R4: 2, R3: 3 };
const normalizar = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
const peso = (t: Tarefa) => PESOS[t.criticidade] + PESOS[t.frequencia];

function maisPesada(tarefas: Tarefa[]): Tarefa | undefined {
  return tarefas.reduce<Tarefa | undefined>((melhor, t) => (!melhor || peso(t) > peso(melhor) ? t : melhor), undefined);
}

function competencia(nome: string, eixo: Eixo, tarefa: Tarefa, alvo: Nivel, motivo: string): Competencia {
  return { id: novoId(), competencia: nome, eixo, tarefa_id: tarefa.id, alvo, origem: 'regra', motivo, editada: false };
}

export function sugerir(e: Estrutura): { competencias: SugestaoCompetencia[]; perdem_centralidade: SugestaoPerda[] } {
  const ignoradas = new Set(e.sugestoes_ignoradas ?? []);
  const tarefas = e.tarefas.filter(t => t.tarefa.trim() && t.efeito_ia);
  const com = (efeito: Tarefa['efeito_ia']) => tarefas.filter(t => t.efeito_ia === efeito);
  const candidatas: SugestaoCompetencia[] = [];

  const grupoLetramento = [com('N'), com('P'), com('A').filter(t => t.criticidade === 'Alta')].find(g => g.length);
  const alvoLetramento = grupoLetramento && maisPesada(grupoLetramento);
  if (alvoLetramento) {
    const motivos: Record<string, string> = {
      N: `A tarefa "${alvoLetramento.tarefa.trim()}" é nova por causa da IA: exige entender e conferir o que a ferramenta produz.`,
      P: `A IA passou a ajudar na tarefa "${alvoLetramento.tarefa.trim()}": é preciso saber avaliar o resultado.`,
      A: `A IA faz a tarefa crítica "${alvoLetramento.tarefa.trim()}": alguém precisa conferir o resultado.`,
    };
    candidatas.push({ chave: 'R1', competencia: competencia('Letramento em IA', 'Letramento em IA', alvoLetramento, 'N2', motivos[alvoLetramento.efeito_ia as string]) });
  }

  const comFerramenta = (com('P').some(t => t.ferramenta.trim()) ? com('P') : com('N')).filter(t => t.ferramenta.trim());
  const ferramentas = new Map<string, Tarefa[]>();
  for (const t of comFerramenta) ferramentas.set(normalizar(t.ferramenta), [...(ferramentas.get(normalizar(t.ferramenta)) ?? []), t]);
  for (const [chave, lista] of ferramentas) {
    const t = maisPesada(lista) as Tarefa;
    const nome = t.ferramenta.trim();
    candidatas.push({ chave: `R2:${chave}`, competencia: competencia(`Proficiência em ${nome}`, 'Proficiência técnica', t, 'N2', `A ferramenta "${nome}" passou a fazer parte da tarefa "${t.tarefa.trim()}".`) });
  }

  const automatizada = maisPesada(com('A'));
  if (automatizada) {
    candidatas.push({ chave: 'R3', competencia: competencia('Adaptabilidade a novos fluxos de trabalho', 'Adaptabilidade', automatizada, 'N2', `A IA passou a fazer a tarefa "${automatizada.tarefa.trim()}": o trabalho muda de forma e exige adaptação.`) });
  }

  for (const t of com('I').filter(t => t.criticidade === 'Alta')) {
    candidatas.push({ chave: `R4:${t.id}`, competencia: competencia(`Julgamento em: ${t.tarefa.trim()}`, 'Relacionais e de julgamento', t, 'N3', `A tarefa "${t.tarefa.trim()}" é crítica e continua dependendo do julgamento da pessoa.`) });
  }

  const nomes = new Set(e.competencias.map(c => normalizar(c.competencia)));
  const pares = new Set(e.competencias.map(c => `${c.eixo}|${c.tarefa_id}`));
  const pesoPorTarefa = new Map(tarefas.map(t => [t.id, peso(t)]));
  const competencias = candidatas
    .filter(s => !ignoradas.has(s.chave) && !nomes.has(normalizar(s.competencia.competencia)) && !pares.has(`${s.competencia.eixo}|${s.competencia.tarefa_id}`))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (pesoPorTarefa.get(b.s.competencia.tarefa_id) ?? 0) - (pesoPorTarefa.get(a.s.competencia.tarefa_id) ?? 0)
      || ORDEM_REGRA[a.s.chave.split(':')[0]] - ORDEM_REGRA[b.s.chave.split(':')[0]] || a.i - b.i)
    .map(x => x.s);

  const comPerda = new Set(e.perdem_centralidade.map(p => p.tarefa_id));
  const perdem_centralidade = com('A')
    .filter(t => !comPerda.has(t.id) && !ignoradas.has(`R7:${t.id}`))
    .map(t => ({ chave: `R7:${t.id}`, perda: { id: novoId(), descricao: `Executar manualmente: ${t.tarefa.trim()}`, tarefa_id: t.id, origem: 'regra' as const } }));

  return { competencias, perdem_centralidade };
}

export function aceitarSugestoes(e: Estrutura, chaves: string[]): { estrutura: Estrutura; recusadas: string[] } {
  const { competencias, perdem_centralidade } = sugerir(e);
  const pedidas = new Set(chaves);
  const novas = [...e.competencias];
  const recusadas: string[] = [];
  for (const s of competencias.filter(c => pedidas.has(c.chave))) {
    if (novas.length < LIMITES.competencias) novas.push(s.competencia);
    else recusadas.push(s.competencia.competencia);
  }
  const perdas = [...e.perdem_centralidade, ...perdem_centralidade.filter(p => pedidas.has(p.chave)).map(p => p.perda)];
  return { estrutura: { ...e, competencias: novas, perdem_centralidade: perdas }, recusadas };
}

export function ignorarSugestao(e: Estrutura, chave: string): Estrutura {
  const atuais = e.sugestoes_ignoradas ?? [];
  return atuais.includes(chave) ? e : { ...e, sugestoes_ignoradas: [...atuais, chave].slice(-50) };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd web && npm test`
Expected: PASS (todos os testes da fase 1 + 7 novos).

- [ ] **Step 5: Commit**

```bash
git add web/lib/estrutura.ts web/lib/estrutura.test.ts web/lib/regras.ts web/lib/regras.test.ts
git commit -m "Sugere competencias e perda de centralidade a partir das tarefas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Nível atual por perguntas (Quadro 4 do PBL3)

**Files:**
- Create: `web/lib/niveis.ts`
- Test: `web/lib/niveis.test.ts`

**Interfaces:**
- Consumes: `Eixo`, `Nivel` (fase 1, `lib/estrutura.ts`).
- Produces (`lib/niveis.ts`):
  - `type Respostas = (boolean | null)[]` (sempre 3 posições);
  - `DESCRICAO_NIVEL: Record<Nivel, string>` (texto observável do Quadro 4);
  - `perguntasDoEixo(eixo: Eixo): [string, string, string]`;
  - `nivelPorRespostas(r: Respostas): Nivel | null` — `[false,…]` → N0; `[true,false,…]` → N1; `[true,true,false]` → N2; `[true,true,true]` → N3; incompleto → `null`;
  - `perguntasVisiveis(r: Respostas): number` — 1 + quantidade de "sim" seguidos, no máximo 3; para no primeiro "não" ou vazio;
  - `responder(r: Respostas, indice: number, valor: boolean): Respostas` — grava a resposta e apaga as seguintes.

Perguntas (spec §8.3):

| Pergunta | "Não" leva a | Letramento em IA / Proficiência técnica | Adaptabilidade / Relacionais e de julgamento |
|---|---|---|---|
| 1 | N0 | Usa a ferramenta nesta tarefa? | Já realiza esta tarefa no dia a dia? |
| 2 | N1 | Usa sem instruções prontas e sem ajuda na maior parte das vezes? | Resolve sem ajuda na maior parte das situações? |
| 3 | N2 (sim → N3) | Percebe erros da ferramenta, decide quando não usar e conseguiria ensinar um colega? | Avalia a própria decisão, reconhece quando chamar o gestor e conseguiria orientar um colega? |

- [ ] **Step 1: Escrever os testes que falham**

Crie `web/lib/niveis.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESCRICAO_NIVEL, nivelPorRespostas, perguntasDoEixo, perguntasVisiveis, responder } from './niveis.ts';

test('respostas viram nível do Quadro 4', () => {
  assert.equal(nivelPorRespostas([false, null, null]), 'N0');
  assert.equal(nivelPorRespostas([true, false, null]), 'N1');
  assert.equal(nivelPorRespostas([true, true, false]), 'N2');
  assert.equal(nivelPorRespostas([true, true, true]), 'N3');
  assert.equal(nivelPorRespostas([true, null, null]), null);
  assert.equal(nivelPorRespostas([null, null, null]), null);
});

test('mostra a próxima pergunta só depois de um sim', () => {
  assert.equal(perguntasVisiveis([null, null, null]), 1);
  assert.equal(perguntasVisiveis([false, null, null]), 1);
  assert.equal(perguntasVisiveis([true, null, null]), 2);
  assert.equal(perguntasVisiveis([true, true, false]), 3);
  assert.equal(perguntasVisiveis([true, true, true]), 3);
});

test('mudar uma resposta apaga as seguintes', () => {
  assert.deepEqual(responder([true, true, true], 0, false), [false, null, null]);
  assert.deepEqual(responder([true, false, null], 1, true), [true, true, null]);
  assert.deepEqual(responder([null, null, null], 0, true), [true, null, null]);
});

test('perguntas mudam conforme o eixo e cada nível tem descrição', () => {
  assert.match(perguntasDoEixo('Letramento em IA')[0], /ferramenta/);
  assert.match(perguntasDoEixo('Proficiência técnica')[0], /ferramenta/);
  assert.match(perguntasDoEixo('Relacionais e de julgamento')[0], /dia a dia/);
  assert.match(perguntasDoEixo('Adaptabilidade')[2], /gestor/);
  assert.deepEqual(Object.keys(DESCRICAO_NIVEL), ['N0', 'N1', 'N2', 'N3']);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `niveis.ts`.

- [ ] **Step 3: Implementar `web/lib/niveis.ts`**

```ts
import type { Eixo, Nivel } from './estrutura.ts';

export type Respostas = (boolean | null)[];

/** Descrições observáveis do Quadro 4 do PBL3. */
export const DESCRICAO_NIVEL: Record<Nivel, string> = {
  N0: 'Não usa a ferramenta na tarefa; a competência ainda não é exigida.',
  N1: 'Executa seguindo instruções prontas e depende de apoio diante de variações.',
  N2: 'Faz sem apoio na maior parte das situações e reconhece quando o resultado não serve.',
  N3: 'Avalia erros e limites, decide quando não usar e consegue orientar um colega.',
};

const FERRAMENTA: [string, string, string] = [
  'Usa a ferramenta nesta tarefa?',
  'Usa sem instruções prontas e sem ajuda na maior parte das vezes?',
  'Percebe erros da ferramenta, decide quando não usar e conseguiria ensinar um colega?',
];
const PRATICA: [string, string, string] = [
  'Já realiza esta tarefa no dia a dia?',
  'Resolve sem ajuda na maior parte das situações?',
  'Avalia a própria decisão, reconhece quando chamar o gestor e conseguiria orientar um colega?',
];

export const perguntasDoEixo = (eixo: Eixo): [string, string, string] =>
  (eixo === 'Letramento em IA' || eixo === 'Proficiência técnica' ? FERRAMENTA : PRATICA);

export function nivelPorRespostas(r: Respostas): Nivel | null {
  for (let i = 0; i < 3; i++) {
    if (r[i] === false) return (['N0', 'N1', 'N2'] as const)[i];
    if (r[i] !== true) return null;
  }
  return 'N3';
}

export function perguntasVisiveis(r: Respostas): number {
  let visiveis = 1;
  while (visiveis < 3 && r[visiveis - 1] === true) visiveis++;
  return visiveis;
}

export function responder(r: Respostas, indice: number, valor: boolean): Respostas {
  return [0, 1, 2].map(i => (i < indice ? r[i] ?? null : i === indice ? valor : null));
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd web && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/niveis.ts web/lib/niveis.test.ts
git commit -m "Calcula o nivel atual a partir de perguntas observaveis" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Modelos de cargo, cópia de função e criação a partir deles

**Files:**
- Modify: `web/lib/estrutura.ts` (`copiarEstrutura`)
- Create: `web/lib/seed-modelos.ts`, `web/lib/modelos.ts`
- Modify: `web/lib/db.ts` (tabela `modelos_funcao` e seed)
- Create: `web/lib/nova-funcao.ts` (`criarFuncaoAPartirDe`)
- Modify: `web/app/api/funcoes/route.ts`
- Create: `web/app/api/admin/modelos/route.ts`, `web/app/api/admin/modelos/[id]/route.ts`
- Test: `web/lib/modelos.test.ts`, `web/lib/nova-funcao.test.ts`, `web/lib/estrutura.test.ts` (1 teste)

**Interfaces:**
- Consumes: `estruturaVazia`, `novoId`, `validarEstrutura`, tipos (fase 1); `obterFuncao`, `criarFuncao`, `estruturaValida`, `validarNomeFuncao` (fase 1, `lib/funcoes.ts`); `HttpErro`, `errorResponse`, `lerJson`, `sameOrigin`; `exigirGestor`, `exigirUsuario`.
- Produces:
  - `lib/estrutura.ts`: `copiarEstrutura(e: Estrutura, origem: 'modelo' | 'copia', manterSalvaguardas: boolean): Estrutura` — IDs novos (tarefas remapeadas nas competências e perdas), `origem` aplicada a tarefas e competências, `editada=false`; sem `sugestoes_ignoradas`; salvaguardas copiadas ou zeradas ("Não sei").
  - `lib/seed-modelos.ts`: `type ModeloBase`, `MODELOS_BASE: ModeloBase[]` (5 itens), `estruturaDoModelo(m: ModeloBase): Estrutura`.
  - `lib/modelos.ts`:
    - `type Modelo = { id: string; nome: string; descricao: string; estrutura: Estrutura; ativo: boolean; atualizadoEm: string }`;
    - `type ResumoModelo = { id: string; nome: string; descricao: string; tarefas: number; competencias: number; ativo: boolean }`;
    - `semearModelos(db): void` (só quando a tabela está vazia; chamada no início de listar, obter e criar);
    - `listarModelos(db, incluirInativos: boolean): ResumoModelo[]`;
    - `obterModelo(db, id: string, apenasAtivo: boolean): Modelo` (404 se não existir ou, com `apenasAtivo`, se estiver desativado);
    - `criarModelo(db, dados: { nome: unknown; descricao: unknown; estrutura: unknown }): string`;
    - `salvarModelo(db, id, dados: { nome: unknown; descricao: unknown; estrutura: unknown }): void`;
    - `definirModeloAtivo(db, id, ativo: boolean): void`;
    - `promoverFuncao(db, funcaoId: string): string`.
  - `lib/nova-funcao.ts`: `criarFuncaoAPartirDe(db, empresaId: string, dados: { nome?: unknown; modeloId?: unknown; copiarDe?: unknown }): string`.
  - `POST /api/funcoes` aceita `{ nome }`, `{ modeloId, nome? }` ou `{ copiarDe, nome? }`.
  - `POST /api/admin/modelos` com `{ nome }` (modelo em branco) ou `{ funcaoId }` (promover) → 201 `{ id }`; `PUT /api/admin/modelos/[id]` com `{ nome, descricao, estrutura }`; `PATCH /api/admin/modelos/[id]` com `{ ativo }`.

O conteúdo dos modelos Operador(a) de caixa, Vendedor(a) de loja, Estoquista/Repositor e Atendimento online/WhatsApp é **proposta da equipe e precisa ser revisado pelo grupo** (spec §8.1, §16). A descrição de cada um diz isso.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao fim de `web/lib/estrutura.test.ts` (ajuste o import da primeira linha para incluir `copiarEstrutura`):

```ts
test('copia a estrutura com IDs novos e origem marcada', () => {
  const e = completa();
  e.salvaguardas[0] = { ...e.salvaguardas[0], resposta: 'Sim' };
  e.sugestoes_ignoradas = ['R1'];
  e.tarefas[0].editada = true;
  const c = copiarEstrutura(e, 'modelo', false);
  assert.notEqual(c.tarefas[0].id, e.tarefas[0].id);
  assert.equal(c.competencias[0].tarefa_id, c.tarefas[0].id);
  assert.deepEqual([c.tarefas[0].origem, c.tarefas[0].editada, c.competencias[0].origem], ['modelo', false, 'modelo']);
  assert.equal(c.salvaguardas[0].resposta, 'Não sei');
  assert.equal('sugestoes_ignoradas' in c, false);
  assert.equal(copiarEstrutura(e, 'copia', true).salvaguardas[0].resposta, 'Sim');
  assert.deepEqual(validarEstrutura(c), c);
});
```

Crie `web/lib/modelos.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, exemploAtendente, inserirEmpresa } from './apoio-testes.ts';
import { validarEstrutura } from './estrutura.ts';
import { criarFuncao } from './funcoes.ts';
import { criarModelo, definirModeloAtivo, listarModelos, obterModelo, promoverFuncao, salvarModelo, semearModelos } from './modelos.ts';

test('semeia os 5 modelos uma única vez, todos com estrutura válida', () => {
  const db = bancoDeTeste();
  semearModelos(db);
  const lista = listarModelos(db, false);
  assert.deepEqual(lista.map(m => m.nome), ['Atendente de balcão', 'Atendimento online/WhatsApp', 'Estoquista/Repositor', 'Operador(a) de caixa', 'Vendedor(a) de loja']);
  for (const m of lista) {
    const e = obterModelo(db, m.id, true).estrutura;
    assert.deepEqual(validarEstrutura(e), e);
    assert.ok(e.tarefas.length >= 4 && e.competencias.length >= 3);
    assert.ok(e.competencias.every(c => e.tarefas.some(t => t.id === c.tarefa_id)));
  }
  assert.equal(lista.find(m => m.nome === 'Atendente de balcão')?.competencias, 4);
  assert.equal(Object.getPrototypeOf(lista[0]), Object.prototype);
});

test('modelo desativado some para o gestor e responde 404 ao ser usado', () => {
  const db = bancoDeTeste();
  const [m] = listarModelos(db, false);
  definirModeloAtivo(db, m.id, false);
  assert.equal(listarModelos(db, false).some(x => x.id === m.id), false);
  assert.equal(listarModelos(db, true).find(x => x.id === m.id)?.ativo, false);
  assert.throws(() => obterModelo(db, m.id, true), { status: 404 });
  assert.equal(obterModelo(db, m.id, false).id, m.id);
});

test('cria modelo em branco e salva com validação', () => {
  const db = bancoDeTeste();
  const id = criarModelo(db, { nome: 'Caixa rápido', descricao: '', estrutura: undefined });
  const m = obterModelo(db, id, true);
  assert.deepEqual([m.nome, m.estrutura.tarefas.length], ['Caixa rápido', 1]);
  assert.throws(() => salvarModelo(db, id, { nome: '', descricao: '', estrutura: m.estrutura }), { status: 400 });
  assert.throws(() => salvarModelo(db, id, { nome: 'X', descricao: '', estrutura: { versao: 1 } }), { status: 400 });
  salvarModelo(db, id, { nome: 'Caixa expresso', descricao: 'Para lojas pequenas', estrutura: m.estrutura });
  assert.deepEqual([obterModelo(db, id, true).nome, obterModelo(db, id, true).descricao], ['Caixa expresso', 'Para lojas pequenas']);
});

test('promove função a modelo sem salvaguardas nem dados da empresa', () => {
  const db = bancoDeTeste();
  const empresa = inserirEmpresa(db);
  const { nome, estrutura } = exemploAtendente();
  const funcaoId = criarFuncao(db, empresa, { nome, estrutura, origem: 'planilha' });
  const m = obterModelo(db, promoverFuncao(db, funcaoId), true);
  assert.equal(m.nome, 'Atendente de balcão');
  assert.deepEqual(m.estrutura.tarefas.map(t => t.tarefa), estrutura.tarefas.map(t => t.tarefa));
  assert.ok(m.estrutura.salvaguardas.every(s => s.resposta === 'Não sei' && !s.observacao && !s.ajuste));
  assert.notEqual(m.estrutura.tarefas[0].id, estrutura.tarefas[0].id);
  assert.throws(() => promoverFuncao(db, crypto.randomUUID()), { status: 404 });
});
```

Crie `web/lib/nova-funcao.test.ts` (imports no Step 7) com:

```ts
test('cria função a partir de modelo, de cópia da própria loja ou em branco', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const modelo = listarModelos(db, false).find(m => m.nome === 'Operador(a) de caixa');
  assert.ok(modelo);
  const doModelo = obterFuncao(db, a, criarFuncaoAPartirDe(db, a, { modeloId: modelo.id }));
  assert.deepEqual([doModelo.nome, doModelo.origem, doModelo.estrutura.tarefas[0].origem], ['Operador(a) de caixa', `modelo:${modelo.id}`, 'modelo']);
  const { estrutura } = exemploAtendente();
  const original = criarFuncao(db, a, { nome: 'Atendente', estrutura, origem: 'planilha' });
  const copia = obterFuncao(db, a, criarFuncaoAPartirDe(db, a, { copiarDe: original }));
  assert.deepEqual([copia.nome, copia.origem, copia.estrutura.salvaguardas[2].resposta], ['Atendente (cópia)', `copia:${original}`, 'Não']);
  assert.throws(() => criarFuncaoAPartirDe(db, b, { copiarDe: original }), { status: 404 });
  assert.equal(obterFuncao(db, b, criarFuncaoAPartirDe(db, b, { nome: 'Nova' })).origem, 'branco');
  assert.throws(() => criarFuncaoAPartirDe(db, b, { nome: ' ' }), { status: 400 });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `modelos.ts` e `nova-funcao.ts`, e `copiarEstrutura` não exportado.

- [ ] **Step 3: Implementar `copiarEstrutura` em `web/lib/estrutura.ts`**

Acrescente no fim do arquivo:

```ts
/** Cópia para nova função ou modelo: IDs novos, origem marcada e nada de sugestões ignoradas. */
export function copiarEstrutura(e: Estrutura, origem: 'modelo' | 'copia', manterSalvaguardas: boolean): Estrutura {
  const ids = new Map(e.tarefas.map(t => [t.id, novoId()]));
  const tarefa = (id: string) => ids.get(id) ?? '';
  return {
    versao: 1,
    tarefas: e.tarefas.map(t => ({ ...t, id: tarefa(t.id), origem, editada: false })),
    competencias: e.competencias.map(c => ({ ...c, id: novoId(), tarefa_id: tarefa(c.tarefa_id), origem, editada: false })),
    perdem_centralidade: e.perdem_centralidade.map(p => ({ ...p, id: novoId(), tarefa_id: tarefa(p.tarefa_id) })),
    salvaguardas: manterSalvaguardas ? e.salvaguardas.map(s => ({ ...s })) : estruturaVazia().salvaguardas,
  };
}
```

- [ ] **Step 4: Criar `web/lib/seed-modelos.ts`**

```ts
import { novoId, type Criticidade, type Efeito, type Eixo, type Estrutura, type Frequencia, type Nivel, estruturaVazia } from './estrutura.ts';

type TarefaBase = [tarefa: string, frequencia: Frequencia, criticidade: Criticidade, ferramenta: string, efeito: Efeito];
type CompetenciaBase = [nome: string, eixo: Eixo, indiceTarefa: number, alvo: Nivel];
export type ModeloBase = { nome: string; descricao: string; tarefas: TarefaBase[]; competencias: CompetenciaBase[] };

const PROPOSTA = 'Conteúdo proposto pela equipe da pesquisa; revise as tarefas e ferramentas da sua loja.';

export const MODELOS_BASE: ModeloBase[] = [
  {
    nome: 'Atendente de balcão',
    descricao: 'Exemplo preenchido da planilha MRCC-PV (loja de material de construção).',
    tarefas: [
      ['Consultar preço e estoque', 'Diária', 'Média', 'Assistente de IA interno (catálogo)', 'A'],
      ['Montar orçamento para o cliente', 'Diária', 'Alta', 'Assistente de IA interno (catálogo)', 'P'],
      ['Negociar prazo com cliente insatisfeito', 'Semanal', 'Alta', '', 'I'],
      ['Revisar o orçamento gerado pela IA', 'Diária', 'Alta', 'Assistente de IA interno (catálogo)', 'N'],
    ],
    competencias: [
      ['Letramento em IA', 'Letramento em IA', 3, 'N2'],
      ['Proficiência na ferramenta de orçamento', 'Proficiência técnica', 1, 'N2'],
      ['Adaptabilidade a novos fluxos de trabalho', 'Adaptabilidade', 0, 'N2'],
      ['Julgamento em situação de atendimento difícil', 'Relacionais e de julgamento', 2, 'N3'],
    ],
  },
  {
    nome: 'Operador(a) de caixa',
    descricao: PROPOSTA,
    tarefas: [
      ['Registrar produtos e receber pagamentos', 'Diária', 'Alta', '', 'I'],
      ['Conferir preço divergente da etiqueta', 'Diária', 'Média', 'Recurso de IA do sistema de vendas', 'P'],
      ['Fechar o caixa e conferir os valores', 'Diária', 'Alta', 'Recurso de IA do sistema de vendas', 'A'],
      ['Revisar o relatório de fechamento gerado pelo sistema', 'Diária', 'Alta', 'Recurso de IA do sistema de vendas', 'N'],
      ['Atender cliente com reclamação no caixa', 'Semanal', 'Alta', '', 'I'],
    ],
    competencias: [
      ['Letramento em IA', 'Letramento em IA', 3, 'N2'],
      ['Proficiência no sistema de vendas', 'Proficiência técnica', 1, 'N2'],
      ['Adaptabilidade ao fechamento automático', 'Adaptabilidade', 2, 'N2'],
      ['Julgamento em reclamações no caixa', 'Relacionais e de julgamento', 4, 'N3'],
    ],
  },
  {
    nome: 'Vendedor(a) de loja',
    descricao: PROPOSTA,
    tarefas: [
      ['Atender e orientar o cliente na escolha do produto', 'Diária', 'Alta', '', 'I'],
      ['Consultar disponibilidade e características do produto', 'Diária', 'Média', 'Assistente de conversa com IA', 'P'],
      ['Responder mensagens de clientes com textos sugeridos pela IA', 'Diária', 'Média', 'Assistente de conversa com IA', 'P'],
      ['Revisar descrições e ofertas geradas pela IA antes de enviar', 'Semanal', 'Alta', 'Assistente de conversa com IA', 'N'],
      ['Negociar condições de pagamento', 'Semanal', 'Alta', '', 'I'],
    ],
    competencias: [
      ['Letramento em IA', 'Letramento em IA', 3, 'N2'],
      ['Proficiência no assistente de conversa', 'Proficiência técnica', 2, 'N2'],
      ['Julgamento na orientação ao cliente', 'Relacionais e de julgamento', 0, 'N3'],
      ['Julgamento na negociação', 'Relacionais e de julgamento', 4, 'N3'],
    ],
  },
  {
    nome: 'Estoquista/Repositor',
    descricao: PROPOSTA,
    tarefas: [
      ['Receber e conferir mercadorias', 'Diária', 'Alta', 'Recurso de IA do sistema de estoque', 'P'],
      ['Contar o estoque e registrar diferenças', 'Semanal', 'Média', 'Recurso de IA do sistema de estoque', 'A'],
      ['Repor as gôndolas conforme a lista sugerida pelo sistema', 'Diária', 'Média', 'Recurso de IA do sistema de estoque', 'P'],
      ['Conferir a sugestão de compra gerada pelo sistema', 'Semanal', 'Alta', 'Recurso de IA do sistema de estoque', 'N'],
      ['Organizar o depósito e separar avarias', 'Semanal', 'Baixa', '', 'I'],
    ],
    competencias: [
      ['Letramento em IA', 'Letramento em IA', 3, 'N2'],
      ['Proficiência no sistema de estoque', 'Proficiência técnica', 0, 'N2'],
      ['Adaptabilidade à contagem automática', 'Adaptabilidade', 1, 'N2'],
    ],
  },
  {
    nome: 'Atendimento online/WhatsApp',
    descricao: PROPOSTA,
    tarefas: [
      ['Responder dúvidas de clientes por mensagem', 'Diária', 'Alta', 'Assistente de conversa com IA', 'P'],
      ['Enviar orçamentos e fotos de produtos', 'Diária', 'Média', '', 'I'],
      ['Acompanhar as respostas automáticas fora do horário', 'Diária', 'Média', 'Atendimento automático por mensagem', 'A'],
      ['Revisar respostas sugeridas pela IA antes de enviar', 'Diária', 'Alta', 'Assistente de conversa com IA', 'N'],
      ['Resolver reclamações por mensagem', 'Semanal', 'Alta', '', 'I'],
    ],
    competencias: [
      ['Letramento em IA', 'Letramento em IA', 3, 'N2'],
      ['Proficiência no assistente de conversa', 'Proficiência técnica', 0, 'N2'],
      ['Adaptabilidade ao atendimento automático', 'Adaptabilidade', 2, 'N2'],
      ['Julgamento em reclamações por mensagem', 'Relacionais e de julgamento', 4, 'N3'],
    ],
  },
];

export function estruturaDoModelo(m: ModeloBase): Estrutura {
  const tarefas = m.tarefas.map(([tarefa, frequencia, criticidade, ferramenta, efeito_ia]) => ({
    id: novoId(), tarefa, frequencia, criticidade, ferramenta, efeito_ia, origem: 'modelo' as const, editada: false,
  }));
  const competencias = m.competencias.map(([competencia, eixo, indice, alvo]) => ({
    id: novoId(), competencia, eixo, tarefa_id: tarefas[indice].id, alvo, origem: 'modelo' as const, editada: false,
  }));
  return { ...estruturaVazia(), tarefas, competencias };
}
```

- [ ] **Step 5: Criar `web/lib/modelos.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';
import { transacao } from './db.ts';
import { copiarEstrutura, estruturaVazia, type Estrutura } from './estrutura.ts';
import { estruturaValida, obterFuncao, validarNomeFuncao } from './funcoes.ts';
import { HttpErro } from './http.ts';
import { MODELOS_BASE, estruturaDoModelo } from './seed-modelos.ts';

export type Modelo = { id: string; nome: string; descricao: string; estrutura: Estrutura; ativo: boolean; atualizadoEm: string };
export type ResumoModelo = { id: string; nome: string; descricao: string; tarefas: number; competencias: number; ativo: boolean };
type Linha = { id: string; nome: string; descricao: string; estrutura: string; ativo: number; atualizado_em: string };

function descricaoValida(v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string' || v.trim().length > 300) throw new HttpErro(400, 'A descrição pode ter até 300 caracteres.');
  return v.trim();
}

export function semearModelos(db: DatabaseSync): void {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM modelos_funcao').get() as { n: number };
  if (Number(n) > 0) return;
  const agora = new Date().toISOString();
  const inserir = db.prepare('INSERT INTO modelos_funcao (id, nome, descricao, estrutura, ativo, atualizado_em) VALUES (?, ?, ?, ?, 1, ?)');
  transacao(db, () => {
    for (const m of MODELOS_BASE) inserir.run(crypto.randomUUID(), m.nome, m.descricao, JSON.stringify(estruturaDoModelo(m)), agora);
  });
}

export function listarModelos(db: DatabaseSync, incluirInativos: boolean): ResumoModelo[] {
  semearModelos(db);
  const linhas = db.prepare(`SELECT id, nome, descricao, estrutura, ativo FROM modelos_funcao ${incluirInativos ? '' : 'WHERE ativo = 1'} ORDER BY nome COLLATE NOCASE`).all() as Linha[];
  return linhas.map(l => {
    const e = JSON.parse(l.estrutura) as Estrutura;
    return { id: l.id, nome: l.nome, descricao: l.descricao, tarefas: e.tarefas.length, competencias: e.competencias.length, ativo: Number(l.ativo) === 1 };
  });
}

export function obterModelo(db: DatabaseSync, id: string, apenasAtivo: boolean): Modelo {
  semearModelos(db);
  const l = db.prepare('SELECT id, nome, descricao, estrutura, ativo, atualizado_em FROM modelos_funcao WHERE id = ?').get(id) as Linha | undefined;
  if (!l || (apenasAtivo && Number(l.ativo) !== 1)) throw new HttpErro(404, 'Modelo não encontrado ou desativado.');
  return { id: l.id, nome: l.nome, descricao: l.descricao, estrutura: JSON.parse(l.estrutura) as Estrutura, ativo: Number(l.ativo) === 1, atualizadoEm: l.atualizado_em };
}

export function criarModelo(db: DatabaseSync, dados: { nome: unknown; descricao: unknown; estrutura: unknown }): string {
  semearModelos(db);
  const id = crypto.randomUUID();
  const estrutura = dados.estrutura === undefined ? estruturaVazia() : estruturaValida(dados.estrutura);
  db.prepare('INSERT INTO modelos_funcao (id, nome, descricao, estrutura, ativo, atualizado_em) VALUES (?, ?, ?, ?, 1, ?)')
    .run(id, validarNomeFuncao(dados.nome), descricaoValida(dados.descricao), JSON.stringify(estrutura), new Date().toISOString());
  return id;
}

export function salvarModelo(db: DatabaseSync, id: string, dados: { nome: unknown; descricao: unknown; estrutura: unknown }): void {
  obterModelo(db, id, false);
  const nome = validarNomeFuncao(dados.nome);
  const descricao = descricaoValida(dados.descricao);
  const estrutura = estruturaValida(dados.estrutura);
  db.prepare('UPDATE modelos_funcao SET nome = ?, descricao = ?, estrutura = ?, atualizado_em = ? WHERE id = ?')
    .run(nome, descricao, JSON.stringify(estrutura), new Date().toISOString(), id);
}

export function definirModeloAtivo(db: DatabaseSync, id: string, ativo: boolean): void {
  obterModelo(db, id, false);
  db.prepare('UPDATE modelos_funcao SET ativo = ?, atualizado_em = ? WHERE id = ?').run(ativo ? 1 : 0, new Date().toISOString(), id);
}

export function promoverFuncao(db: DatabaseSync, funcaoId: string): string {
  const funcao = obterFuncao(db, null, funcaoId);
  return criarModelo(db, { nome: funcao.nome, descricao: 'Criado a partir de uma função cadastrada; revise antes de oferecer às lojas.', estrutura: copiarEstrutura(funcao.estrutura, 'modelo', false) });
}
```

- [ ] **Step 6: Tabela em `web/lib/db.ts` e semeadura sob demanda**

Acrescente ao fim da constante `ESQUEMA` em `web/lib/db.ts` (antes da crase de fechamento):

```sql
CREATE TABLE IF NOT EXISTS modelos_funcao (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '', estrutura TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1, atualizado_em TEXT NOT NULL);
```

A semeadura não fica em `prepararBanco` (que não pode importar `modelos.ts` sem criar um ciclo). O código do Step 5 já chama `semearModelos(db);` na primeira linha de `listarModelos`, `obterModelo` e `criarModelo`. Custo: um `COUNT(*)` por chamada. Assim, o primeiro uso por gestor ou admin cria os 5 modelos, e um modelo criado pelo admin nunca impede a semeadura (ela roda antes).

- [ ] **Step 7: Criar `web/lib/nova-funcao.ts`**

Módulo separado para não criar ciclo entre `funcoes.ts` e `modelos.ts`.

```ts
import type { DatabaseSync } from 'node:sqlite';
import { copiarEstrutura, estruturaVazia } from './estrutura.ts';
import { criarFuncao, obterFuncao } from './funcoes.ts';
import { obterModelo } from './modelos.ts';

/** Nova função em branco, a partir de um modelo ativo ou como cópia de uma função da própria loja. */
export function criarFuncaoAPartirDe(db: DatabaseSync, empresaId: string, dados: { nome?: unknown; modeloId?: unknown; copiarDe?: unknown }): string {
  const nomeInformado = typeof dados.nome === 'string' && dados.nome.trim() ? dados.nome : undefined;
  if (typeof dados.modeloId === 'string') {
    const modelo = obterModelo(db, dados.modeloId, true);
    return criarFuncao(db, empresaId, { nome: nomeInformado ?? modelo.nome, estrutura: copiarEstrutura(modelo.estrutura, 'modelo', false), origem: `modelo:${modelo.id}` });
  }
  if (typeof dados.copiarDe === 'string') {
    const original = obterFuncao(db, empresaId, dados.copiarDe);
    return criarFuncao(db, empresaId, { nome: nomeInformado ?? `${original.nome} (cópia)`.slice(0, 120), estrutura: copiarEstrutura(original.estrutura, 'copia', true), origem: `copia:${original.id}` });
  }
  return criarFuncao(db, empresaId, { nome: dados.nome, estrutura: estruturaVazia(), origem: 'branco' });
}
```

O teste do Step 1 que estava em `funcoes.test.ts` vai para `web/lib/nova-funcao.test.ts`, com estes imports:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, exemploAtendente, inserirEmpresa } from './apoio-testes.ts';
import { criarFuncao, obterFuncao } from './funcoes.ts';
import { listarModelos } from './modelos.ts';
import { criarFuncaoAPartirDe } from './nova-funcao.ts';
```

- [ ] **Step 8: Rotas**

Substitua `web/app/api/funcoes/route.ts` inteiro:

```ts
import { db } from '@/lib/db';
import { criarFuncaoAPartirDe } from '@/lib/nova-funcao';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const corpo = await lerJson(request, 2000);
    const id = criarFuncaoAPartirDe(db(), gestor.empresaId, { nome: corpo.nome, modeloId: corpo.modeloId, copiarDe: corpo.copiarDe });
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

Crie `web/app/api/admin/modelos/route.ts`:

```ts
import { db } from '@/lib/db';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { criarModelo, promoverFuncao } from '@/lib/modelos';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await exigirUsuario({ papel: 'admin' });
    const corpo = await lerJson(request, 2000);
    const id = typeof corpo.funcaoId === 'string' ? promoverFuncao(db(), corpo.funcaoId) : criarModelo(db(), { nome: corpo.nome, descricao: corpo.descricao, estrutura: undefined });
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

Crie `web/app/api/admin/modelos/[id]/route.ts`:

```ts
import { db } from '@/lib/db';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { definirModeloAtivo, salvarModelo } from '@/lib/modelos';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';
type Contexto = { params: Promise<{ id: string }> };

export async function PUT(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    await exigirUsuario({ papel: 'admin' });
    const corpo = await lerJson(request);
    salvarModelo(db(), (await contexto.params).id, { nome: corpo.nome, descricao: corpo.descricao, estrutura: corpo.estrutura });
    return Response.json({ salvo: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: Request, contexto: Contexto) {
  try {
    sameOrigin(request);
    await exigirUsuario({ papel: 'admin' });
    const { ativo } = await lerJson(request, 500);
    if (typeof ativo !== 'boolean') throw new HttpErro(400, 'Solicitação inválida.');
    definirModeloAtivo(db(), (await contexto.params).id, ativo);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 9: Rodar testes e tipos**

Run: `cd web && npm test && npx tsc --noEmit`
Expected: PASS e nenhum erro de tipo.

- [ ] **Step 10: Commit**

```bash
git add web/lib/estrutura.ts web/lib/estrutura.test.ts web/lib/seed-modelos.ts web/lib/modelos.ts web/lib/modelos.test.ts web/lib/db.ts web/lib/nova-funcao.ts web/lib/nova-funcao.test.ts web/app/api/funcoes/route.ts web/app/api/admin/modelos
git commit -m "Adiciona modelos de cargo e criacao de funcao por modelo ou copia" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Catálogo global e ações da loja

**Files:**
- Modify: `web/lib/catalogo.ts`
- Test: `web/lib/catalogo.test.ts` (testes novos)
- Modify: `web_bridge.py` (limite 16 → 40), `test_web_bridge.py` (teste novo)
- Create: `web/app/api/acoes/route.ts`, `web/app/api/acoes/[id]/route.ts`
- Create: `web/components/acoes/GerenciarAcoes.tsx`
- Create: `web/app/(loja)/acoes/page.tsx`, `web/app/admin/catalogo/page.tsx`

**Interfaces:**
- Consumes: `EIXOS` (fase 1); `CATALOGO_BASE`, `type AcaoCatalogo` (fase 1, `lib/seed.ts`); `HttpErro`, `errorResponse`, `lerJson`, `sameOrigin`; `exigirUsuario`, `exigirPagina`, `exigirPaginaGestor`; `chamarApi`, `Campo`, `Selecao`.
- Produces (`lib/catalogo.ts`):
  - `EIXOS_CATALOGO` (4 eixos + `'Geral'`), `LIMITE_ACOES = 20`;
  - `type AcaoRegistrada = AcaoCatalogo & { id: string; ativa: boolean }`;
  - `listarAcoes(db, escopo: string | null): AcaoRegistrada[]` (`null` = catálogo global; texto = ações da empresa);
  - `criarAcao(db, escopo: string | null, dados: Record<string, unknown>): string`;
  - `definirAcaoAtiva(db, escopo: string | null, id: string, ativa: boolean): void`;
  - `listarCatalogoAtivo` (já existente) passa a **descartar repetições** de eixo + ação (a global prevalece), para o motor nunca receber IDs duplicados.
- Rotas: `GET/POST /api/acoes` e `PATCH /api/acoes/[id]` (`{ ativa }`). O escopo vem da sessão: admin → global; gestor → a própria empresa.

Validação de ação: eixo em `EIXOS_CATALOGO`; ação com 5–300 caracteres; recurso com 2–120; custo com 1–40. Ação repetida (eixo + ação, sem diferenciar maiúsculas e espaços) entre as ativas do catálogo global e do escopo → 409. Mais de 20 ações ativas no escopo (ao criar ou reativar) → 400.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `web/lib/catalogo.test.ts` (ajuste o import de `./catalogo.ts` para `{ criarAcao, definirAcaoAtiva, listarAcoes, listarCatalogoAtivo, LIMITE_ACOES }`):

```ts
const acao = (texto: string, eixo = 'Geral') => ({ eixo, acao: texto, recurso: 'Prática assistida', custo: 'R$ 0' });

test('gestor cria ação da loja; admin cria ação global; cada um vê o seu escopo', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  criarAcao(db, a, acao('Treinamento com o fornecedor do sistema'));
  criarAcao(db, null, acao('Leitura guiada do manual da ferramenta'));
  assert.deepEqual(listarAcoes(db, a).map(x => x.acao), ['Treinamento com o fornecedor do sistema']);
  assert.equal(listarAcoes(db, null).length, CATALOGO_BASE.length + 1);
  assert.equal(listarCatalogoAtivo(db, a).length, CATALOGO_BASE.length + 2);
});

test('recusa ação repetida do catálogo global, mesmo com maiúsculas e espaços diferentes', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  assert.throws(() => criarAcao(db, a, acao('  rodízio de FUNÇÕES   por uma semana ', 'Adaptabilidade')), { status: 409 });
  assert.throws(() => criarAcao(db, a, { ...acao('Curto'), eixo: 'Inventado' }), { status: 400 });
  assert.throws(() => criarAcao(db, a, acao('abc')), { status: 400 });
});

test('o motor nunca recebe ação repetida, mesmo se a global for criada depois', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  criarAcao(db, a, acao('Visita guiada a outra loja'));
  criarAcao(db, null, acao('visita guiada a outra loja'));
  const ativos = listarCatalogoAtivo(db, a).filter(x => x.acao.toLowerCase() === 'visita guiada a outra loja');
  assert.equal(ativos.length, 1);
});

test('limite de 20 ações ativas por escopo, inclusive ao reativar', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  const ids = Array.from({ length: LIMITE_ACOES }, (_, i) => criarAcao(db, a, acao(`Ação da loja número ${i}`)));
  assert.throws(() => criarAcao(db, a, acao('Ação a mais da loja')), { status: 400 });
  definirAcaoAtiva(db, a, ids[0], false);
  const extra = criarAcao(db, a, acao('Ação a mais da loja'));
  assert.throws(() => definirAcaoAtiva(db, a, ids[0], true), { status: 400 });
  assert.ok(extra);
});

test('não altera ação de outro escopo', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  const id = criarAcao(db, a, acao('Ação exclusiva da loja A'));
  assert.throws(() => definirAcaoAtiva(db, b, id, false), { status: 404 });
  assert.throws(() => definirAcaoAtiva(db, null, id, false), { status: 404 });
  const global = listarAcoes(db, null)[0].id;
  assert.throws(() => definirAcaoAtiva(db, a, global, false), { status: 404 });
});
```

Acrescente a `test_web_bridge.py`, dentro da classe `TestBridge`:

```python
    def test_catalogo_aceita_ate_40_acoes(self):
        entrada = copy.deepcopy(self.entrada)
        entrada['catalogo'] = [{'eixo': 'Geral', 'acao': f'Ação {i}', 'recurso': 'Interno', 'custo': 'R$ 0'} for i in range(40)]
        b.validar_entrada(entrada)
        entrada['catalogo'].append({'eixo': 'Geral', 'acao': 'Ação 40', 'recurso': 'Interno', 'custo': 'R$ 0'})
        with self.assertRaisesRegex(ValueError, 'catalogo'):
            b.validar_entrada(entrada)
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL (`criarAcao` não exportado).

Run (na raiz): `.venv/Scripts/python.exe -m unittest test_web_bridge.TestBridge.test_catalogo_aceita_ate_40_acoes` (Linux: `.venv/bin/python`)
Expected: FAIL com `ValueError: Quantidade inválida de linhas em catalogo (máximo 16).`

- [ ] **Step 3: Implementar**

Em `web_bridge.py`, na função `validar_entrada`, troque `"catalogo": 16` por `"catalogo": 40`.

Substitua `web/lib/catalogo.ts` inteiro:

```ts
import type { DatabaseSync } from 'node:sqlite';
import { EIXOS } from './estrutura.ts';
import { HttpErro } from './http.ts';
import type { AcaoCatalogo } from './seed.ts';

export const EIXOS_CATALOGO = [...EIXOS, 'Geral'] as const;
export const LIMITE_ACOES = 20;
export type AcaoRegistrada = AcaoCatalogo & { id: string; ativa: boolean };

type Linha = { id: string; empresa_id: string | null; eixo: string; acao: string; recurso: string; custo: string; ativa: number };
const chave = (a: { eixo: string; acao: string }) => `${a.eixo.trim().toLocaleLowerCase('pt-BR')}|${a.acao.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')}`;
const ORDEM = 'ORDER BY criada_em, rowid';

/** Catálogo enviado ao motor: global + loja, ativos, sem repetir eixo + ação (a global prevalece). */
export function listarCatalogoAtivo(db: DatabaseSync, empresaId: string): AcaoCatalogo[] {
  const linhas = db.prepare(`SELECT eixo, acao, recurso, custo FROM catalogo_acoes
    WHERE ativa = 1 AND (empresa_id IS NULL OR empresa_id = ?)
    ORDER BY empresa_id IS NOT NULL, criada_em, rowid`).all(empresaId) as AcaoCatalogo[];
  const vistas = new Set<string>();
  return linhas.filter(l => !vistas.has(chave(l)) && vistas.add(chave(l))).map(l => ({ eixo: l.eixo, acao: l.acao, recurso: l.recurso, custo: l.custo }));
}

export function listarAcoes(db: DatabaseSync, escopo: string | null): AcaoRegistrada[] {
  const linhas = (escopo === null
    ? db.prepare(`SELECT id, empresa_id, eixo, acao, recurso, custo, ativa FROM catalogo_acoes WHERE empresa_id IS NULL ${ORDEM}`).all()
    : db.prepare(`SELECT id, empresa_id, eixo, acao, recurso, custo, ativa FROM catalogo_acoes WHERE empresa_id = ? ${ORDEM}`).all(escopo)) as Linha[];
  return linhas.map(l => ({ id: l.id, eixo: l.eixo, acao: l.acao, recurso: l.recurso, custo: l.custo, ativa: Number(l.ativa) === 1 }));
}

function texto(v: unknown, campo: string, min: number, max: number): string {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) throw new HttpErro(400, `Informe ${campo} (${min} a ${max} caracteres).`);
  return v.trim();
}

function conferirLimite(db: DatabaseSync, escopo: string | null): void {
  if (listarAcoes(db, escopo).filter(a => a.ativa).length >= LIMITE_ACOES) {
    throw new HttpErro(400, `Limite de ${LIMITE_ACOES} ações ativas atingido. Desative uma ação antes de incluir outra.`);
  }
}

export function criarAcao(db: DatabaseSync, escopo: string | null, dados: Record<string, unknown>): string {
  if (typeof dados.eixo !== 'string' || !(EIXOS_CATALOGO as readonly string[]).includes(dados.eixo)) throw new HttpErro(400, 'Escolha um eixo válido.');
  const nova = { eixo: dados.eixo, acao: texto(dados.acao, 'a ação', 5, 300), recurso: texto(dados.recurso, 'o recurso', 2, 120), custo: texto(dados.custo, 'o custo', 1, 40) };
  const existentes = [...listarAcoes(db, null), ...(escopo === null ? [] : listarAcoes(db, escopo))].filter(a => a.ativa);
  if (existentes.some(a => chave(a) === chave(nova))) throw new HttpErro(409, 'Esta ação já existe no catálogo.');
  conferirLimite(db, escopo);
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO catalogo_acoes (id, empresa_id, eixo, acao, recurso, custo, ativa, criada_em) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
    .run(id, escopo, nova.eixo, nova.acao, nova.recurso, nova.custo, new Date().toISOString());
  return id;
}

export function definirAcaoAtiva(db: DatabaseSync, escopo: string | null, id: string, ativa: boolean): void {
  const acao = listarAcoes(db, escopo).find(a => a.id === id);
  if (!acao) throw new HttpErro(404, 'Ação não encontrada.');
  if (ativa && !acao.ativa) conferirLimite(db, escopo);
  db.prepare('UPDATE catalogo_acoes SET ativa = ? WHERE id = ?').run(ativa ? 1 : 0, id);
}
```

Rotas. `web/app/api/acoes/route.ts`:

```ts
import { criarAcao, listarAcoes } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const u = await exigirUsuario();
    return Response.json({ acoes: listarAcoes(db(), u.papel === 'admin' ? null : u.empresaId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const u = await exigirUsuario();
    const id = criarAcao(db(), u.papel === 'admin' ? null : u.empresaId, await lerJson(request, 3000));
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/app/api/acoes/[id]/route.ts`:

```ts
import { definirAcaoAtiva } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { errorResponse, HttpErro, lerJson, sameOrigin } from '@/lib/http';
import { exigirUsuario } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function PATCH(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const u = await exigirUsuario();
    const { ativa } = await lerJson(request, 500);
    if (typeof ativa !== 'boolean') throw new HttpErro(400, 'Solicitação inválida.');
    definirAcaoAtiva(db(), u.papel === 'admin' ? null : u.empresaId, (await contexto.params).id, ativa);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd web && npm test`
Expected: PASS.

Run (na raiz): `.venv/Scripts/python.exe -m unittest test_recomendar test_web_bridge test_deploy`
Expected: `OK` (com os testes de deploy pulados no Windows).

- [ ] **Step 5: Tela compartilhada e páginas**

`web/components/acoes/GerenciarAcoes.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo, Selecao } from '@/components/Campo';
import type { AcaoRegistrada } from '@/lib/catalogo';

const EIXOS = ['Letramento em IA', 'Proficiência técnica', 'Adaptabilidade', 'Relacionais e de julgamento', 'Geral'];
const VAZIA = { eixo: 'Geral', acao: '', recurso: '', custo: 'R$ 0' };

export default function GerenciarAcoes({ iniciais, titulo }: { iniciais: AcaoRegistrada[]; titulo: string }) {
  const [acoes, setAcoes] = useState(iniciais);
  const [form, setForm] = useState(VAZIA);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const executar = async (acao: () => Promise<void>) => {
    setErro('');
    setOcupado(true);
    try {
      await acao();
      setAcoes((await chamarApi<{ acoes: AcaoRegistrada[] }>('/api/acoes')).acoes);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  };
  const incluir = (e: React.FormEvent) => {
    e.preventDefault();
    void executar(async () => { await chamarApi('/api/acoes', { method: 'POST', json: form }); setForm(VAZIA); });
  };
  return (
    <>
      {erro && <div className="alert error" role="alert">{erro}<button onClick={() => setErro('')} aria-label="Fechar aviso">×</button></div>}
      <form className="panel form-grid" onSubmit={incluir}>
        <h2 className="wide">Nova ação</h2>
        <Campo rotulo="Ação de desenvolvimento" largo><input required minLength={5} maxLength={300} value={form.acao} onChange={e => setForm({ ...form, acao: e.target.value })} placeholder="Descreva em uma frase o que a pessoa vai fazer" /></Campo>
        <Campo rotulo="Eixo"><Selecao valor={form.eixo} opcoes={EIXOS} aoMudar={v => setForm({ ...form, eixo: v })} /></Campo>
        <Campo rotulo="Recurso"><input required minLength={2} maxLength={120} value={form.recurso} onChange={e => setForm({ ...form, recurso: e.target.value })} placeholder="Ex.: Prática assistida" /></Campo>
        <Campo rotulo="Custo"><input required maxLength={40} value={form.custo} onChange={e => setForm({ ...form, custo: e.target.value })} /></Campo>
        <div className="wide"><button className="button primary" disabled={ocupado}>Incluir ação</button></div>
      </form>
      <div className="priority-table">
        <div className="section-title"><h2>{titulo} <span>{acoes.filter(a => a.ativa).length} ativas</span></h2></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Ação</th><th>Eixo</th><th>Recurso</th><th>Custo</th><th>Situação</th><th></th></tr></thead>
          <tbody>{acoes.map(a => (
            <tr key={a.id}>
              <td>{a.acao}</td><td>{a.eixo}</td><td>{a.recurso}</td><td>{a.custo}</td>
              <td><span className={`badge ${a.ativa ? 'medium' : 'none'}`}>{a.ativa ? 'Ativa' : 'Desativada'}</span></td>
              <td><button className="text-button" disabled={ocupado} onClick={() => void executar(() => chamarApi(`/api/acoes/${a.id}`, { method: 'PATCH', json: { ativa: !a.ativa } }).then(() => undefined))}>{a.ativa ? 'Desativar' : 'Reativar'}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
```

`web/app/(loja)/acoes/page.tsx`:

```tsx
import GerenciarAcoes from '@/components/acoes/GerenciarAcoes';
import { listarAcoes } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function AcoesDaLoja() {
  const gestor = await exigirPaginaGestor();
  const globais = listarAcoes(db(), null).filter(a => a.ativa);
  return (
    <main className="page">
      <a className="text-button" href="/">← Painel da loja</a>
      <div className="page-heading"><div><p className="eyebrow">AÇÕES DA LOJA</p><h1>Ações de desenvolvimento</h1><p>Inclua ações que a sua loja já oferece, como um treinamento do fornecedor. A IA pode escolhê-las nas trilhas, junto com o catálogo da pesquisa.</p></div></div>
      <GerenciarAcoes iniciais={listarAcoes(db(), gestor.empresaId)} titulo="Ações da sua loja" />
      <div className="catalog"><div className="catalog-items">{globais.map(a => <div key={a.id}><span className="eyebrow">{a.eixo}</span><p>{a.acao}</p><small>{a.recurso} · {a.custo} · catálogo da pesquisa</small></div>)}</div></div>
    </main>
  );
}
```

`web/app/admin/catalogo/page.tsx`:

```tsx
import GerenciarAcoes from '@/components/acoes/GerenciarAcoes';
import { listarAcoes } from '@/lib/catalogo';
import { db } from '@/lib/db';
import { exigirPagina } from '@/lib/sessao-web';

export default async function CatalogoGlobal() {
  await exigirPagina({ papel: 'admin' });
  return (
    <main className="page">
      <div className="page-heading"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Catálogo da pesquisa</h1><p>Ações oferecidas a todas as lojas. Desative em vez de apagar: as trilhas antigas continuam citando a ação.</p></div></div>
      <GerenciarAcoes iniciais={listarAcoes(db(), null)} titulo="Catálogo global" />
    </main>
  );
}
```

- [ ] **Step 6: Verificar build e fluxo**

Run: `cd web && npm run build`
Expected: build com `/acoes`, `/admin/catalogo`, `/api/acoes`, `/api/acoes/[id]`.

Com `npm run dev`, como gestor: em `/acoes`, inclua "Treinamento com o fornecedor do sistema" (eixo Proficiência técnica). Tente incluir "Rodízio de funções por uma semana" (Adaptabilidade): aparece "Esta ação já existe no catálogo.". Abra um ocupante: o catálogo mostra 9 ações. Como admin, em `/admin/catalogo`, desative uma ação global e confirme que o ocupante passa a mostrar 8.

- [ ] **Step 7: Commit**

```bash
git add web/lib/catalogo.ts web/lib/catalogo.test.ts web_bridge.py test_web_bridge.py web/app/api/acoes web/components/acoes "web/app/(loja)/acoes" web/app/admin/catalogo
git commit -m "Permite acoes da loja e catalogo global gerenciados pelo admin" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ferramentas de IA da loja e boas-vindas

**Files:**
- Modify: `web/lib/db.ts` (tabela `ferramentas_ia`)
- Create: `web/lib/ferramentas.ts`
- Test: `web/lib/ferramentas.test.ts`
- Create: `web/app/api/ferramentas/route.ts`, `web/app/api/ferramentas/[id]/route.ts`
- Create: `web/components/loja/GerenciarFerramentas.tsx`
- Create: `web/app/(loja)/ferramentas/page.tsx`, `web/app/(loja)/boas-vindas/page.tsx`
- Modify: `web/app/api/auth/senha/route.ts` (gestor no primeiro acesso vai para `/boas-vindas`)
- Modify: `web/app/(loja)/page.tsx` (atalhos para Ferramentas e Ações)

**Interfaces:**
- Consumes: `bancoDeTeste`, `inserirEmpresa`; `HttpErro`, `errorResponse`, `lerJson`, `sameOrigin`; `exigirGestor`, `exigirPaginaGestor`, `destinoInicial`; `chamarApi`.
- Produces (`lib/ferramentas.ts`):
  - `CATEGORIAS_FERRAMENTA: string[]` (genéricas, sem marcas — RNF05);
  - `LIMITE_FERRAMENTAS = 30`;
  - `type Ferramenta = { id: string; nome: string }`;
  - `listarFerramentas(db, empresaId): Ferramenta[]` (ordem alfabética);
  - `adicionarFerramenta(db, empresaId, nome: unknown): Ferramenta` (2–80 caracteres; nome repetido sem diferenciar maiúsculas devolve a existente);
  - `removerFerramenta(db, empresaId, id): void` (404 fora da empresa).
- Rotas: `GET/POST /api/ferramentas` (`{ nome }`), `DELETE /api/ferramentas/[id]`.

- [ ] **Step 1: Escrever os testes que falham**

Crie `web/lib/ferramentas.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, inserirEmpresa } from './apoio-testes.ts';
import { adicionarFerramenta, CATEGORIAS_FERRAMENTA, LIMITE_FERRAMENTAS, listarFerramentas, removerFerramenta } from './ferramentas.ts';

test('adiciona, lista em ordem e não repete ferramenta', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db);
  const primeira = adicionarFerramenta(db, a, ' Sistema de vendas com IA ');
  adicionarFerramenta(db, a, 'Assistente de conversa com IA');
  assert.deepEqual(adicionarFerramenta(db, a, 'sistema DE vendas com ia'), primeira);
  assert.deepEqual(listarFerramentas(db, a).map(f => f.nome), ['Assistente de conversa com IA', 'Sistema de vendas com IA']);
  assert.equal(Object.getPrototypeOf(listarFerramentas(db, a)[0]), Object.prototype);
});

test('valida nome, limite e escopo da empresa', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'A');
  const b = inserirEmpresa(db, 'B');
  assert.throws(() => adicionarFerramenta(db, a, 'x'), { status: 400 });
  assert.throws(() => adicionarFerramenta(db, a, 'y'.repeat(81)), { status: 400 });
  const f = adicionarFerramenta(db, a, 'Ferramenta da loja A');
  assert.deepEqual(listarFerramentas(db, b), []);
  assert.throws(() => removerFerramenta(db, b, f.id), { status: 404 });
  removerFerramenta(db, a, f.id);
  assert.deepEqual(listarFerramentas(db, a), []);
  for (let i = 0; i < LIMITE_FERRAMENTAS; i++) adicionarFerramenta(db, a, `Ferramenta ${i}`);
  assert.throws(() => adicionarFerramenta(db, a, 'Uma a mais'), { status: 400 });
});

test('categorias sugeridas são genéricas, sem marca', () => {
  assert.ok(CATEGORIAS_FERRAMENTA.length >= 4);
  assert.ok(CATEGORIAS_FERRAMENTA.every(c => !/chatgpt|gemini|copilot|whatsapp/i.test(c)));
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL com `Cannot find module` para `ferramentas.ts`.

- [ ] **Step 3: Implementar**

Acrescente ao fim da constante `ESQUEMA` em `web/lib/db.ts`:

```sql
CREATE TABLE IF NOT EXISTS ferramentas_ia (
  id TEXT PRIMARY KEY, empresa_id TEXT NOT NULL REFERENCES empresas(id), nome TEXT NOT NULL, criada_em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ferramentas_empresa ON ferramentas_ia(empresa_id);
```

Crie `web/lib/ferramentas.ts`:

```ts
import type { DatabaseSync } from 'node:sqlite';
import { HttpErro } from './http.ts';

/** Sugestões genéricas para a pergunta de boas-vindas; o gestor escreve o nome real (RNF05). */
export const CATEGORIAS_FERRAMENTA = [
  'Assistente de conversa com IA',
  'Recurso de IA do sistema de vendas',
  'Recurso de IA do sistema de estoque',
  'Atendimento automático por mensagem',
  'Gerador de textos e imagens para divulgação',
];
export const LIMITE_FERRAMENTAS = 30;
export type Ferramenta = { id: string; nome: string };

const chave = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

export function listarFerramentas(db: DatabaseSync, empresaId: string): Ferramenta[] {
  const linhas = db.prepare('SELECT id, nome FROM ferramentas_ia WHERE empresa_id = ?').all(empresaId) as Ferramenta[];
  return linhas.map(l => ({ id: l.id, nome: l.nome })).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
}

export function adicionarFerramenta(db: DatabaseSync, empresaId: string, nome: unknown): Ferramenta {
  const valor = typeof nome === 'string' ? nome.trim().replace(/\s+/g, ' ') : '';
  if (valor.length < 2 || valor.length > 80) throw new HttpErro(400, 'Informe o nome da ferramenta (2 a 80 caracteres).');
  const atuais = listarFerramentas(db, empresaId);
  const existente = atuais.find(f => chave(f.nome) === chave(valor));
  if (existente) return existente;
  if (atuais.length >= LIMITE_FERRAMENTAS) throw new HttpErro(400, `Limite de ${LIMITE_FERRAMENTAS} ferramentas atingido.`);
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO ferramentas_ia (id, empresa_id, nome, criada_em) VALUES (?, ?, ?, ?)').run(id, empresaId, valor, new Date().toISOString());
  return { id, nome: valor };
}

export function removerFerramenta(db: DatabaseSync, empresaId: string, id: string): void {
  const r = db.prepare('DELETE FROM ferramentas_ia WHERE id = ? AND empresa_id = ?').run(id, empresaId);
  if (Number(r.changes) === 0) throw new HttpErro(404, 'Ferramenta não encontrada.');
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd web && npm test`
Expected: PASS.

- [ ] **Step 5: Rotas, componente e páginas**

`web/app/api/ferramentas/route.ts`:

```ts
import { db } from '@/lib/db';
import { adicionarFerramenta, listarFerramentas } from '@/lib/ferramentas';
import { errorResponse, lerJson, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const gestor = await exigirGestor();
    return Response.json({ ferramentas: listarFerramentas(db(), gestor.empresaId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    const { nome } = await lerJson(request, 500);
    return Response.json(adicionarFerramenta(db(), gestor.empresaId, nome), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/app/api/ferramentas/[id]/route.ts`:

```ts
import { db } from '@/lib/db';
import { removerFerramenta } from '@/lib/ferramentas';
import { errorResponse, sameOrigin } from '@/lib/http';
import { exigirGestor } from '@/lib/sessao-web';

export const runtime = 'nodejs';

export async function DELETE(request: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const gestor = await exigirGestor();
    removerFerramenta(db(), gestor.empresaId, (await contexto.params).id);
    return Response.json({ removida: true });
  } catch (e) {
    return errorResponse(e);
  }
}
```

`web/components/loja/GerenciarFerramentas.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';
import type { Ferramenta } from '@/lib/ferramentas';

export default function GerenciarFerramentas({ iniciais, categorias }: { iniciais: Ferramenta[]; categorias: string[] }) {
  const [ferramentas, setFerramentas] = useState(iniciais);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const executar = async (acao: () => Promise<unknown>) => {
    setErro('');
    setOcupado(true);
    try {
      await acao();
      setFerramentas((await chamarApi<{ ferramentas: Ferramenta[] }>('/api/ferramentas')).ferramentas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  };
  const adicionar = (valor: string) => executar(() => chamarApi('/api/ferramentas', { method: 'POST', json: { nome: valor } }));
  const ja = new Set(ferramentas.map(f => f.nome.toLocaleLowerCase('pt-BR')));
  return (
    <div className="panel">
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <div className="chips">{ferramentas.length ? ferramentas.map(f => (
        <span className="chip ativo" key={f.id}>{f.nome}<button type="button" disabled={ocupado} aria-label={`Remover ${f.nome}`} onClick={() => void executar(() => chamarApi(`/api/ferramentas/${f.id}`, { method: 'DELETE' }))}>×</button></span>
      )) : <p className="helper">Nenhuma ferramenta cadastrada ainda.</p>}</div>
      <p className="helper">Sugestões (toque para incluir e depois ajuste o nome, se quiser):</p>
      <div className="chips">{categorias.filter(c => !ja.has(c.toLocaleLowerCase('pt-BR'))).map(c => (
        <button type="button" className="chip" key={c} disabled={ocupado} onClick={() => void adicionar(c)}>+ {c}</button>
      ))}</div>
      <form className="role-strip" onSubmit={e => { e.preventDefault(); void adicionar(nome).then(() => setNome('')); }}>
        <Campo rotulo="Outra ferramenta"><input value={nome} minLength={2} maxLength={80} onChange={e => setNome(e.target.value)} placeholder="Escreva o nome que a equipe usa" /></Campo>
        <button className="button secondary" disabled={ocupado || nome.trim().length < 2}>Incluir</button>
      </form>
    </div>
  );
}
```

Acrescente ao fim de `web/app/globals.css`:

```css
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:white;border-radius:999px;padding:6px 12px;font-size:13px;color:var(--ink)}
.chip.ativo{background:var(--accent);border-color:#b9e5d2}
.chip button{background:none;border:0;font-size:16px;line-height:1;color:var(--muted);padding:0}
```

`web/app/(loja)/ferramentas/page.tsx`:

```tsx
import GerenciarFerramentas from '@/components/loja/GerenciarFerramentas';
import { db } from '@/lib/db';
import { CATEGORIAS_FERRAMENTA, listarFerramentas } from '@/lib/ferramentas';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function Ferramentas() {
  const gestor = await exigirPaginaGestor();
  return (
    <main className="page narrow">
      <a className="text-button" href="/">← Painel da loja</a>
      <div className="page-heading"><div><p className="eyebrow">FERRAMENTAS DE IA</p><h1>Ferramentas da loja</h1><p>Cadastre uma vez as ferramentas de IA que a loja usa ou pensa em usar. Elas aparecem como sugestão ao preencher as tarefas.</p></div></div>
      <GerenciarFerramentas iniciais={listarFerramentas(db(), gestor.empresaId)} categorias={CATEGORIAS_FERRAMENTA} />
    </main>
  );
}
```

`web/app/(loja)/boas-vindas/page.tsx`:

```tsx
import Link from 'next/link';
import GerenciarFerramentas from '@/components/loja/GerenciarFerramentas';
import { db } from '@/lib/db';
import { CATEGORIAS_FERRAMENTA, listarFerramentas } from '@/lib/ferramentas';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function BoasVindas() {
  const gestor = await exigirPaginaGestor();
  return (
    <main className="page narrow">
      <div className="page-heading"><div><p className="eyebrow">BOAS-VINDAS</p><h1>Quais ferramentas de IA sua loja usa ou pensa em usar?</h1><p>Isso deixa o preenchimento mais rápido. Pode pular e voltar depois pelo painel.</p></div></div>
      <GerenciarFerramentas iniciais={listarFerramentas(db(), gestor.empresaId)} categorias={CATEGORIAS_FERRAMENTA} />
      <Link className="button primary" href="/">Continuar para o painel</Link>
    </main>
  );
}
```

Em `web/app/api/auth/senha/route.ts`, troque a linha do `return Response.json({ destino: … })` por:

```ts
    const destino = usuario.papel === 'gestor' && usuario.trocarSenha ? '/boas-vindas' : destinoInicial({ ...usuario, trocarSenha: false });
    return Response.json({ destino });
```

Em `web/app/(loja)/page.tsx`, troque o link único do cabeçalho por um grupo:

```tsx
        <div className="row-actions">
          <Link className="button secondary" href="/ferramentas">Ferramentas de IA</Link>
          <Link className="button secondary" href="/acoes">Ações da loja</Link>
          <Link className="button primary" href="/funcoes/nova">+ Nova função</Link>
        </div>
```

- [ ] **Step 6: Verificar**

Run: `cd web && npm test && npm run build`
Expected: PASS e build com `/ferramentas`, `/boas-vindas`, `/api/ferramentas`, `/api/ferramentas/[id]`.

Com `npm run dev`: como admin, crie uma empresa nova; entre com o gestor dela e troque a senha temporária: o destino é `/boas-vindas`. Toque em "+ Assistente de conversa com IA": o chip aparece na lista. "Continuar para o painel" leva a `/`, que mostra os três botões. Entrar de novo (login normal) leva direto a `/`.

- [ ] **Step 7: Commit**

```bash
git add web/lib/db.ts web/lib/ferramentas.ts web/lib/ferramentas.test.ts web/app/api/ferramentas web/components/loja/GerenciarFerramentas.tsx "web/app/(loja)/ferramentas" "web/app/(loja)/boas-vindas" web/app/api/auth/senha/route.ts "web/app/(loja)/page.tsx" web/app/globals.css
git commit -m "Cadastra ferramentas de IA da loja com boas-vindas no primeiro acesso" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Etapa Tarefas mais rápida

**Files:**
- Modify: `web/lib/estrutura.ts` (`efeitoAutomatico`)
- Test: `web/lib/estrutura.test.ts` (1 teste)
- Create: `web/components/BotoesOpcao.tsx`
- Modify: `web/components/funcao/EtapaTarefas.tsx` (conteúdo final abaixo)
- Modify: `web/components/funcao/EditorFuncao.tsx` (prop e estado `ferramentas`)
- Modify: `web/app/(loja)/funcoes/[id]/page.tsx` (passa as ferramentas da loja)
- Modify: `web/app/globals.css`, `web/test-browser.cjs`

**Interfaces:**
- Consumes: `Tarefa`, `FREQUENCIAS`, `CRITICIDADES`, `EFEITOS`, `LIMITES`, `novaTarefa` (fase 1); `listarFerramentas` (Task 5); `chamarApi`, `Campo`, `type Opcao` (fase 1).
- Produces:
  - `lib/estrutura.ts`: `efeitoAutomatico(t: Tarefa): Tarefa` — tarefa com texto, sem ferramenta e sem efeito vira `'I'` (fluxo alternativo do UC3); caso contrário, devolve a mesma tarefa.
  - `components/BotoesOpcao.tsx`: `BotoesOpcao({ rotulo, valor, opcoes, aoMudar })` — grupo de rádio acessível (`role="radiogroup"`, cada botão `role="radio"` com `aria-checked`).
  - `components/funcao/EtapaTarefas.tsx`: props `{ estrutura, aoMudar, ferramentas: string[], aoAdicionarFerramenta?: (nome: string) => Promise<void> }`. Sem `aoAdicionarFerramenta` (editor de modelos do admin), o botão "Adicionar à lista da loja" não aparece.
  - `EditorFuncao` recebe `ferramentas: string[]`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescente a `web/lib/estrutura.test.ts` (inclua `efeitoAutomatico` no import):

```ts
test('tarefa sem ferramenta e sem efeito passa a "não mudou"', () => {
  const t = { ...novaTarefa(), tarefa: 'Organizar o estoque' };
  assert.equal(efeitoAutomatico(t).efeito_ia, 'I');
  assert.equal(efeitoAutomatico({ ...t, ferramenta: 'Sistema com IA' }).efeito_ia, null);
  assert.equal(efeitoAutomatico({ ...t, efeito_ia: 'N' }).efeito_ia, 'N');
  assert.equal(efeitoAutomatico({ ...t, tarefa: '  ' }).efeito_ia, null);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && npm test`
Expected: FAIL (`efeitoAutomatico` não exportado).

- [ ] **Step 3: Implementar `efeitoAutomatico`**

Acrescente ao fim de `web/lib/estrutura.ts`:

```ts
/** Sem ferramenta e sem efeito escolhido, a tarefa "não mudou" (fluxo alternativo do UC3). */
export function efeitoAutomatico(t: Tarefa): Tarefa {
  return t.tarefa.trim() && !t.ferramenta.trim() && t.efeito_ia === null ? { ...t, efeito_ia: 'I' } : t;
}
```

Run: `cd web && npm test`
Expected: PASS.

- [ ] **Step 4: Componente de botões e estilos**

`web/components/BotoesOpcao.tsx`:

```tsx
import type { Opcao } from './Campo';

export default function BotoesOpcao({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: string; opcoes: readonly Opcao[]; aoMudar: (v: string) => void }) {
  const lista = opcoes.map(o => (typeof o === 'string' ? { valor: o, rotulo: o } : o));
  return (
    <div className="field">
      <span>{rotulo}</span>
      <div className="segmented" role="radiogroup" aria-label={rotulo}>
        {lista.map(o => (
          <button type="button" key={o.valor} role="radio" aria-checked={valor === o.valor} className={valor === o.valor ? 'ativo' : ''} onClick={() => aoMudar(o.valor)}>{o.rotulo}</button>
        ))}
      </div>
    </div>
  );
}
```

Acrescente ao fim de `web/app/globals.css`:

```css
.segmented{display:flex;flex-wrap:wrap;gap:6px}
.segmented button{border:1px solid var(--line);background:#fbfcfe;border-radius:6px;padding:8px 12px;font-size:13px;line-height:1.3;color:var(--ink)}
.segmented button.ativo{background:var(--navy);border-color:var(--navy);color:white}
.inline-action{margin-top:6px;font-size:12px}
```

- [ ] **Step 5: Substituir `web/components/funcao/EtapaTarefas.tsx` inteiro**

```tsx
'use client';
import BotoesOpcao from '@/components/BotoesOpcao';
import { Campo } from '@/components/Campo';
import { CRITICIDADES, EFEITOS, FREQUENCIAS, LIMITES, efeitoAutomatico, novaTarefa, type Estrutura, type Tarefa } from '@/lib/estrutura';

const ROTULO_EFEITO: Record<string, string> = { A: 'A IA faz por ele (A)', P: 'A IA ajuda (P)', I: 'Não mudou (I)', N: 'Nova por causa da IA (N)' };
const EFEITOS_SIMPLES = EFEITOS.map(e => ({ valor: e, rotulo: ROTULO_EFEITO[e] }));

type Props = { estrutura: Estrutura; aoMudar: (e: Estrutura) => void; ferramentas: string[]; aoAdicionarFerramenta?: (nome: string) => Promise<void> };

export default function EtapaTarefas({ estrutura, aoMudar, ferramentas, aoAdicionarFerramenta }: Props) {
  const conhecidas = new Set(ferramentas.map(f => f.toLocaleLowerCase('pt-BR')));
  const alterar = (id: string, campos: Partial<Tarefa>) =>
    aoMudar({ ...estrutura, tarefas: estrutura.tarefas.map(t => (t.id === id ? { ...t, ...campos, editada: true } : t)) });
  const aoSairDaFerramenta = (t: Tarefa) => {
    const ajustada = efeitoAutomatico(t);
    if (ajustada !== t) alterar(t.id, { efeito_ia: ajustada.efeito_ia });
  };
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
      <datalist id="ferramentas-loja">{ferramentas.map(f => <option key={f} value={f} />)}</datalist>
      {estrutura.tarefas.map((t, i) => {
        const nova = t.ferramenta.trim() && !conhecidas.has(t.ferramenta.trim().toLocaleLowerCase('pt-BR'));
        return (
          <article className="entry" key={t.id}>
            <div className="entry-number">{String(i + 1).padStart(2, '0')}</div>
            <div className="entry-fields">
              <Campo rotulo="Tarefa" largo><input value={t.tarefa} maxLength={LIMITES.texto} onChange={e => alterar(t.id, { tarefa: e.target.value })} placeholder="Descreva uma atividade, começando por um verbo" /></Campo>
              <BotoesOpcao rotulo="Frequência" valor={t.frequencia} opcoes={FREQUENCIAS} aoMudar={v => alterar(t.id, { frequencia: v as Tarefa['frequencia'] })} />
              <BotoesOpcao rotulo="Criticidade" valor={t.criticidade} opcoes={CRITICIDADES} aoMudar={v => alterar(t.id, { criticidade: v as Tarefa['criticidade'] })} />
              <Campo rotulo="Ferramenta de IA" largo>
                <input list="ferramentas-loja" value={t.ferramenta} maxLength={LIMITES.ferramenta} onChange={e => alterar(t.id, { ferramenta: e.target.value })} onBlur={() => aoSairDaFerramenta(t)} placeholder="Deixe em branco se a IA não participa" />
              </Campo>
              {nova && aoAdicionarFerramenta && <button type="button" className="text-button inline-action wide" onClick={() => void aoAdicionarFerramenta(t.ferramenta.trim())}>+ Adicionar "{t.ferramenta.trim()}" à lista da loja</button>}
              <div className="wide"><BotoesOpcao rotulo="Efeito da IA" valor={t.efeito_ia ?? ''} opcoes={EFEITOS_SIMPLES} aoMudar={v => alterar(t.id, { efeito_ia: v as Tarefa['efeito_ia'] })} /></div>
            </div>
            <button className="remove" disabled={estrutura.tarefas.length <= 1} onClick={() => remover(t.id)} aria-label={`Remover tarefa ${i + 1}`}>×</button>
          </article>
        );
      })}
      <p className="helper">Efeito da IA: escolha o que mudou na tarefa por causa da ferramenta. Sem ferramenta, marcamos "Não mudou" para você.</p>
    </>
  );
}
```

- [ ] **Step 6: Ferramentas no editor**

Em `web/components/funcao/EditorFuncao.tsx`:
- no tipo `Props`, acrescente `ferramentas: string[]`, e desestruture `ferramentas` na assinatura;
- logo depois de `const [erroAcao, setErroAcao] = useState('');`, acrescente:

```tsx
  const [ferramentasLoja, setFerramentasLoja] = useState(ferramentas);
  const adicionarFerramenta = async (nome: string) => {
    try {
      const nova = await chamarApi<{ nome: string }>('/api/ferramentas', { method: 'POST', json: { nome } });
      setFerramentasLoja(lista => (lista.includes(nova.nome) ? lista : [...lista, nova.nome]));
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível adicionar a ferramenta.');
    }
  };
```

- troque `{etapa === 0 && <EtapaTarefas estrutura={estrutura} aoMudar={setEstrutura} />}` por:

```tsx
        {etapa === 0 && <EtapaTarefas estrutura={estrutura} aoMudar={setEstrutura} ferramentas={ferramentasLoja} aoAdicionarFerramenta={adicionarFerramenta} />}
```

Em `web/app/(loja)/funcoes/[id]/page.tsx`, importe `listarFerramentas` de `@/lib/ferramentas` e passe `ferramentas={listarFerramentas(db(), gestor.empresaId).map(f => f.nome)}` ao `EditorFuncao`.

- [ ] **Step 7: Atualizar o roteiro de ponta a ponta**

Em `web/test-browser.cjs`, troque:

```js
  await page.getByLabel('Efeito da IA').selectOption('P');
```

por:

```js
  await page.getByRole('radio', { name: 'A IA ajuda (P)' }).click();
```

- [ ] **Step 8: Verificar**

Run: `cd web && npm test && npm run build`
Expected: PASS e build concluído.

Com `npm run dev`, como gestor: abra uma função, adicione uma tarefa, escreva "Organizar o depósito", passe pelo campo de ferramenta deixando-o vazio e saia (Tab): o efeito "Não mudou (I)" fica selecionado. Em outra tarefa, digite uma ferramenta que não está na lista: aparece "+ Adicionar … à lista da loja"; clique e confirme que ela passa a aparecer como sugestão no campo (lista do navegador). Rode `MRCC_TEST_EMAIL=gestor@local.test MRCC_TEST_SENHA=gestor-local-123 node test-browser.cjs` → `Fluxo do gestor verificado.`

- [ ] **Step 9: Commit**

```bash
git add web/lib/estrutura.ts web/lib/estrutura.test.ts web/components/BotoesOpcao.tsx web/components/funcao/EtapaTarefas.tsx web/components/funcao/EditorFuncao.tsx "web/app/(loja)/funcoes/[id]/page.tsx" web/app/globals.css web/test-browser.cjs
git commit -m "Simplifica a etapa de tarefas com botoes, ferramentas da loja e efeito automatico" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Etapa Competências com sugestões e perda de centralidade

**Files:**
- Modify: `web/components/funcao/EtapaCompetencias.tsx` (conteúdo final abaixo)
- Modify: `web/app/globals.css`

**Interfaces:**
- Consumes: `sugerir`, `aceitarSugestoes`, `ignorarSugestao` (Task 1); `EIXOS`, `LIMITES`, `NIVEIS`, `ROTULOS_NIVEL`, `novaCompetencia`, `novoId`, tipos (fase 1); `Campo`, `Selecao` (fase 1).
- Produces: `EtapaCompetencias({ estrutura, aoMudar })` com:
  - painel "Sugeridas a partir das tarefas" (cada item com motivo, Aceitar e Ignorar; botão "Aceitar todas" com aviso das que não couberam no limite de 8);
  - seção "Deixam de ser centrais" (RF07): perdas registradas com remoção, sugestões com Aceitar/Ignorar e inclusão manual ligada a uma tarefa;
  - a lista de competências editáveis da fase 1.

Esta task é só de interface; a regra já está testada na Task 1. A verificação é feita no navegador.

- [ ] **Step 1: Substituir `web/components/funcao/EtapaCompetencias.tsx` inteiro**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Campo, Selecao } from '@/components/Campo';
import { EIXOS, LIMITES, NIVEIS, ROTULOS_NIVEL, novaCompetencia, novoId, type Competencia, type Estrutura } from '@/lib/estrutura';
import { aceitarSugestoes, ignorarSugestao, sugerir } from '@/lib/regras';

export default function EtapaCompetencias({ estrutura, aoMudar }: { estrutura: Estrutura; aoMudar: (e: Estrutura) => void }) {
  const [aviso, setAviso] = useState('');
  const sugestoes = useMemo(() => sugerir(estrutura), [estrutura]);
  const alterar = (id: string, campos: Partial<Competencia>) =>
    aoMudar({ ...estrutura, competencias: estrutura.competencias.map(c => (c.id === id ? { ...c, ...campos, editada: true } : c)) });
  const aceitar = (chaves: string[]) => {
    const { estrutura: nova, recusadas } = aceitarSugestoes(estrutura, chaves);
    setAviso(recusadas.length ? `Limite de ${LIMITES.competencias} competências atingido. Ficaram de fora: ${recusadas.join(', ')}.` : '');
    aoMudar(nova);
  };
  const tarefas = estrutura.tarefas.map((t, i) => ({ valor: t.id, rotulo: t.tarefa.trim() || `Tarefa ${i + 1} (sem descrição)` }));
  const textoTarefa = (id: string) => tarefas.find(t => t.valor === id)?.rotulo ?? 'tarefa removida';
  const niveis = NIVEIS.map(n => ({ valor: n, rotulo: ROTULOS_NIVEL[n] }));
  const [perdaManual, setPerdaManual] = useState({ descricao: '', tarefa_id: '' });

  return (
    <>
      {sugestoes.competencias.length > 0 && (
        <section className="suggestions" aria-label="Competências sugeridas">
          <div className="section-title">
            <h2>Sugeridas a partir das tarefas <span>{sugestoes.competencias.length}</span></h2>
            <button className="button primary small" onClick={() => aceitar(sugestoes.competencias.map(s => s.chave))}>Aceitar todas</button>
          </div>
          {sugestoes.competencias.map(s => (
            <div className="suggestion" key={s.chave}>
              <div>
                <strong>{s.competencia.competencia}</strong>
                <p className="helper">{s.competencia.eixo} · nível-alvo {ROTULOS_NIVEL[s.competencia.alvo]} · tarefa: {textoTarefa(s.competencia.tarefa_id)}</p>
                <p className="helper">Por quê: {s.competencia.motivo}</p>
              </div>
              <div className="row-actions">
                <button className="button secondary small" onClick={() => aceitar([s.chave])}>Aceitar</button>
                <button className="text-button" onClick={() => aoMudar(ignorarSugestao(estrutura, s.chave))}>Ignorar</button>
              </div>
            </div>
          ))}
        </section>
      )}
      {aviso && <div className="alert info" role="status">{aviso}</div>}

      <div className="section-title">
        <h2>Perfil de competências <span>{estrutura.competencias.length}</span></h2>
        <button className="button secondary small" disabled={estrutura.competencias.length >= LIMITES.competencias}
          onClick={() => aoMudar({ ...estrutura, competencias: [...estrutura.competencias, novaCompetencia(estrutura.tarefas[0]?.id ?? '')] })}>+ Adicionar competência</button>
      </div>
      {estrutura.competencias.length === 0 && <p className="helper">Nenhuma competência ainda. Aceite as sugestões acima ou adicione uma.</p>}
      {estrutura.competencias.map((c, i) => (
        <article className="entry" key={c.id}>
          <div className="entry-number">{String(i + 1).padStart(2, '0')}</div>
          <div className="entry-fields">
            <Campo rotulo="Competência" largo><input value={c.competencia} maxLength={LIMITES.texto} onChange={e => alterar(c.id, { competencia: e.target.value })} placeholder="Ex.: Revisar o resultado da IA antes de enviar ao cliente" /></Campo>
            <Campo rotulo="Eixo"><Selecao valor={c.eixo} opcoes={EIXOS} aoMudar={v => alterar(c.id, { eixo: v as Competencia['eixo'] })} /></Campo>
            <Campo rotulo="Tarefa associada"><Selecao valor={c.tarefa_id} vazio="Escolha a tarefa" opcoes={tarefas} aoMudar={v => alterar(c.id, { tarefa_id: v })} /></Campo>
            <Campo rotulo="Nível-alvo da função"><Selecao valor={c.alvo} opcoes={niveis} aoMudar={v => alterar(c.id, { alvo: v as Competencia['alvo'] })} /></Campo>
            {c.motivo && c.origem === 'regra' && <p className="helper wide">Sugerida porque: {c.motivo}</p>}
          </div>
          <button className="remove" onClick={() => aoMudar({ ...estrutura, competencias: estrutura.competencias.filter(x => x.id !== c.id) })} aria-label={`Remover competência ${i + 1}`}>×</button>
        </article>
      ))}
      <p className="helper">O nível atual é registrado por ocupante, na última etapa. Aqui você define o nível que a função exige.</p>

      <section className="panel" aria-label="Competências que deixam de ser centrais">
        <h2>Deixam de ser centrais</h2>
        <p className="helper">O que a IA passou a fazer e a pessoa não precisa mais executar sozinha (RF07). Serve para conversar com a equipe sobre a mudança.</p>
        {estrutura.perdem_centralidade.map(p => (
          <div className="suggestion" key={p.id}>
            <div><strong>{p.descricao}</strong><p className="helper">Tarefa: {textoTarefa(p.tarefa_id)}</p></div>
            <button className="text-button danger" onClick={() => aoMudar({ ...estrutura, perdem_centralidade: estrutura.perdem_centralidade.filter(x => x.id !== p.id) })}>Remover</button>
          </div>
        ))}
        {sugestoes.perdem_centralidade.map(s => (
          <div className="suggestion sugerida" key={s.chave}>
            <div><strong>{s.perda.descricao}</strong><p className="helper">Sugestão: a IA passou a fazer esta tarefa.</p></div>
            <div className="row-actions">
              <button className="button secondary small" onClick={() => aceitar([s.chave])}>Aceitar</button>
              <button className="text-button" onClick={() => aoMudar(ignorarSugestao(estrutura, s.chave))}>Ignorar</button>
            </div>
          </div>
        ))}
        <form className="form-grid" onSubmit={e => {
          e.preventDefault();
          if (!perdaManual.descricao.trim() || !perdaManual.tarefa_id) return;
          aoMudar({ ...estrutura, perdem_centralidade: [...estrutura.perdem_centralidade, { id: novoId(), descricao: perdaManual.descricao.trim(), tarefa_id: perdaManual.tarefa_id, origem: 'manual' }] });
          setPerdaManual({ descricao: '', tarefa_id: '' });
        }}>
          <Campo rotulo="Outra competência que perde centralidade"><input value={perdaManual.descricao} maxLength={LIMITES.texto} onChange={e => setPerdaManual({ ...perdaManual, descricao: e.target.value })} placeholder="Ex.: Calcular o orçamento à mão" /></Campo>
          <Campo rotulo="Tarefa"><Selecao valor={perdaManual.tarefa_id} vazio="Escolha a tarefa" opcoes={tarefas} aoMudar={v => setPerdaManual({ ...perdaManual, tarefa_id: v })} /></Campo>
          <div className="wide"><button className="button secondary small" disabled={estrutura.perdem_centralidade.length >= LIMITES.tarefas}>Incluir</button></div>
        </form>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Estilos**

Acrescente ao fim de `web/app/globals.css`:

```css
.suggestions{background:#eef6f2;border:1px solid #cfe5da;border-radius:9px;padding:20px 22px;margin-bottom:26px}
.suggestion{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:14px 0;border-top:1px solid #d6e7de}
.suggestion:first-of-type{border-top:0}
.panel .suggestion{border-top-color:var(--line)}
.suggestion.sugerida strong{color:var(--muted)}
@media(max-width:760px){.suggestion{flex-direction:column}}
```

- [ ] **Step 3: Verificar**

Run: `cd web && npm test && npm run build`
Expected: PASS e build concluído.

Com `npm run dev`, como gestor: crie uma função em branco com as 4 tarefas do exemplo (Consultar preço e estoque — Diária/Média/ferramenta/A; Montar orçamento — Diária/Alta/ferramenta/P; Negociar prazo — Semanal/Alta/sem ferramenta/I; Revisar orçamento da IA — Diária/Alta/ferramenta/N). Na etapa Competências aparecem 4 sugestões, nesta ordem: Letramento em IA, Proficiência em <ferramenta>, Julgamento em: Negociar prazo…, Adaptabilidade a novos fluxos de trabalho; e uma perda sugerida "Executar manualmente: Consultar preço e estoque". "Aceitar todas" cria as 4 competências e o painel some. Ignore a perda sugerida e recarregue a página: ela continua ignorada.

- [ ] **Step 4: Commit**

```bash
git add web/components/funcao/EtapaCompetencias.tsx web/app/globals.css
git commit -m "Mostra competencias sugeridas e perda de centralidade na etapa de competencias" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Nova função a partir de modelo, cópia ou em branco

**Files:**
- Modify: `web/components/loja/NovaFuncao.tsx` (conteúdo final abaixo)
- Modify: `web/app/(loja)/funcoes/nova/page.tsx`

**Interfaces:**
- Consumes: `listarModelos`, `type ResumoModelo` (Task 3); `listarFuncoes`, `type ResumoFuncao` (fase 1); `POST /api/funcoes` com `{ modeloId }`, `{ copiarDe }` ou `{ nome }` (Task 3); `POST /api/import` (fase 1); `chamarApi`, `Campo`.
- Produces: `NovaFuncao({ modelos: ResumoModelo[]; funcoes: { id: string; nome: string }[] })` com quatro pontos de partida: **Modelo pronto** (cartões), **Copiar uma função da loja** (lista), **Em branco** (nome) e o link "Importar planilha MRCC-PV". O ponto "Descrever com minhas palavras (IA)" entra na fase 3.

- [ ] **Step 1: Substituir `web/components/loja/NovaFuncao.tsx` inteiro**

```tsx
'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { chamarApi } from '@/components/api';
import { Campo, Selecao } from '@/components/Campo';
import type { ResumoModelo } from '@/lib/modelos';

type Props = { modelos: ResumoModelo[]; funcoes: { id: string; nome: string }[] };

export default function NovaFuncao({ modelos, funcoes }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [copiarDe, setCopiarDe] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const criar = async (corpo: Record<string, string>) => {
    setErro('');
    setOcupado(true);
    try {
      const { id } = await chamarApi<{ id: string }>('/api/funcoes', { method: 'POST', json: corpo });
      router.push(`/funcoes/${id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a função.');
      setOcupado(false);
    }
  };
  const importar = async (selecionado?: File) => {
    if (!selecionado) return;
    setErro('');
    setOcupado(true);
    try {
      const corpo = new FormData();
      corpo.set('file', selecionado);
      const { funcaoId } = await chamarApi<{ funcaoId: string }>('/api/import', { method: 'POST', body: corpo });
      router.push(`/funcoes/${funcaoId}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível importar.');
      setOcupado(false);
    } finally {
      if (arquivo.current) arquivo.current.value = '';
    }
  };
  return (
    <main className="page">
      <a className="text-button" href="/">← Painel da loja</a>
      <div className="page-heading"><div><p className="eyebrow">NOVA FUNÇÃO</p><h1>Como você quer começar?</h1><p>O jeito mais rápido é partir de um modelo e só ajustar o que for diferente na sua loja.</p></div></div>
      {erro && <div className="alert error" role="alert">{erro}</div>}

      <h2>Modelo pronto</h2>
      <p className="helper">Tarefas e competências típicas do varejo, já preenchidas. Você revisa tudo depois.</p>
      <div className="cards">{modelos.map(m => (
        <button key={m.id} className="card" disabled={ocupado} onClick={() => void criar({ modeloId: m.id })}>
          <h2>{m.nome}</h2>
          <p className="helper">{m.tarefas} tarefa(s) · {m.competencias} competência(s)</p>
          {m.descricao && <p className="helper">{m.descricao}</p>}
          <span className="text-button">Usar este modelo →</span>
        </button>
      ))}</div>

      <div className="form-grid">
        {funcoes.length > 0 && (
          <form className="panel" onSubmit={e => { e.preventDefault(); if (copiarDe) void criar({ copiarDe }); }}>
            <h2>Copiar uma função da loja</h2>
            <p className="helper">Útil quando duas funções são parecidas. Os ocupantes não são copiados.</p>
            <Campo rotulo="Função de origem"><Selecao valor={copiarDe} vazio="Escolha a função" opcoes={funcoes.map(f => ({ valor: f.id, rotulo: f.nome }))} aoMudar={setCopiarDe} /></Campo>
            <div><button className="button secondary" disabled={ocupado || !copiarDe}>Copiar</button></div>
          </form>
        )}
        <form className="panel" onSubmit={e => { e.preventDefault(); void criar({ nome }); }}>
          <h2>Em branco</h2>
          <p className="helper">Para uma função que não se parece com nenhum modelo.</p>
          <Campo rotulo="Nome da função"><input required maxLength={120} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Atendente de balcão" /></Campo>
          <div><button className="button secondary" disabled={ocupado}>Começar em branco</button></div>
        </form>
      </div>
      <p className="helper">Já tem a planilha MRCC-PV preenchida? <button type="button" className="text-button" disabled={ocupado} onClick={() => arquivo.current?.click()}>Importar planilha (.xlsx)</button></p>
      <input ref={arquivo} type="file" accept=".xlsx" hidden onChange={e => void importar(e.target.files?.[0])} />
    </main>
  );
}
```

- [ ] **Step 2: Substituir `web/app/(loja)/funcoes/nova/page.tsx` inteiro**

```tsx
import NovaFuncao from '@/components/loja/NovaFuncao';
import { db } from '@/lib/db';
import { listarFuncoes } from '@/lib/funcoes';
import { listarModelos } from '@/lib/modelos';
import { exigirPaginaGestor } from '@/lib/sessao-web';

export default async function PaginaNovaFuncao() {
  const gestor = await exigirPaginaGestor();
  const funcoes = listarFuncoes(db(), gestor.empresaId).map(f => ({ id: f.id, nome: f.nome }));
  return <NovaFuncao modelos={listarModelos(db(), false)} funcoes={funcoes} />;
}
```

- [ ] **Step 3: Verificar**

Run: `cd web && npm run build`
Expected: build concluído.

Com `npm run dev`, como gestor, em `/funcoes/nova`:
1. Aparecem 5 cartões de modelo. Clique em "Operador(a) de caixa": abre o editor com 5 tarefas e 4 competências, e o painel não tem pendências.
2. Volte a `/funcoes/nova`, escolha "Operador(a) de caixa" em "Copiar uma função da loja" e clique em Copiar: abre "Operador(a) de caixa (cópia)".
3. "Em branco" com o nome "Teste" abre a função vazia.
4. Como admin, desative o modelo "Vendedor(a) de loja" (Task 9) ou, antes da Task 9, rode `curl -X PATCH` em `/api/admin/modelos/<id>` com `{"ativo":false}` usando o cookie do admin. Sem recarregar a tela do gestor, clique no cartão: aparece "Modelo não encontrado ou desativado." e nenhuma função é criada.

- [ ] **Step 4: Commit**

```bash
git add web/components/loja/NovaFuncao.tsx "web/app/(loja)/funcoes/nova/page.tsx"
git commit -m "Oferece modelos prontos e copia de funcao ao criar uma funcao" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Admin — modelos de cargo e navegação

**Files:**
- Modify: `web/lib/funcoes.ts` (`listarFuncoesDeTodas`)
- Test: `web/lib/funcoes.test.ts` (1 teste)
- Create: `web/components/admin/NavAdmin.tsx`, `web/components/admin/ListaModelos.tsx`, `web/components/admin/EditorModelo.tsx`
- Modify: `web/app/admin/layout.tsx`
- Create: `web/app/admin/modelos/page.tsx`, `web/app/admin/modelos/[id]/page.tsx`
- Modify: `web/app/globals.css`

**Interfaces:**
- Consumes: `listarModelos`, `obterModelo`, `type ResumoModelo` (Task 3); rotas `/api/admin/modelos` e `/api/admin/modelos/[id]` (Task 3); `EtapaTarefas` (Task 6), `EtapaCompetencias` (Task 7); `useAutosave` (fase 1); `chamarApi`, `Campo`, `Selecao`.
- Produces:
  - `lib/funcoes.ts`: `listarFuncoesDeTodas(db): { id: string; nome: string; empresa: string }[]` (funções ativas de todas as empresas, para o admin promover a modelo);
  - páginas `/admin/modelos` (lista, criar em branco, promover função, ativar/desativar) e `/admin/modelos/[id]` (editor com salvamento automático);
  - `NavAdmin` no topo do admin: Empresas · Modelos · Catálogo.

- [ ] **Step 1: Escrever o teste que falha**

Acrescente a `web/lib/funcoes.test.ts` (inclua `listarFuncoesDeTodas` no import de `./funcoes.ts`):

```ts
test('admin lista funções ativas de todas as empresas com o nome da loja', () => {
  const db = bancoDeTeste();
  const a = inserirEmpresa(db, 'Loja A');
  const b = inserirEmpresa(db, 'Loja B');
  criarFuncao(db, a, { nome: 'Caixa', estrutura: estruturaVazia(), origem: 'branco' });
  const arquivada = criarFuncao(db, b, { nome: 'Antiga', estrutura: estruturaVazia(), origem: 'branco' });
  criarFuncao(db, b, { nome: 'Estoquista', estrutura: estruturaVazia(), origem: 'branco' });
  arquivarFuncao(db, b, arquivada);
  assert.deepEqual(listarFuncoesDeTodas(db).map(f => [f.empresa, f.nome]), [['Loja A', 'Caixa'], ['Loja B', 'Estoquista']]);
});
```

Run: `cd web && npm test`
Expected: FAIL (`listarFuncoesDeTodas` não exportado).

- [ ] **Step 2: Implementar**

Acrescente ao fim de `web/lib/funcoes.ts`:

```ts
export function listarFuncoesDeTodas(db: DatabaseSync): { id: string; nome: string; empresa: string }[] {
  const linhas = db.prepare(`SELECT f.id, f.nome, e.nome AS empresa FROM funcoes f JOIN empresas e ON e.id = f.empresa_id
    WHERE f.arquivada = 0 ORDER BY e.nome COLLATE NOCASE, f.nome COLLATE NOCASE`).all() as { id: string; nome: string; empresa: string }[];
  return linhas.map(l => ({ id: l.id, nome: l.nome, empresa: l.empresa }));
}
```

Run: `cd web && npm test`
Expected: PASS.

- [ ] **Step 3: Navegação do admin**

`web/components/admin/NavAdmin.tsx`:

```tsx
import Link from 'next/link';

export default function NavAdmin() {
  return (
    <nav className="nav-admin" aria-label="Administração">
      <Link href="/admin">Empresas</Link>
      <Link href="/admin/modelos">Modelos de cargo</Link>
      <Link href="/admin/catalogo">Catálogo</Link>
    </nav>
  );
}
```

Substitua `web/app/admin/layout.tsx` inteiro:

```tsx
import NavAdmin from '@/components/admin/NavAdmin';
import Topo from '@/components/Topo';
import { exigirPagina } from '@/lib/sessao-web';

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  await exigirPagina({ papel: 'admin' });
  return <><Topo subtitulo="Administração da pesquisa" inicio="/admin" /><NavAdmin />{children}</>;
}
```

Acrescente ao fim de `web/app/globals.css`:

```css
.nav-admin{display:flex;gap:24px;padding:14px 40px;background:white;border-bottom:1px solid var(--line);font-size:14px;font-weight:600}
.nav-admin a{color:var(--muted)}
.nav-admin a:hover{color:var(--ink)}
@media(max-width:760px){.nav-admin{padding:12px 18px;gap:16px;overflow-x:auto}}
```

- [ ] **Step 4: Lista de modelos**

`web/components/admin/ListaModelos.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { chamarApi } from '@/components/api';
import { Campo, Selecao } from '@/components/Campo';
import type { ResumoModelo } from '@/lib/modelos';

type Props = { modelos: ResumoModelo[]; funcoes: { id: string; nome: string; empresa: string }[] };

export default function ListaModelos({ modelos, funcoes }: Props) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [funcaoId, setFuncaoId] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const executar = async (acao: () => Promise<void>) => {
    setErro('');
    setOcupado(true);
    try { await acao(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível concluir.'); } finally { setOcupado(false); }
  };
  const criar = (corpo: Record<string, string>) => executar(async () => {
    const { id } = await chamarApi<{ id: string }>('/api/admin/modelos', { method: 'POST', json: corpo });
    router.push(`/admin/modelos/${id}`);
  });
  return (
    <main className="page">
      <div className="page-heading"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Modelos de cargo</h1><p>Os gestores começam uma função a partir destes modelos. Desative em vez de apagar.</p></div></div>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <div className="priority-table">
        <div className="section-title"><h2>Modelos <span>{modelos.length}</span></h2></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Modelo</th><th>Tarefas</th><th>Competências</th><th>Situação</th><th></th></tr></thead>
          <tbody>{modelos.map(m => (
            <tr key={m.id}>
              <td><strong>{m.nome}</strong><br /><span className="helper">{m.descricao}</span></td>
              <td>{m.tarefas}</td><td>{m.competencias}</td>
              <td><span className={`badge ${m.ativo ? 'medium' : 'none'}`}>{m.ativo ? 'Ativo' : 'Desativado'}</span></td>
              <td><div className="row-actions">
                <a className="text-button" href={`/admin/modelos/${m.id}`}>Editar</a>
                <button className="text-button danger" disabled={ocupado} onClick={() => void executar(async () => {
                  await chamarApi(`/api/admin/modelos/${m.id}`, { method: 'PATCH', json: { ativo: !m.ativo } });
                  router.refresh();
                })}>{m.ativo ? 'Desativar' : 'Reativar'}</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="form-grid">
        <form className="panel" onSubmit={e => { e.preventDefault(); void criar({ nome }); }}>
          <h2>Novo modelo em branco</h2>
          <Campo rotulo="Nome do cargo"><input required maxLength={120} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Repositor de hortifrúti" /></Campo>
          <div><button className="button primary" disabled={ocupado}>Criar modelo</button></div>
        </form>
        <form className="panel" onSubmit={e => { e.preventDefault(); if (funcaoId) void criar({ funcaoId }); }}>
          <h2>Promover função de uma loja</h2>
          <p className="helper">Copia só tarefas e competências; salvaguardas, ocupantes e nome da loja ficam de fora.</p>
          <Campo rotulo="Função"><Selecao valor={funcaoId} vazio="Escolha a função" opcoes={funcoes.map(f => ({ valor: f.id, rotulo: `${f.empresa} — ${f.nome}` }))} aoMudar={setFuncaoId} /></Campo>
          <div><button className="button secondary" disabled={ocupado || !funcaoId}>Promover a modelo</button></div>
        </form>
      </div>
    </main>
  );
}
```

`web/app/admin/modelos/page.tsx`:

```tsx
import ListaModelos from '@/components/admin/ListaModelos';
import { db } from '@/lib/db';
import { listarFuncoesDeTodas } from '@/lib/funcoes';
import { listarModelos } from '@/lib/modelos';
import { exigirPagina } from '@/lib/sessao-web';

export default async function Modelos() {
  await exigirPagina({ papel: 'admin' });
  return <ListaModelos modelos={listarModelos(db(), true)} funcoes={listarFuncoesDeTodas(db())} />;
}
```

- [ ] **Step 5: Editor de modelo**

`web/components/admin/EditorModelo.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Campo } from '@/components/Campo';
import EtapaCompetencias from '@/components/funcao/EtapaCompetencias';
import EtapaTarefas from '@/components/funcao/EtapaTarefas';
import { useAutosave } from '@/components/useAutosave';
import { pendenciasEstrutura, type Estrutura } from '@/lib/estrutura';

type Props = { modelo: { id: string; nome: string; descricao: string; estrutura: Estrutura } };

export default function EditorModelo({ modelo }: Props) {
  const [nome, setNome] = useState(modelo.nome);
  const [descricao, setDescricao] = useState(modelo.descricao);
  const [estrutura, setEstrutura] = useState(modelo.estrutura);
  const { estado, erro } = useAutosave(`/api/admin/modelos/${modelo.id}`, { nome, descricao, estrutura });
  const pendencias = pendenciasEstrutura(estrutura);
  return (
    <main className="page">
      <a className="text-button" href="/admin/modelos">← Modelos</a>
      <div className="page-heading"><div><p className="eyebrow">MODELO DE CARGO</p><h1>{nome || 'Modelo sem nome'}</h1><p>Tarefas e competências que o gestor recebe ao escolher este modelo. As salvaguardas são respondidas por cada loja.</p></div></div>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <div className="panel form-grid">
        <Campo rotulo="Nome do cargo"><input value={nome} maxLength={120} onChange={e => setNome(e.target.value)} /></Campo>
        <Campo rotulo="Descrição (aparece no cartão)"><input value={descricao} maxLength={300} onChange={e => setDescricao(e.target.value)} /></Campo>
      </div>
      <EtapaTarefas estrutura={estrutura} aoMudar={setEstrutura} ferramentas={[]} />
      <EtapaCompetencias estrutura={estrutura} aoMudar={setEstrutura} />
      {pendencias.length > 0 && <div className="alert info"><strong>O gestor verá estas pendências</strong>{pendencias.map(p => <p key={p}>{p}</p>)}</div>}
      <footer className="workspace-footer"><span>{estado === 'salvo' ? 'Alterações salvas.' : estado === 'pendente' ? 'Salvando…' : 'Não foi possível salvar. Veja o aviso acima.'}</span></footer>
    </main>
  );
}
```

`web/app/admin/modelos/[id]/page.tsx`:

```tsx
import EditorModelo from '@/components/admin/EditorModelo';
import { db } from '@/lib/db';
import { obterModelo } from '@/lib/modelos';
import { exigirPagina, ou404 } from '@/lib/sessao-web';

export default async function PaginaModelo({ params }: { params: Promise<{ id: string }> }) {
  await exigirPagina({ papel: 'admin' });
  const { id } = await params;
  const modelo = ou404(() => obterModelo(db(), id, false));
  return <EditorModelo modelo={{ id: modelo.id, nome: modelo.nome, descricao: modelo.descricao, estrutura: modelo.estrutura }} />;
}
```

- [ ] **Step 6: Verificar**

Run: `cd web && npm test && npm run build`
Expected: PASS e build com `/admin/modelos` e `/admin/modelos/[id]`.

Com `npm run dev`, como admin: a barra Empresas · Modelos de cargo · Catálogo aparece. Em Modelos, os 5 iniciais estão listados. Abra "Vendedor(a) de loja", troque a descrição e volte: a lista mostra a nova descrição. Promova a função "Atendente de balcão" da Loja Local: abre o editor do novo modelo com 4 tarefas e salvaguardas zeradas (não aparecem aqui). Desative e reative um modelo.

- [ ] **Step 7: Commit**

```bash
git add web/lib/funcoes.ts web/lib/funcoes.test.ts web/components/admin web/app/admin web/app/globals.css
git commit -m "Adiciona gestao de modelos de cargo no painel do admin" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Ocupante — nível por perguntas e cópia de níveis

**Files:**
- Modify: `web/lib/ocupantes.ts` (`niveisDosOutros`)
- Test: `web/lib/ocupantes.test.ts` (1 teste)
- Create: `web/components/ocupante/PerguntasNivel.tsx`
- Modify: `web/components/ocupante/PaginaOcupante.tsx`
- Modify: `web/app/(loja)/funcoes/[id]/ocupantes/[oid]/page.tsx`
- Modify: `web/test-browser.cjs`, `web/app/globals.css`

**Interfaces:**
- Consumes: `perguntasDoEixo`, `nivelPorRespostas`, `perguntasVisiveis`, `responder`, `DESCRICAO_NIVEL`, `type Respostas` (Task 2); `BotoesOpcao` (Task 6); `Competencia`, `NivelOcupante`, `Niveis`, `NIVEIS`, `ROTULOS_NIVEL` (fase 1); `Selecao`, `Campo`.
- Produces:
  - `lib/ocupantes.ts`: `niveisDosOutros(db, empresaId: string, funcaoId: string, excetoId: string): { id: string; apelido: string; niveis: Niveis }[]` (ocupantes ativos da mesma função, exceto o atual);
  - `PerguntasNivel({ competencia, valor, aoMudar, desabilitado })` — `valor?: NivelOcupante`; `aoMudar(v: NivelOcupante | null)` (`null` enquanto as respostas estão incompletas). Modo "perguntas" (padrão) ou "escolher direto" (select com os 4 níveis; grava `respostas: null`);
  - `PaginaOcupante` recebe `outros: { id: string; apelido: string; niveis: Niveis }[]` e mostra "Copiar níveis de outro ocupante".

- [ ] **Step 1: Escrever o teste que falha**

Acrescente a `web/lib/ocupantes.test.ts` (inclua `niveisDosOutros` no import):

```ts
test('lista os níveis dos outros ocupantes ativos da mesma função', () => {
  const { db, a, b, funcaoId } = cenario();
  const atual = criarOcupante(db, a, funcaoId, { apelido: 'Atual' });
  const outro = criarOcupante(db, a, funcaoId, { apelido: 'Outro', niveis: { [ID(1)]: { nivel: 'N2', respostas: [true, true, false] } } });
  const arquivado = criarOcupante(db, a, funcaoId, { apelido: 'Arquivado' });
  arquivarOcupante(db, a, arquivado);
  assert.deepEqual(niveisDosOutros(db, a, funcaoId, atual), [{ id: outro, apelido: 'Outro', niveis: { [ID(1)]: { nivel: 'N2', respostas: [true, true, false] } } }]);
  assert.throws(() => niveisDosOutros(db, b, funcaoId, atual), { status: 404 });
});
```

Run: `cd web && npm test`
Expected: FAIL (`niveisDosOutros` não exportado).

- [ ] **Step 2: Implementar `niveisDosOutros`**

Acrescente ao fim de `web/lib/ocupantes.ts`:

```ts
export function niveisDosOutros(db: DatabaseSync, empresaId: string, funcaoId: string, excetoId: string): { id: string; apelido: string; niveis: Niveis }[] {
  obterFuncao(db, empresaId, funcaoId);
  const linhas = db.prepare('SELECT id, apelido, niveis FROM ocupantes WHERE funcao_id = ? AND arquivado = 0 AND id <> ? ORDER BY criado_em')
    .all(funcaoId, excetoId) as { id: string; apelido: string; niveis: string }[];
  return linhas.map(l => ({ id: l.id, apelido: l.apelido, niveis: JSON.parse(l.niveis) as Niveis }));
}
```

Run: `cd web && npm test`
Expected: PASS.

- [ ] **Step 3: Componente de perguntas**

`web/components/ocupante/PerguntasNivel.tsx`:

```tsx
'use client';
import { useState } from 'react';
import BotoesOpcao from '@/components/BotoesOpcao';
import { Selecao } from '@/components/Campo';
import { NIVEIS, ROTULOS_NIVEL, type Competencia, type Nivel, type NivelOcupante } from '@/lib/estrutura';
import { DESCRICAO_NIVEL, nivelPorRespostas, perguntasDoEixo, perguntasVisiveis, responder, type Respostas } from '@/lib/niveis';

const SIM_NAO = [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }];
type Props = { competencia: Competencia; valor?: NivelOcupante; aoMudar: (v: NivelOcupante | null) => void; desabilitado: boolean };

export default function PerguntasNivel({ competencia, valor, aoMudar, desabilitado }: Props) {
  const [direto, setDireto] = useState(Boolean(valor && valor.respostas === null));
  const [respostas, setRespostas] = useState<Respostas>(valor?.respostas ?? [null, null, null]);
  const perguntas = perguntasDoEixo(competencia.eixo);
  const nivel = valor?.nivel ?? null;
  const responderPergunta = (indice: number, sim: boolean) => {
    const novas = responder(respostas, indice, sim);
    setRespostas(novas);
    const calculado = nivelPorRespostas(novas);
    aoMudar(calculado ? { nivel: calculado, respostas: novas } : null);
  };
  return (
    <div className="perguntas-nivel">
      {direto ? (
        <div className="field">
          <span>Nível atual</span>
          <Selecao valor={nivel ?? ''} vazio="Escolha o nível" opcoes={NIVEIS.map(n => ({ valor: n, rotulo: ROTULOS_NIVEL[n] }))} aoMudar={v => aoMudar({ nivel: v as Nivel, respostas: null })} />
        </div>
      ) : perguntas.slice(0, perguntasVisiveis(respostas)).map((p, i) => (
        <fieldset className="pergunta" key={p} disabled={desabilitado}>
          <BotoesOpcao rotulo={p} valor={respostas[i] === null ? '' : respostas[i] ? 'sim' : 'nao'} opcoes={SIM_NAO} aoMudar={v => responderPergunta(i, v === 'sim')} />
        </fieldset>
      ))}
      {nivel && <p className="nivel-calculado"><strong>{ROTULOS_NIVEL[nivel]}</strong> — {DESCRICAO_NIVEL[nivel]}</p>}
      <button type="button" className="text-button inline-action" disabled={desabilitado} onClick={() => setDireto(!direto)}>
        {direto ? 'Responder pelas perguntas' : 'Prefiro escolher o nível diretamente'}
      </button>
    </div>
  );
}
```

Acrescente ao fim de `web/app/globals.css`:

```css
.perguntas-nivel{display:flex;flex-direction:column;gap:12px}
.pergunta{border:0;padding:0;margin:0;min-width:0}
.nivel-calculado{font-size:13px;background:#edf6f2;border-left:3px solid #82bba4;padding:10px 12px}
```

- [ ] **Step 4: Usar as perguntas na página do ocupante**

Em `web/components/ocupante/PaginaOcupante.tsx`:
- importe `PerguntasNivel from './PerguntasNivel'` e `type NivelOcupante` de `@/lib/estrutura` (junto com os outros tipos);
- no tipo `Props`, acrescente `outros: { id: string; apelido: string; niveis: Niveis }[]` e desestruture `outros`;
- troque a função `mudarNivel` inteira por:

```tsx
  const mudarNivel = (competenciaId: string, valor: NivelOcupante | null) => {
    setExecucao(null);
    setNiveis(n => {
      const novo = { ...n };
      if (valor) novo[competenciaId] = valor;
      else delete novo[competenciaId];
      return novo;
    });
  };
  const copiarNiveis = (outroId: string) => {
    const origem = outros.find(o => o.id === outroId);
    if (!origem) return;
    setExecucao(null);
    setNiveis(n => {
      const novo = { ...n };
      for (const c of estrutura.competencias) if (origem.niveis[c.id]) novo[c.id] = origem.niveis[c.id];
      return novo;
    });
  };
```

- dentro do `<fieldset className="editor" …>`, troque o bloco `<Campo rotulo="Nível atual"><Selecao … /></Campo>` por:

```tsx
                <div className="wide"><PerguntasNivel key={`${c.id}-${niveis[c.id]?.nivel ?? ''}-${String(niveis[c.id]?.respostas)}`} competencia={c} valor={niveis[c.id]} aoMudar={v => mudarNivel(c.id, v)} desabilitado={ocupado} /></div>
```

  A `key` recria o componente quando os níveis são copiados de outro ocupante, para as respostas exibidas acompanharem o valor novo.
- logo antes do `<fieldset className="editor" …>`, acrescente:

```tsx
      {outros.length > 0 && (
        <div className="role-strip">
          <Campo rotulo="Copiar níveis de outro ocupante"><Selecao valor="" vazio="Escolha um ocupante" opcoes={outros.map(o => ({ valor: o.id, rotulo: o.apelido }))} aoMudar={copiarNiveis} /></Campo>
          <div className="role-caption">Útil quando as pessoas estão no mesmo estágio.<br />Depois ajuste o que for diferente.</div>
        </div>
      )}
```

- remova `NIVEIS` dos imports de `@/lib/estrutura` se não for mais usado (o `tsc` acusa).

Em `web/app/(loja)/funcoes/[id]/ocupantes/[oid]/page.tsx`, importe `niveisDosOutros` de `@/lib/ocupantes` e passe `outros={niveisDosOutros(banco, gestor.empresaId, funcao.id, ocupante.id)}` ao `PaginaOcupante`.

- [ ] **Step 5: Atualizar o roteiro de ponta a ponta**

Em `web/test-browser.cjs`, troque:

```js
  await page.getByLabel('Nível atual').selectOption('N1');
```

por:

```js
  await page.getByRole('radiogroup', { name: 'Usa a ferramenta nesta tarefa?' }).getByRole('radio', { name: 'Sim' }).click();
  await page.getByRole('radiogroup', { name: /Usa sem instruções prontas/ }).getByRole('radio', { name: 'Não' }).click();
  await expect(page.getByText('N1 - Usuário assistido —')).toBeVisible();
```

- [ ] **Step 6: Verificar**

Run: `cd web && npm test && npm run build`
Expected: PASS e build concluído.

Com `npm run dev`, como gestor, num ocupante da função de exemplo:
1. Na competência "Letramento em IA", responda Sim → Sim → Não: aparece "N2 - Usuário autônomo — Faz sem apoio…" e a tabela de lacunas mostra N2 → N2.
2. Mude a primeira resposta para Não: as outras perguntas somem e o nível vira N0.
3. "Prefiro escolher o nível diretamente" mostra o select; escolha N3.
4. Adicione um segundo ocupante na função e, nele, use "Copiar níveis de outro ocupante": os quatro níveis aparecem preenchidos.
5. `MRCC_TEST_EMAIL=gestor@local.test MRCC_TEST_SENHA=gestor-local-123 node test-browser.cjs` → `Fluxo do gestor verificado.`

- [ ] **Step 7: Commit**

```bash
git add web/lib/ocupantes.ts web/lib/ocupantes.test.ts web/components/ocupante "web/app/(loja)/funcoes/[id]/ocupantes" web/test-browser.cjs web/app/globals.css
git commit -m "Registra o nivel atual por perguntas e permite copiar niveis entre ocupantes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Verificação final e documentação da fase 2

**Files:**
- Modify: `SITE_WEB.md` (seção Uso)

**Interfaces:**
- Consumes: tudo das Tasks 1–10.
- Produces: documentação do uso com modelos, sugestões, perguntas de nível, ferramentas e ações da loja.

- [ ] **Step 1: Documentação**

Em `SITE_WEB.md`, na seção `## Uso`, substitua os itens 2 a 4 da lista numerada por:

```markdown
2. **Gestor** (`/`): vê as funções da loja e cria uma nova a partir de um **modelo pronto**, copiando outra função da loja, em branco ou importando a planilha MRCC-PV. No primeiro acesso, informa as **ferramentas de IA** da loja (também em `/ferramentas`); elas aparecem como sugestão nas tarefas.
3. Em cada função, preenche Tarefas (botões e linguagem simples; sem ferramenta, o efeito vira "Não mudou"), Competências e Salvaguarda. A etapa Competências **sugere competências a partir das tarefas** (RF05), com o motivo de cada uma, e lista o que **deixa de ser central** (RF07). O salvamento é automático.
4. Na etapa Ocupantes, adiciona cada pessoa por apelido, sem dados pessoais. Na página do ocupante, responde **três perguntas de sim/não** por competência (Quadro 4 do PBL3) ou escolhe o nível diretamente; dá para copiar os níveis de outro ocupante.
```

E acrescente, depois do parágrafo sobre o tempo ativo:

```markdown
O admin mantém os **modelos de cargo** (`/admin/modelos`, inclusive promovendo a função de uma loja a modelo) e o **catálogo da pesquisa** (`/admin/catalogo`). Cada loja pode incluir ações próprias em `/acoes`; o motor recebe as ativas do catálogo e da loja (até 40), sem repetições. O conteúdo dos modelos Operador(a) de caixa, Vendedor(a), Estoquista/Repositor e Atendimento online é proposta da equipe e deve ser revisado pelo grupo.
```

- [ ] **Step 2: Verificação completa**

Run (na raiz): `.venv/Scripts/python.exe -m unittest test_recomendar test_web_bridge test_deploy`
Expected: `OK` (testes de deploy pulados no Windows).

Run: `cd web && npm test && npm run build`
Expected: todos os testes passam; build concluído.

Com `npm run dev`: `MRCC_TEST_EMAIL=gestor@local.test MRCC_TEST_SENHA=gestor-local-123 node test-browser.cjs` → `Fluxo do gestor verificado.`

Fluxo cronometrado (registro para o grupo): partindo de um modelo pronto, aceite as sugestões, responda as salvaguardas com "Sim", adicione um ocupante, responda as perguntas e confira o diagnóstico. Anote no PR o tempo total e o `tempo_ativo_s` registrado.

- [ ] **Step 3: Commit**

```bash
git add SITE_WEB.md
git commit -m "Documenta modelos, sugestoes e perguntas de nivel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Cobertura do spec (fase 2)

| Spec | Onde |
|---|---|
| §8.2 Regras R1–R4 e R7, motivo, aceitar todas com limite, teste de referência | Tasks 1 e 7 |
| §8.3 Perguntas de nível, descrição do Quadro 4, escolha direta | Tasks 2 e 10 |
| §8.1 Cinco modelos, admin edita, promover função | Tasks 3 e 9 |
| §8.5 Copiar função, ferramentas da loja, ações da loja | Tasks 3, 4, 5, 8 |
| §7 Boas-vindas, botões, linguagem simples, efeito automático, adicionar ferramenta, painel com atalhos | Tasks 5, 6 |
| §7 Copiar níveis de outro ocupante | Task 10 |
| §10 Catálogo = global + loja, limite 40 no Python | Task 4 |

Fora desta fase: texto livre com IA (fase 3) e métricas/leitura pelo admin (fase 4).
