# MRCC-PV publicado na Oracle

Endereço: **https://147.15.89.156**

## Uso

O acesso exige login. A equipe da pesquisa (admin) cadastra cada empresa com o e-mail do gestor e entrega a senha temporária, que é trocada no primeiro acesso.

1. **Admin** (`/admin`): cadastra empresas, gera nova senha temporária e desativa ou reativa o acesso.
2. **Gestor** (`/`): vê as funções da loja e cria uma nova a partir de um **modelo pronto**, copiando outra função da loja, em branco, importando a planilha MRCC-PV ou **descrevendo a função com as próprias palavras** (a IA sugere as tarefas para revisão; leva de 1 a 2 minutos e entra na mesma fila das trilhas). No primeiro acesso, informa as **ferramentas de IA** da loja (também em `/ferramentas`); elas aparecem como sugestão nas tarefas.
3. Em cada função, preenche Tarefas (botões e linguagem simples; sem ferramenta, o efeito vira "Não mudou"), Competências e Salvaguarda. A etapa Competências **sugere competências a partir das tarefas** (RF05), com o motivo de cada uma, e lista o que **deixa de ser central** (RF07). O salvamento é automático.
4. Na etapa Ocupantes, adiciona cada pessoa por apelido, sem dados pessoais. Na página do ocupante, responde **três perguntas de sim/não** por competência (Quadro 4 do PBL3) ou escolhe o nível diretamente; dá para copiar os níveis de outro ocupante.
5. Clica em **Gerar recomendações**. Os pedidos entram em uma fila (uma geração por vez na VM, uma por loja). A página mostra a posição e o resultado.

O histórico de análises fica em cada ocupante. **Baixar relatório (PDF)** produz o documento A4 a partir da análise salva, sem nova inferência. Os downloads só são liberados para a empresa dona da análise (e para o admin).

O tempo ativo de preenchimento de cada função e de cada ocupante é registrado para o indicador de RNF01 (até 90 minutos por função).

O admin mantém os **modelos de cargo** (`/admin/modelos`, inclusive promovendo a função de uma loja a modelo) e o **catálogo da pesquisa** (`/admin/catalogo`). Cada loja pode incluir ações próprias em `/acoes`; o motor recebe as ativas do catálogo e da loja (até 40), sem repetições. O conteúdo dos modelos Operador(a) de caixa, Vendedor(a), Estoquista/Repositor e Atendimento online é proposta da equipe e deve ser revisado pelo grupo.

**Síntese da função (RF12):** em cada função, "Ver síntese da função" mostra numa página o mapa de efeitos, as competências, a salvaguarda e as lacunas de cada ocupante, com o PDF da última trilha.

**Pesquisa (admin):** `/admin/metricas` traz, por função, tempo ativo de preenchimento (meta de 90 min do RNF01), cobertura do diagnóstico, densidade de lacunas, completude da trilha, diretriz de uso crítico, alerta de preservação, facilidade percebida (nota de 1 a 5 pedida ao gestor depois da primeira trilha) e o efeito dos recursos de agilidade (origem das tarefas e competências e quanto foi editado). "Baixar CSV" abre direto no Excel. Em `/admin`, o nome da loja leva à leitura das funções dela, inclusive arquivadas.

As análises anônimas feitas antes do login continuam no banco e nas pastas de `web/data/`, mas não aparecem mais no site.

O layout usa blocos por ação, quadro de responsável/prazo/custo, critério de conclusão em destaque e tabela de salvaguardas. O cache interno é versionado (`relatorio-v2.pdf`), enquanto o download mantém o nome `relatorio.pdf`; assim, relatórios já baixados no layout anterior recebem a apresentação nova no próximo download.

## Instalação e serviços

Código local: `web/`, `web_bridge.py`, `web_llm.py`, `relatorio_pdf.py`, `recomendar.py` e `metodologia.py`.
Código ativo na VM: `/home/ubuntu/mrcc-deploy/current`. A instalação original em `/home/ubuntu/mrcc-pv` preserva o armazenamento das sessões e a versão inicial.

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

Depois de alterar o site, envie uma branch e abra um PR para `main`. Os checks precisam passar antes do merge; a VM é atualizada automaticamente após a validação da `main`. Consulte [DEPLOY_GITHUB.md](DEPLOY_GITHUB.md) para o fluxo e a manutenção do publicador.

Aguarde terminar uma geração ativa antes de reiniciar. Preserve `web/data/` nas atualizações. Para copiar o SQLite com a aplicação rodando, use a API de backup do SQLite; copiar apenas o arquivo principal enquanto WAL está ativo pode perder alterações. Inclua também as subpastas de análises em seus backups. A chave SSH, cookies e dados privados não devem ser versionados.

## Limites da pesquisa

A ordenação das lacunas é calculada pelo código; a LLM propõe ações permitidas pelo catálogo. Ela roda na VM e não recebe a trilha manual preenchida como exemplo de resposta. Esquema, IDs e campos obrigatórios são validados, mas o texto e a adequação pedagógica continuam dependendo da avaliação humana descrita em `VALIDACAO_PBL4.md`. A interface registra uma resposta por âncora e não comprova, sozinha, validação bilateral de UC7.

Na web, a LLM seleciona uma ação do catálogo e escreve uma justificativa curta. O código monta o restante: critérios vinculados à tarefa e ao nível-alvo, responsável inicial Gestor, prazo informado no formulário (14 dias por padrão) e orientações de revisão. Essas referências continuam sendo propostas para revisão; não são âncoras do PBL3 já validadas.

O seletor usa somente tarefas, níveis, ações candidatas e ajustes do trabalho, com resposta JSON curta, temperatura zero e validação da associação entre ação e competência. O diagnóstico completo, PBL4 e respostas originais permanecem nos arquivos da análise. O seletor não lê todos os trechos metodológicos em cada inferência; as regras verificáveis são aplicadas pelo código. Os metadados registram tempo, modelo, tokens e quais campos foram produzidos pela LLM.

## Tempo e qualidade

Com três lacunas do exemplo preenchido, o Qwen3:4b levou **124,26 segundos** na VM ARM de dois núcleos, em uma tentativa: 1.021 tokens de entrada e 170 de saída, contexto 3.072 e duas threads. As ações selecionadas foram prática em casos reais para letramento em IA, prática assistida de orçamento e simulação de atendimento difícil. A revisão do exemplo encontrou correspondência entre atividades, tarefas e justificativas.

A repetição com as mesmas entradas levou **43,38 segundos**, com modelo/contexto já carregados e reaproveitamento de contexto pelo Ollama. As três decisões e ações foram iguais; a justificativa de letramento teve uma pequena mudança de redação. Esse ganho não deve ser presumido para formulários diferentes. Ambas as execuções concluíram sem repetir por erro de validação.

O modelo de 1,7B foi mais rápido, mas confundiu justificativas entre tarefas; por isso o serviço usa 4B. Esta medição é de um exemplo, não um limite garantido: formulários maiores e uma repetição por saída inválida podem demorar mais. As referências e os campos montados pelo código reduzem variação; a adequação das propostas precisa de avaliação humana em outros casos.
