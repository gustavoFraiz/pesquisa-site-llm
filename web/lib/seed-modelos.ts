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
      ['Proficiência no assistente de conversa', 'Proficiência técnica', 1, 'N2'],
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
