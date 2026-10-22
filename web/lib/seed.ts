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
