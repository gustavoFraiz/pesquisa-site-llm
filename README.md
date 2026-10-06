# Recomendação local para o MRCC-PV

Protótipo da etapa M4 da Matriz de Redesenho de Cargos e Competências para Pequenos Varejistas. Lê as respostas da planilha, calcula lacunas e usa uma LLM local para propor ações de desenvolvimento ao gestor.

Também disponível como site em **https://147.15.89.156**, com preenchimento direto, sessão anônima, histórico e inferência na própria VM. Consulte [SITE_WEB.md](SITE_WEB.md) para uso e manutenção; o código Next.js está em `web/`.

Modelo inicial: **Qwen3 4B quantizado, via Ollama**. O pacote padrão tem cerca de 2,5 GB; memória de execução é maior e depende do contexto. A RTX 2070 de 8 GB e os 16 GB de RAM permitem testar essa configuração. Velocidade e qualidade precisam ser avaliadas neste computador. Não é necessário treinar o modelo para este protótipo.

## Executar no PowerShell

Ao clonar este repositório em outro computador, crie o ambiente Python na raiz antes de executar os comandos:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Para a interface web, instale também Node.js 24 LTS e Ollama com `qwen3:4b`. Depois, em `web`, execute `npm ci` e `npm run dev`. O formulário fica em http://localhost:3000; as orientações de produção e os serviços da VM estão em [SITE_WEB.md](SITE_WEB.md) e `deploy/`.

Nesta pasta, o ambiente Python já foi preparado. Para consultar somente o diagnóstico:

```powershell
.\.venv\Scripts\python.exe recomendar.py 'MRCC-PV_Exemplo_Preenchido_1 (1).xlsx'
```

Para gerar as recomendações com o modelo local:

```powershell
.\.venv\Scripts\python.exe recomendar.py 'MRCC-PV_Exemplo_Preenchido_1 (1).xlsx' --modo llm
```

Neste computador, usamos a unidade E: para o software e os pesos porque C: estava sem espaço. O inicializador abaixo configura `.runtime/models` dentro do projeto, inicia o servidor oculto se necessário e executa a recomendação:

```powershell
powershell -ExecutionPolicy Bypass -File .\executar.ps1
```

Para outra planilha, acrescente `-Planilha 'caminho.xlsx'`. Para somente análise, acrescente `-Modo analise`. Se já houver outro servidor Ollama na porta 11434, o inicializador o utiliza; nesse caso a localização dos pesos e as configurações são as desse servidor. A configuração de diretório feita pelo script vale para o servidor iniciado por ele, sem alterar as variáveis permanentes do Windows.

Cada execução cria uma pasta em `resultados/` com:

- `analise.json`: respostas normalizadas, prioridades, propostas e metadados.
- `relatorio.md`: relatório legível, com evidências e sugestões.
- `MRCC-PV_com_propostas.xlsx`: cópia da planilha com uma aba adicional, quando há plano.
- `prompt.json` e `resposta_llm_*.json`: registro da inferência, quando a LLM é chamada.
- `prompt_tentativa_*.json`: mensagem exata enviada em cada tentativa, incluindo correções.
- `contexto_pbl4.json`: trechos originais usados, referências de seção e hash do PBL4.
- `avaliacao_humana.json`: ficha em branco para avaliar adequação, relação com a tarefa, critério, salvaguardas e fidelidade às evidências.

O arquivo de entrada é preservado. Na cópia, os XML das abas originais são mantidos byte a byte, preservando inclusive extensões de validação que o openpyxl não consegue regravar. A aba M4 preenchida continua disponível para comparação. `openpyxl` pode emitir um aviso sobre essas extensões durante a leitura; a exportação evita regravar as abas originais.

Para instalar em outro computador:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
winget install --id Ollama.Ollama --exact --source winget
```

Abra o Ollama e, em um novo terminal, baixe o modelo:

```powershell
ollama pull qwen3:4b
```

Alternativamente, inicie o servidor com `ollama serve`. O script usa somente `http://127.0.0.1:11434/api/chat` e não envia as respostas para uma API externa. O download do software e dos pesos usa internet. Para trocar por outro modelo local, primeiro baixe-o e depois use `--modelo nome:tag`; a compatibilidade com `think: false` depende do modelo.

## Como a recomendação funciona

1. M1 fornece tarefas, frequência, criticidade e efeito da IA; M2 fornece competências e níveis; Legenda fornece os pesos.
2. O Python calcula `lacuna = max(0, alvo - atual)` e `score = lacuna * 10 + peso criticidade + peso frequência`. Prioridade alta para lacuna >= 2, média para 1 e nenhuma para 0. Ordenação por score decrescente, com desempate estável pelo ID da linha.
3. Somente as competências com lacuna positiva seguem para recomendação. A LLM recebe as respostas, o catálogo, as salvaguardas e trechos de RF09/RF10/RNF08/UC6/UC7 extraídos do PBL4 em Word. M4 existente fica oculto por padrão, para evitar que a LLM copie as escolhas e critérios usados na comparação manual. Seus responsáveis registrados ainda integram a lista de responsáveis permitidos. A CLI aceita `--pbl4 caminho.docx` para especificar o documento. Para uma revisão assistida da trilha já preenchida, use `--incluir-trilha-contexto` e identifique essa condição no experimento.
4. A LLM escolhe uma ação de catálogo no mesmo eixo, ou no eixo Geral, e redige justificativa, responsável, prazo, orientação e critério de conclusão. O responsável deve estar registrado em M4 ou ser a função genérica Gestor. O prompt fornece critérios de demonstração autônoma para N2 e de justificativa crítica e reconhecimento de limites para N3; são diretrizes propostas de avaliação, sujeitas à discussão com o orientador.
5. Pydantic valida o JSON; o Python verifica cobertura, ordem e compatibilidade das ações. Uma resposta inválida recebe uma tentativa de correção. Falha persistente gera erro; não há substituição silenciosa por texto atribuído à LLM.
6. Cada lacuna recebe uma decisão: `recomendada`, `sem_acao_adequada` ou `dados_insuficientes`. Nas abstenções, ação, responsável, prazo e critério são nulos; o gestor precisa completar UC6. A exceção do PBL4 que permite ação livre continua reservada ao gestor.
7. As propostas são exportadas para revisão humana. Salvaguardas diferentes de Sim sem ajuste registrado aparecem como pendências. A geração não encerra o ciclo nem confirma UC7: a planilha não contém respostas separadas de gestor e ocupante.

Os IDs das ações são derivados de eixo e descrição, permanecendo estáveis quando as linhas do catálogo são reordenadas. Alterar eixo ou descrição gera outro ID. O JSON também registra a cadeia tarefa → competência → lacuna → ação e os requisitos de referência. Essa rastreabilidade é anexada pelo Python, não inventada pela LLM. As versões anteriores dos resultados conservam seus IDs antigos.

A aba de propostas inclui uma coluna adicional com ajustes e diretriz de uso crítico copiados da Salvaguarda, com as fontes, para o gestor conferir a aplicabilidade. Assim, a revisão não depende de a LLM repetir corretamente a política da loja. O resumo é fixado pelo programa/schema para evitar alegações de progresso não observado; os demais textos continuam exigindo revisão. A ficha de avaliação proposta não equivale aos onze indicadores do PBL3.

Não usamos o cache de fórmulas do Excel: ele pode estar desatualizado. Na planilha original, lacunas negativas ficariam com prioridade Média; o protótipo considera nível atual superior ao alvo como lacuna zero. Essa extensão deve ser explicitada na metodologia. O programa pressupõe os nomes e as colunas deste modelo de planilha. Cada competência está ligada a uma única tarefa; associações múltiplas exigiriam uma extensão do instrumento.

R$ 0 no catálogo indica custo informado do recurso, não ausência de custo de tempo de trabalho. Prazo e responsável são sugestões. Os textos do modelo ainda podem conter extrapolações: validação estrutural não assegura adequação pedagógica, segurança, cumprimento de toda salvaguarda ou eficácia da ação. O gestor deve revisar as propostas antes de aplicá-las.

## Validação técnica

```powershell
.\.venv\Scripts\python.exe -m unittest -v
```

Os testes verificam cálculos do exemplo, mudanças nas respostas sem depender de caches, pendências, rejeição de ações inventadas, cobertura, formato da chamada local e preservação das abas originais. O teste de transporte usa uma resposta simulada explicitamente identificada; ele não substitui uma execução real nem uma avaliação com gestores.

Para testar a LLM real com um catálogo vazio, depois de iniciar o Ollama:

```powershell
.\.venv\Scripts\python.exe validar_llm.py 'MRCC-PV_Exemplo_Preenchido_1 (1).xlsx'
```

O teste cria uma entrada sintética identificada e verifica se a LLM se abstém nas três lacunas. Não altera a planilha nem exporta essa simulação como recomendação real. Se todas as competências estão sem candidatas, o schema permite somente `sem_acao_adequada` e campos de plano nulos. Os 17 testes automatizados de regressão incluem essa restrição, abstenção, extração dos trechos do PBL4, estabilidade dos IDs, ocultação de M4, resumo sem alegações de progresso e uso do limite de checagem registrado na planilha, sem valor fixo no prompt.

## Fontes técnicas

- [Qwen3 4B no Ollama](https://ollama.com/library/qwen3:4b).
- [API local de chat](https://docs.ollama.com/api/chat).
- [JSON estruturado e validação](https://docs.ollama.com/capabilities/structured-outputs).

Consulte `ANALISE_CIENTIFICA.md` para a análise da etapa final e uma proposta de avaliação do artefato.

Consulte `VALIDACAO_PBL4.md` para os testes atuais da versão 1.1, a execução sem acesso a M4 e as limitações observadas no conteúdo. Os resultados e a ficha de revisão atual estão em `resultados/20261006T002605513490Z`.

## Resultado inicial observado neste computador (versão 1.0)

A execução em `resultados/20261006T001047504968Z` produziu três propostas válidas em 14,36 segundos, com o modelo já carregado. Foram 4.459 tokens de entrada e 1.156 de saída. O Ollama informou Q4_K_M, contexto de 8.192 tokens e aproximadamente 3,87 GB do modelo em VRAM. Isso é uma medição deste exemplo, não uma garantia de tempo para outros casos; a primeira carga foi mais lenta.

Oito testes técnicos passaram. A revisão do texto encontrou melhora nos critérios de revisão de orçamento e julgamento N3, mas também extrapolações na interpretação das salvaguardas e uma ação teórica que precisa ser complementada por prática. Veja `REVISAO_DO_RESULTADO.md` antes de aplicar o plano. As execuções anteriores permanecem nas respectivas pastas como registro do desenvolvimento, inclusive a tentativa rejeitada por cobertura incompleta.
