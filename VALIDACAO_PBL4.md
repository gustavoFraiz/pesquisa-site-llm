# Validação técnica e revisão das recomendações — PBL4

## Resultado atual

Versão 1.1, prompt `m4-pbl4-v3`, Qwen3 4B via Ollama local. Dezessete testes automatizados passaram. O exemplo foi executado sem enviar ações, prazos e critérios de M4 à LLM. A trilha manual continua no diagnóstico para comparação posterior; os responsáveis registrados continuam disponíveis como opções.

Execução do exemplo: `resultados/20261006T002605513490Z`. Tempo de inferência registrado: 17,81 segundos; uma tentativa; 5.458 tokens de entrada e 1.123 de saída. Consulte `analise.json` para os metadados completos e o hash do documento/modelo. Os XML das oito abas de entrada e o arquivo original foram preservados. A aba adicional contém três decisões, referências aos requisitos e as salvaguardas copiadas pelo programa.

Teste sintético sem catálogo: `resultados/validacao_sem_catalogo_20261006T002644743297Z`. Passou com três decisões `sem_acao_adequada`, sem inventar atividade, responsável, prazo ou critério. Tempo: 18,37 segundos, uma tentativa. Nesse cenário o próprio schema só admite abstenção; isso verifica a proteção técnica, não comprova capacidade de julgar a adequação de ações disponíveis.

## Revisão técnica do texto

Esta revisão foi feita pelo assistente sobre os resultados, não por gestor/especialista participante da pesquisa. Não constitui aprovação nem medição de desenvolvimento do trabalhador.

| Competência | Ação escolhida | Leitura do resultado |
|---|---|---|
| Letramento em IA | Três sessões de 40 minutos com casos reais | Ação prática compatível com o eixo. Critério agora avalia revisão, identificação/correção de erros e explicação da finalidade, em vez de apenas montagem. Prazo sugerido de 15 dias precisa de confirmação. A justificativa afirma que a ação “resolve” a lacuna; isso é uma extrapolação, pois não houve aplicação ou avaliação |
| Proficiência técnica | Prática assistida duas vezes por semana, com revisão do gerente | Critério ligado à montagem do orçamento com revisão posterior. Prazo sugerido de 10 dias depende da agenda. A orientação fala em “2 sessões”, embora o catálogo descreva frequência de duas vezes por semana. O gestor deve manter a frequência do catálogo e definir a duração; a regra de checagem acima de R$ 2.000 aparece na coluna de salvaguardas copiada pelo programa |
| Julgamento no atendimento difícil | Um dia por semana no atendimento de reclamações com o gerente | Critério considera negociação de prazos, justificativa, limites e encaminhamento. É uma sugestão de avaliação N3 do protótipo, ainda dependente de confirmação das âncoras do PBL3. Prazo sugerido de 20 dias e a orientação de observar um dia de rodízio não comprovam aquisição da competência |

As três escolhas coincidem com as ações de M4 do exemplo, mesmo sem acesso a elas no contexto desta execução. Isso é uma observação de um único caso, não uma taxa de acerto generalizável. O modelo ainda recebeu o mesmo catálogo, níveis, tarefas e salvaguardas, além das sugestões de avaliação do protótipo.

## O que foi corrigido durante os testes

- As primeiras execuções usavam M4 como contexto. Elas servem para testar revisão assistida; não devem ser usadas como evidência de concordância independente.
- A LLM chegou a atribuir ajustes às salvaguardas 4 e 6, embora a planilha só registre ajuste na âncora 3. As instruções foram revisadas e as orientações originais passaram a acompanhar a proposta por cópia determinística. Isso não garante que todo texto da LLM seja fiel às evidências.
- Um teste inicial de catálogo vazio passou. Após mudanças no prompt/schema, uma repetição retornou decisões `recomendada` com campos nulos e foi rejeitada após duas tentativas. Os registros estão em `resultados/validacao_sem_catalogo_20261006T002503894145Z`. Reforçamos o schema para permitir somente `sem_acao_adequada` quando todas as lacunas estão sem candidatas e repetimos o teste, que passou. A tentativa rejeitada permanece registrada nas respostas brutas.
- O resumo foi fixado no schema para não inventar progresso ou parecer de conformidade. Justificativas e orientações ainda são geradas e precisam ser revisadas.

## Próxima avaliação

Preencha `avaliacao_humana.json` da execução do exemplo com avaliação do gestor ou orientador. A ficha propõe os critérios adequação da ação, aderência à tarefa, evidência observável, salvaguardas e fidelidade às respostas, além da decisão de aprovação do gestor. É uma rubrica proposta, não os onze indicadores do PBL3.

Para ampliar a avaliação, use novos casos com catálogo compatível, atividades pouco adequadas e informações incompletas. O último estado é aceito e validado estruturalmente, mas a capacidade real da LLM de reconhecer dados insuficientes e candidatas inadequadas ainda não foi demonstrada nestes testes. Falta verificar as âncoras completas e os indicadores do PBL3 e aplicar UC7 com respostas separadas do gestor e do ocupante.

A conclusão desta rodada é que o fluxo técnico está operacional para avaliação. A qualidade e a eficácia da recomendação permanecem dependentes de avaliação humana e de aplicação do artefato.
