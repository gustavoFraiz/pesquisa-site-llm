# Base de apresentação

A carga adiciona empresas, funções, ocupantes, tempos de preenchimento, avaliações de uso, ferramentas e histórico de trilhas para permitir demonstrar os fluxos administrativos e as métricas do sistema com dados completos.

A carga é idempotente e não altera registros já existentes fora dos identificadores reservados para essa base.

As datas são calculadas na carga. `MRCC_SEED_DATA=AAAA-MM-DD` define o primeiro dia da base; sem essa variável, os 21 dias da base terminam no dia atual. A data só vale na primeira carga: registros já existentes não mudam.
