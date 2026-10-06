# Análise da etapa de recomendação do MRCC-PV

Esta análise se refere à planilha que se identifica como **exemplo preenchido** para atendente de balcão de uma loja de material de construção. As linhas representam tarefas e competências da função, não uma amostra de participantes. Não há dados para inferência estatística, generalização ou demonstração de eficácia. O PBL4 em Word foi disponibilizado e passou a orientar a extensão de M4; o PBL3, mencionado nele, ainda não foi disponibilizado.

## Aderência ao PBL4

O protótipo apoia a decisão do gestor em UC6. RF09 exige ação por lacuna prioritária, RF10 exige evidência observável e RNF08 exige a cadeia Tarefa → Competência → Lacuna → Ação. Os trechos correspondentes são extraídos diretamente dos quadros do DOCX, identificados por seção/requisito e registrados com o hash do documento em cada execução. A fórmula numérica do score vem da planilha; o PBL4 descreve os fatores de priorização, mas não especifica essa expressão.

UC6 permite que o gestor descreva uma ação livre quando nenhuma ação do catálogo se aplica. Como escolha de implementação, a LLM continua restrita ao catálogo: retorna `sem_acao_adequada` e encaminha ao gestor, sem inventar a ação livre. Outra saída possível é `dados_insuficientes`. Ambas deixam ação, responsável, prazo e critério nulos, com justificativa e orientação para completar UC6. O resultado é uma decisão pendente, não uma trilha completa.

UC7 exige respostas separadas do gestor e do ocupante, registro de divergências e ajustes para respostas negativas. A coluna única da planilha não comprova esse procedimento; o programa informa validação bilateral não verificada mesmo quando todos os ajustes exigidos foram registrados. Não emite parecer automático de conformidade.

A relação N:N entre tarefas e competências prevista na seção 3 não está representada integralmente neste modelo de planilha. O protótipo mantém uma tarefa associada por competência; não introduz uma regra de agregação de criticidade/frequência sem definição metodológica. As âncoras completas de N0–N3 e os onze indicadores são remetidos ao PBL3. As sugestões de critérios para N2/N3 do protótipo não substituem essas definições. A inclusão de uma LLM é uma extensão proposta, não requisito expresso do PBL4.

## Diagnóstico extraído

| Competência | Atual | Alvo | Lacuna | Score | Prioridade |
|---|---|---|---:|---:|---|
| Letramento em IA | N0 | N2 | 2 | 26 | Alta |
| Proficiência na ferramenta de orçamento | N1 | N2 | 1 | 16 | Média |
| Julgamento em situação de atendimento difícil | N2 | N3 | 1 | 15 | Média |
| Adaptabilidade a novos fluxos de trabalho | N2 | N2 | 0 | 5 | Nenhuma |

O score soma dez vezes a lacuna aos pesos de criticidade e frequência. Com os pesos atuais, a lacuna domina a ordenação; frequência e criticidade refinam a ordem dentro da mesma lacuna. É uma regra de decisão do instrumento, não uma estimativa estatística de risco ou de probabilidade de sucesso.

## Leitura crítica de M4

**Letramento em IA:** a ação de três sessões de 40 minutos é compatível com o eixo. Entretanto, o critério atual, “monta um orçamento com a IA sem apoio”, avalia principalmente operação. A competência está vinculada à tarefa nova de **revisar o orçamento gerado pela IA**. Sugestão metodológica: verificar se o atendente identifica e corrige erros em exemplos preparados para avaliação, confere preço e estoque nas fontes internas e explica a razão da revisão. Essa atividade é uma proposta de avaliação, não um resultado observado nem evidência automática de que atingiu N2.

**Proficiência técnica:** prática assistida duas vezes por semana e revisão pelo gerente são coerentes com a tarefa aprimorada. O critério “sem erro de preço” pode ser ampliado para conferência dos demais campos relevantes do orçamento, conforme a política real da loja. A autonomia precisa ser demonstrada em uma atividade observável, não presumida a partir da participação nas sessões.

**Julgamento no atendimento difícil:** acompanhar o gerente pode fornecer exemplos úteis. Contudo, “resolve uma reclamação sozinho” não demonstra, por si só, o nível de usuário crítico N3. Sugestão: usar situações de avaliação em que o atendente justifique a decisão, explique os limites da negociação e reconheça quando precisa encaminhar ao gerente. Não inventar limites de desconto ou políticas comerciais ausentes da planilha.

**Adaptabilidade:** lacuna zero justifica sua ausência da trilha nesta rodada. Pode haver acompanhamento do trabalho, mas não há evidência no instrumento para priorizar treinamento nessa competência.

**Salvaguarda:** “Significado da tarefa” recebeu Não, com ajuste já registrado: explicar que a checagem evita erro de preço e prejuízo. Esse ajuste deve integrar a ação de letramento, com verificação de compreensão pelo atendente. Registro do ajuste não comprova execução. A orientação de checagem manual para orçamento acima de R$ 2.000 também deve acompanhar as propostas relativas ao orçamento; esse valor provém de Salvaguarda!E7, não de regra criada pelo modelo. Ele não elimina a revisão habitual dos demais orçamentos.

Os prazos de 30 e 60 dias de M4 já são decisões do exemplo. A LLM pode sugerir sua manutenção ou revisão com justificativa, mas a viabilidade depende da disponibilidade real do gestor e do atendente. O limite de 90 minutos mencionado nas instruções se refere à aplicação do instrumento, não ao período total de desenvolvimento.

## Papel da LLM no artefato

Uma abordagem híbrida preserva a rastreabilidade: o programa calcula as lacunas e a prioridade; a LLM contextualiza a ação do catálogo e explica como verificar sua conclusão. Não é necessário usar fine-tuning ou um banco vetorial para o catálogo de oito ações deste exemplo. O JSON estruturado facilita verificar a resposta e preencher uma aba de propostas, mas não elimina a necessidade de avaliação humana do conteúdo.

Pergunta de pesquisa sugerida: **a recomendação assistida por LLM melhora a adequação, a clareza e a aplicabilidade de M4, mantendo aderência ao catálogo e às salvaguardas?** A formulação é uma proposta para discutir com o orientador, não uma conclusão do experimento.

## Proposta de avaliação para a graduação

Compare a trilha manual e a trilha assistida usando exatamente as mesmas respostas de M1, M2 e Salvaguarda. Use diferentes casos ou funções e, quando possível, apresente as duas alternativas em ordem alternada e sem identificar qual veio da LLM. Separe avaliação da qualidade da recomendação de avaliação do desenvolvimento efetivo do trabalhador.

Para comparação independente, não envie as ações, os prazos e os critérios já escolhidos em M4 à LLM. O programa agora os oculta por padrão; mantém a trilha no diagnóstico para o avaliador e aproveita apenas os responsáveis como opções registradas. As primeiras execuções incluíam M4 no contexto, portanto coincidência com suas escolhas não demonstra acerto independente. O modo opcional `--incluir-trilha-contexto` serve para revisão assistida e deve ser avaliado separadamente.

| Dimensão | Evidência sugerida |
|---|---|
| Aderência ao instrumento | Percentual de propostas com competência elegível e ação válida do catálogo; pendências de salvaguarda identificadas |
| Adequação à tarefa | Avaliação do gestor/orientador sobre relação entre lacuna, ação e critério, com escala e descritores definidos previamente |
| Clareza e aplicabilidade | Nota do gestor, justificativa e registro das alterações necessárias |
| Salvaguardas | Verificação manual de incorporação dos ajustes e regras aplicáveis, inclusive checagem acima de R$ 2.000 |
| Esforço | Tempo para construir e revisar M4; tempo do ciclo completo se houver medição dos seis passos |
| Confiabilidade | Taxa de JSON inválido, ações inventadas, omissões e extrapolações no texto; número de novas tentativas |
| Desenvolvimento observado | Avaliação antes e depois com tarefas comparáveis, realizada após aplicar as ações; não inferir mudança apenas pelo texto da LLM |

Guarde versão do script, hash da planilha, modelo, opções, prompt, resposta bruta e avaliação humana. O protótipo registra os primeiros itens, a versão do Ollama e o digest dos pesos consultado na API local; avaliações humanas e execução das ações precisam ser coletadas no estudo. A tag do modelo pode ser atualizada pelo distribuidor, por isso o digest deve integrar o registro experimental. Temperatura zero e seed fixa ajudam o controle, mas não garantem reprodução idêntica entre versões e hardware.

Com poucos casos, uma análise descritiva e qualitativa pode ser mais apropriada do que testes estatísticos. A escolha de amostra, rubrica e procedimento deve ser estabelecida com o orientador conforme o objetivo do estudo. Este exemplo valida o fluxo técnico; ele não comprova que o gestor tomará decisões melhores ou que o trabalhador desenvolverá as competências.
