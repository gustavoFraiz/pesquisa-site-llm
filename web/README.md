# Interface MRCC-PV

Aplicação Next.js que usa o motor Python na pasta superior. Preenchimento direto de M1, M2 e Salvaguarda, cálculo determinístico de M3 e propostas de M4 por Qwen/Ollama. A VM e o projeto local usam `qwen3:4b`. Importar ou baixar Excel é opcional.

## Sessões sem login

Não existem usuários, senhas ou cadastro. Um cookie aleatório `HttpOnly`, `Secure` na VM e `SameSite=Lax` identifica cada navegador por 30 dias. No SQLite fica somente o hash do token, o rascunho e a associação das análises à sessão. Consultas e downloads conferem essa associação. Limpar cookies ou usar outro navegador cria um espaço separado; não há recuperação de uma sessão perdida.

O SQLite usa WAL e não precisa de outro serviço. Dados ficam em `web/data/`, fora do diretório público. Cada execução mantém entradas, diagnóstico, propostas e evidências em uma subpasta privada. Os dados do formulário são enviados à própria VM; a inferência acontece ali, sem serviço externo de LLM.

## Desenvolvimento

Na raiz, instale as dependências Python em `.venv` e disponibilize Ollama com `qwen3:4b`. Em `web`:

```powershell
npm ci
npm run dev
```

Node 24 LTS é a versão utilizada na VM. `node:sqlite` é nativo; não há dependências compiladas para banco/autenticação. O desenvolvimento local usa cookie sem `Secure`; produção define `MRCC_SECURE_COOKIE=1` e usa HTTPS.

## Configuração

| Variável | Uso |
| --- | --- |
| `MRCC_ROOT` | Diretório do motor Python e dos documentos originais |
| `MRCC_PYTHON` | Executável da `.venv` |
| `MRCC_NUM_THREADS` | Threads de inferência; 2 na VM |
| `MRCC_MODEL` | Modelo Ollama; `qwen3:4b` na VM, `qwen3:4b` por padrão local |
| `MRCC_LLM_TIMEOUT` | Tempo por tentativa; 1200 segundos na VM |
| `MRCC_SECURE_COOKIE` | `1` em produção com HTTPS |
| `PORT` | 3000, acessível somente em 127.0.0.1 |

Há uma execução por vez e até uma repetição por saída inválida. A interface acompanha o processamento em segundo plano. Reinícios interrompem a geração ativa e permitem uma nova tentativa. A escolha final, o prazo, o critério de conclusão e as salvaguardas precisam de revisão humana.

O seletor em `../web_llm.py` recebe tarefas, níveis, ações candidatas e ajustes do trabalho; devolve somente o índice da ação e uma justificativa curta. O código associa esse índice ao ID do catálogo e monta critérios por tarefa/nível-alvo, responsável Gestor, prazo informado pelo usuário e orientações de revisão. O diagnóstico completo e o PBL4 ficam preservados nos arquivos, sem enviar todos os trechos ao seletor. A validação rejeita índices fora do catálogo, troca de competências e promessas de garantia de resultado. Isso não substitui a rubrica humana nem confirma as âncoras completas do PBL3.

## Verificação

`npm run build` verifica TypeScript e gera a aplicação. `test-browser.cjs` testa o site publicado pelo Chrome instalado neste Windows: edição, persistência, exportação, isolamento entre sessões, bloqueio de origem externa, celular e geração real. Esse teste consome uma rodada de inferência; execute somente quando necessário. Capturas e resultados ficam em `test-results/`, ignorado pelo Git.

O script aceita `MRCC_TEST_URL` para outra instância. As ferramentas WebMCP são registradas somente quando o navegador oferece `document.modelContext`; essa API opcional não é necessária para usar o site.

Para conferir a repetição do mesmo exemplo, salve o resultado de `test-browser.cjs` como `test-results/llm-primeira-4b.json` e execute `node test-repeat.cjs`. Ele cria outra sessão, gera com as mesmas entradas e compara competências, decisões e ações. Isso mede estabilidade nesse caso; não valida a eficácia científica das recomendações.
