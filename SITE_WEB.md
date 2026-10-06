# MRCC-PV publicado na Oracle

Endereço: **https://147.15.89.156**

## Uso

1. Abra o site. Uma sessão anônima é criada automaticamente.
2. Preencha a função, suas tarefas e os efeitos da IA. Para experimentar com os dados da pesquisa, use **Carregar exemplo preenchido**.
3. Informe competências, tarefa associada, nível atual e nível-alvo.
4. Registre as respostas e ajustes de Salvaguarda.
5. Abra **Trilha de ações** e clique em **Gerar recomendações**. Revise as propostas na própria página.

O rascunho é salvo automaticamente na sessão; aguarde a indicação de salvamento antes de fechar a página. O histórico permanece disponível naquele navegador durante a sessão de 30 dias. Limpar cookies perde o acesso. Exportações Excel, relatório e JSON são opcionais.

**Baixar relatório (PDF)** produz um documento A4 com prioridades, propostas, salvaguardas, referências e páginas numeradas. O PDF é gerado a partir da análise salva no primeiro download e fica disponível também no histórico anterior à atualização, sem nova inferência. O acesso continua restrito à sessão que criou a análise. O Markdown permanece nos arquivos internos do motor.

O layout usa blocos por ação, quadro de responsável/prazo/custo, critério de conclusão em destaque e tabela de salvaguardas. O cache interno é versionado (`relatorio-v2.pdf`), enquanto o download mantém o nome `relatorio.pdf`; assim, relatórios já baixados no layout anterior recebem a apresentação nova no próximo download.

## Instalação e serviços

Código local: `web/`, `web_bridge.py`, `web_llm.py`, `relatorio_pdf.py`, `recomendar.py` e `metodologia.py`.
Código na VM: `/home/ubuntu/mrcc-pv`.

| Componente | Configuração na VM |
| --- | --- |
| Site | Next.js, React e Node 24 LTS; `mrcc-pv.service` |
| LLM | Qwen3:4b quantizado, Ollama, CPU com 2 threads; `ollama.service` |
| Persistência | SQLite `web/data/sessions.sqlite`, WAL; arquivos por análise em `web/data/<UUID>/` |
| Rede | Nginx em 80/443; Next em 127.0.0.1:3000, Ollama em 127.0.0.1:11434 |
| HTTPS | Let's Encrypt para o IP, renovação automática; `mrcc-cert-renew.timer` |
| Firewall | Regras aditivas para 80/443; `mrcc-firewall.service` |

Todos esses serviços iniciam automaticamente. O servidor Minecraft `akashic` foi parado pelo console com salvamento dos mundos, conforme autorizado.

As configurações implantadas de Nginx, systemd, Ollama e firewall estão em `deploy/`. A renovação do certificado recarrega o Nginx automaticamente.

## Manutenção pelo PowerShell

```powershell
Set-Location 'E:\llm-projeto'
ssh -F .\.ssh\config oracle-mrcc
```

Na VM:

```bash
sudo systemctl status mrcc-pv ollama nginx --no-pager
sudo journalctl -u mrcc-pv -n 80 --no-pager
sudo journalctl -u ollama -n 80 --no-pager
sudo systemctl list-timers mrcc-cert-renew.timer --no-pager
```

Depois de alterar o site, transfira os arquivos modificados e, na VM:

```bash
cd /home/ubuntu/mrcc-pv/web
NEXT_TELEMETRY_DISABLED=1 npm ci --no-audit --no-fund
NEXT_TELEMETRY_DISABLED=1 npm run build
sudo systemctl restart mrcc-pv
```

Aguarde terminar uma geração ativa antes de reiniciar. Preserve `web/data/` nas atualizações. Para copiar o SQLite com a aplicação rodando, use a API de backup do SQLite; copiar apenas o arquivo principal enquanto WAL está ativo pode perder alterações. Inclua também as subpastas de análises em seus backups. A chave SSH, cookies e dados privados não devem ser versionados.

## Limites da pesquisa

A ordenação das lacunas é calculada pelo código; a LLM propõe ações permitidas pelo catálogo. Ela roda na VM e não recebe a trilha manual preenchida como exemplo de resposta. Esquema, IDs e campos obrigatórios são validados, mas o texto e a adequação pedagógica continuam dependendo da avaliação humana descrita em `VALIDACAO_PBL4.md`. A interface registra uma resposta por âncora e não comprova, sozinha, validação bilateral de UC7.

Na web, a LLM seleciona uma ação do catálogo e escreve uma justificativa curta. O código monta o restante: critérios vinculados à tarefa e ao nível-alvo, responsável inicial Gestor, prazo informado no formulário (14 dias por padrão) e orientações de revisão. Essas referências continuam sendo propostas para revisão; não são âncoras do PBL3 já validadas.

O seletor usa somente tarefas, níveis, ações candidatas e ajustes do trabalho, com resposta JSON curta, temperatura zero e validação da associação entre ação e competência. O diagnóstico completo, PBL4 e respostas originais permanecem nos arquivos da análise. O seletor não lê todos os trechos metodológicos em cada inferência; as regras verificáveis são aplicadas pelo código. Os metadados registram tempo, modelo, tokens e quais campos foram produzidos pela LLM.

## Tempo e qualidade

Com três lacunas do exemplo preenchido, o Qwen3:4b levou **124,26 segundos** na VM ARM de dois núcleos, em uma tentativa: 1.021 tokens de entrada e 170 de saída, contexto 3.072 e duas threads. As ações selecionadas foram prática em casos reais para letramento em IA, prática assistida de orçamento e simulação de atendimento difícil. A revisão do exemplo encontrou correspondência entre atividades, tarefas e justificativas.

A repetição com as mesmas entradas levou **43,38 segundos**, com modelo/contexto já carregados e reaproveitamento de contexto pelo Ollama. As três decisões e ações foram iguais; a justificativa de letramento teve uma pequena mudança de redação. Esse ganho não deve ser presumido para formulários diferentes. Ambas as execuções concluíram sem repetir por erro de validação.

O modelo de 1,7B foi mais rápido, mas confundiu justificativas entre tarefas; por isso o serviço usa 4B. Esta medição é de um exemplo, não um limite garantido: formulários maiores e uma repetição por saída inválida podem demorar mais. As referências e os campos montados pelo código reduzem variação; a adequação das propostas precisa de avaliação humana em outros casos.
