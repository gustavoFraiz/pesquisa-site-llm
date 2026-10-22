# Interface MRCC-PV

Aplicação Next.js que usa o motor Python na pasta superior. O admin (equipe da pesquisa) cadastra empresas; o gestor de cada empresa cadastra funções (M1, M2 e Salvaguarda) e ocupantes, e gera a trilha (M4) de cada ocupante. O cálculo das lacunas (M3) é determinístico; as propostas usam Qwen/Ollama na própria VM.

## Contas e dados

- Login obrigatório. Um gestor por empresa; a senha temporária criada pelo admin é trocada no primeiro acesso. O primeiro admin é criado por SSH com `node scripts/criar-admin.mjs <email>`.
- Senhas com `scrypt` (N=2¹⁷). Sessão em cookie `mrcc_auth` (`HttpOnly`, `SameSite=Lax`, `Secure` com `MRCC_SECURE_COOKIE=1`), 14 dias; o banco guarda só o hash do token. Cinco senhas erradas bloqueiam a conta por 15 minutos.
- Toda consulta do gestor é filtrada pela empresa da sessão; recurso de outra empresa responde 404. O admin só lê os dados das empresas.
- SQLite (`node:sqlite`, WAL) em `web/data/sessions.sqlite`, com tabelas só aditivas: o rollback do deploy volta o código sem quebrar o banco. Cada execução guarda entradas, diagnóstico, propostas e evidências em `web/data/<id>/`.
- Salvamento automático com controle de versão: se a página estiver desatualizada (voltar pelo navegador, outra aba), o servidor recusa a gravação (409) e pede para recarregar.

## Agilidade para o gestor

- Modelos de cargo prontos (mantidos pelo admin), cópia de função e importação da planilha.
- Competências sugeridas a partir das tarefas (RF05) e perda de centralidade (RF07), em `lib/regras.ts`.
- Nível atual por três perguntas de sim/não (Quadro 4 do PBL3), em `lib/niveis.ts`.
- Ferramentas de IA da loja como sugestão nas tarefas; ações próprias da loja no catálogo.

## Desenvolvimento

Na raiz, instale as dependências Python em `.venv` e disponibilize Ollama com `qwen3:4b`. Em `web`:

```powershell
npm ci
npm test        # módulos de lib/ com node:test (type stripping do Node 24)
npm run dev
```

Node 24 LTS é a versão usada na VM. Os módulos de `lib/` importam uns aos outros com extensão `.ts` (exigência do `node --test`); páginas e componentes usam `@/lib/...`.

## Configuração

| Variável | Uso |
| --- | --- |
| `MRCC_ROOT` | Diretório do motor Python e dos documentos originais |
| `MRCC_PYTHON` | Executável da `.venv` |
| `MRCC_NUM_THREADS` | Threads de inferência; 2 na VM |
| `MRCC_MODEL` | Modelo Ollama; `qwen3:4b` |
| `MRCC_LLM_TIMEOUT` | Tempo por tentativa; 1200 segundos na VM |
| `MRCC_SECURE_COOKIE` | `1` em produção com HTTPS |
| `PORT` | 3000, acessível somente em 127.0.0.1 |

As gerações com LLM entram numa fila em memória: uma por vez na VM, uma por loja, até seis aguardando. A página mostra a posição. Reinícios interrompem a geração ativa; a página mostra "interrompida por reinício" e permite tentar de novo. A escolha final, o prazo, o critério de conclusão e as salvaguardas precisam de revisão humana.

O seletor em `../web_llm.py` recebe tarefas, níveis, ações candidatas e ajustes do trabalho; devolve só o índice da ação e uma justificativa curta. O código monta o restante. Isso não substitui a rubrica humana nem confirma as âncoras completas do PBL3.

## Verificação

- `npm test` e `npm run build` (o CI roda os dois).
- `test-browser.cjs` percorre o fluxo do gestor no Chrome instalado: login, nova função, tarefa, competência, ocupante, perguntas de nível, diagnóstico, voltar pelo navegador e recarregar. Uso: `MRCC_TEST_EMAIL=… MRCC_TEST_SENHA=… node test-browser.cjs` (o gestor precisa já ter trocado a senha temporária). Aceita `MRCC_TEST_URL` para outra instância. Não consome inferência.
