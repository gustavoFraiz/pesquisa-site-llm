import type { DatabaseSync } from 'node:sqlite';
import type { Criticidade, Efeito, Eixo, Estrutura, Frequencia, Nivel, Niveis, Resposta } from './estrutura.ts';
import { transacao } from './db.ts';

const ID = (n: number): string => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SENHA_HASH = 'scrypt$131072$8$1$TCrWtLubRw9UcQk0XhnDiA==$aWRuLrj8AISl4E9LOXuRQdnUWhU6SKMTeQMjSz+kfG0=';

const empresas = [
  { id: 1001, nome: 'Materiais Nova Aurora', cidade: 'Curitiba', segmento: 'Material de construção', email: 'gestao@materiaisnovaaurora.com.br', criada: '2026-10-08T13:20:00.000Z', acesso: '2026-10-28T18:42:00.000Z' },
  { id: 1002, nome: 'Empório Cedro Azul', cidade: 'São José dos Pinhais', segmento: 'Mercado e conveniência', email: 'gerencia@emporiocedroazul.com.br', criada: '2026-10-09T16:10:00.000Z', acesso: '2026-10-27T20:15:00.000Z' },
  { id: 1003, nome: 'Ótica Vale Claro', cidade: 'Curitiba', segmento: 'Ótica e acessórios', email: 'contato@oticavaleclaro.com.br', criada: '2026-10-10T14:05:00.000Z', acesso: '2026-10-29T12:06:00.000Z' },
  { id: 1004, nome: 'Auto Peças Rota Sete', cidade: 'Pinhais', segmento: 'Autopeças', email: 'administracao@rotaseteautopecas.com.br', criada: '2026-10-11T17:30:00.000Z', acesso: '2026-10-26T19:54:00.000Z' },
  { id: 1005, nome: 'Casa Pet Ipê Roxo', cidade: 'Colombo', segmento: 'Pet shop', email: 'gestao@casapetiperoxo.com.br', criada: '2026-10-13T15:40:00.000Z', acesso: '2026-10-28T15:18:00.000Z' },
] as const;

type TarefaSeed = { texto: string; frequencia: Frequencia; criticidade: Criticidade; ferramenta: string; efeito: Efeito; origem?: 'manual' | 'ia' | 'planilha'; editada?: boolean };
type CompetenciaSeed = { texto: string; eixo: Eixo; tarefa: number; alvo: Nivel; origem?: 'manual' | 'regra' | 'planilha'; editada?: boolean };

type FuncaoSeed = {
  id: number; empresa: number; nome: string; origem: string; criada: string; tempo: number; nota: number; comentario: string;
  tarefas: TarefaSeed[]; competencias: CompetenciaSeed[]; perdas?: { tarefa: number; descricao: string }[]; salvaguardas: Resposta[];
  ocupantes: { id: number; apelido: string; tempo: number; prazo: number; niveis: Nivel[]; trilhas: number }[];
};

function montarEstrutura(f: FuncaoSeed): Estrutura {
  const tarefas = f.tarefas.map((t, i) => ({
    id: ID(f.id * 100 + i + 1), tarefa: t.texto, frequencia: t.frequencia, criticidade: t.criticidade,
    ferramenta: t.ferramenta, efeito_ia: t.efeito, origem: t.origem ?? 'manual', editada: t.editada ?? false,
  }));
  const competencias = f.competencias.map((c, i) => ({
    id: ID(f.id * 100 + 50 + i + 1), competencia: c.texto, eixo: c.eixo,
    tarefa_id: tarefas[c.tarefa]?.id ?? tarefas[0].id, alvo: c.alvo, origem: c.origem ?? 'manual', editada: c.editada ?? false,
  }));
  const observacoes = [
    'A função continua combinando atendimento, conferência e tomada de decisão.',
    'O profissional acompanha o atendimento do início ao fim e reconhece a entrega final.',
    'O impacto da atividade no cliente e na operação é discutido pela liderança.',
    'A pessoa mantém margem para decidir como conduzir situações fora do padrão.',
    'Há retorno do gestor e conferência do resultado em situações críticas.',
    'A equipe foi orientada a revisar informações antes de aceitar sugestões automatizadas.',
  ];
  return {
    versao: 1,
    tarefas,
    competencias,
    perdem_centralidade: (f.perdas ?? []).map((p, i) => ({
      id: ID(f.id * 100 + 80 + i + 1), descricao: p.descricao, tarefa_id: tarefas[p.tarefa]?.id ?? tarefas[0].id, origem: 'manual',
    })),
    salvaguardas: f.salvaguardas.map((resposta, i) => ({
      numero: i + 1, resposta, observacao: observacoes[i], ajuste: resposta === 'Não' ? 'Reforçar acompanhamento do gestor e registrar uma checagem humana no fluxo.' : '',
    })),
  };
}

const funcoes: FuncaoSeed[] = [
  {
    id: 2001, empresa: 1001, nome: 'Vendedor de balcão', origem: 'planilha', criada: '2026-10-09T13:40:00.000Z', tempo: 2480, nota: 5,
    comentario: 'O preenchimento ficou simples depois que as tarefas foram organizadas por frequência.',
    tarefas: [
      { texto: 'Consultar preço, estoque e prazo de entrega', frequencia: 'Diária', criticidade: 'Média', ferramenta: 'ERP da loja e assistente de consulta', efeito: 'A', origem: 'planilha' },
      { texto: 'Montar orçamento de materiais para o cliente', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Sistema de orçamento', efeito: 'P', origem: 'planilha', editada: true },
      { texto: 'Orientar o cliente sobre alternativas de produto', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Catálogo digital', efeito: 'I', origem: 'manual' },
      { texto: 'Revisar valores e condições antes do fechamento', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Sistema de orçamento', efeito: 'N', origem: 'manual' },
    ],
    competencias: [
      { texto: 'Interpretar sugestões geradas pelo sistema', eixo: 'Letramento em IA', tarefa: 1, alvo: 'N2', origem: 'regra' },
      { texto: 'Operar o fluxo de orçamento sem apoio constante', eixo: 'Proficiência técnica', tarefa: 1, alvo: 'N2', origem: 'planilha', editada: true },
      { texto: 'Adaptar a recomendação ao contexto do cliente', eixo: 'Adaptabilidade', tarefa: 2, alvo: 'N2' },
      { texto: 'Manter julgamento comercial em situações fora do padrão', eixo: 'Relacionais e de julgamento', tarefa: 2, alvo: 'N3' },
    ],
    perdas: [{ tarefa: 0, descricao: 'A consulta manual em tabelas impressas perdeu centralidade com a consulta integrada de estoque e preço.' }],
    salvaguardas: ['Sim', 'Sim', 'Sim', 'Sim', 'Sim', 'Sim'],
    ocupantes: [
      { id: 3001, apelido: 'Carlos', tempo: 910, prazo: 21, niveis: ['N1', 'N2', 'N2', 'N2'], trilhas: 2 },
      { id: 3002, apelido: 'Fernanda', tempo: 780, prazo: 14, niveis: ['N2', 'N2', 'N3', 'N2'], trilhas: 1 },
    ],
  },
  {
    id: 2002, empresa: 1001, nome: 'Assistente de orçamentos', origem: 'texto', criada: '2026-10-12T14:18:00.000Z', tempo: 1960, nota: 4,
    comentario: 'A descrição por texto acelerou o cadastro e exigiu poucos ajustes.',
    tarefas: [
      { texto: 'Receber lista de materiais enviada pelo vendedor', frequencia: 'Diária', criticidade: 'Média', ferramenta: 'Sistema interno', efeito: 'I', origem: 'ia', editada: true },
      { texto: 'Consolidar itens equivalentes e disponibilidade', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'ERP e catálogo', efeito: 'A', origem: 'ia' },
      { texto: 'Gerar proposta comercial inicial', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Sistema de orçamento com IA', efeito: 'P', origem: 'ia', editada: true },
      { texto: 'Conferir impostos, frete e condições antes do envio', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'ERP', efeito: 'N', origem: 'manual' },
    ],
    competencias: [
      { texto: 'Identificar quando a sugestão automática precisa ser revista', eixo: 'Letramento em IA', tarefa: 2, alvo: 'N2', origem: 'regra' },
      { texto: 'Validar dados de preço e disponibilidade', eixo: 'Proficiência técnica', tarefa: 3, alvo: 'N2' },
      { texto: 'Reorganizar prioridades quando há falta de estoque', eixo: 'Adaptabilidade', tarefa: 1, alvo: 'N2' },
    ],
    perdas: [{ tarefa: 2, descricao: 'A digitação integral da proposta passa a ser secundária; o foco migra para conferência e exceções.' }],
    salvaguardas: ['Sim', 'Sim', 'Sim', 'Sim', 'Sim', 'Sim'],
    ocupantes: [{ id: 3003, apelido: 'Marcos', tempo: 850, prazo: 14, niveis: ['N1', 'N2', 'N2'], trilhas: 2 }],
  },
  {
    id: 2003, empresa: 1002, nome: 'Operador de loja', origem: 'manual', criada: '2026-10-10T16:35:00.000Z', tempo: 3210, nota: 4,
    comentario: 'As perguntas ajudaram a separar o que é rotina do que exige decisão do atendente.',
    tarefas: [
      { texto: 'Atender clientes no caixa e no salão', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'PDV', efeito: 'I' },
      { texto: 'Conferir divergências de preço e promoção', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'PDV e aplicativo de consulta', efeito: 'P' },
      { texto: 'Organizar reposição de produtos prioritários', frequencia: 'Diária', criticidade: 'Média', ferramenta: 'Lista de reposição', efeito: 'A' },
      { texto: 'Tratar reclamações simples de clientes', frequencia: 'Semanal', criticidade: 'Alta', ferramenta: '', efeito: 'N' },
    ],
    competencias: [
      { texto: 'Usar consulta automática sem perder a conferência visual', eixo: 'Letramento em IA', tarefa: 1, alvo: 'N1', origem: 'regra' },
      { texto: 'Operar o PDV e resolver divergências comuns', eixo: 'Proficiência técnica', tarefa: 1, alvo: 'N2' },
      { texto: 'Comunicar solução ao cliente em situação de conflito', eixo: 'Relacionais e de julgamento', tarefa: 3, alvo: 'N2' },
    ],
    salvaguardas: ['Sim', 'Sim', 'Sim', 'Sim', 'Sim', 'Parcialmente'],
    ocupantes: [
      { id: 3004, apelido: 'Aline', tempo: 1180, prazo: 30, niveis: ['N1', 'N2', 'N1'], trilhas: 1 },
      { id: 3005, apelido: 'João', tempo: 1040, prazo: 30, niveis: ['N0', 'N2', 'N2'], trilhas: 1 },
    ],
  },
  {
    id: 2004, empresa: 1002, nome: 'Responsável por compras', origem: 'manual', criada: '2026-10-15T18:10:00.000Z', tempo: 2760, nota: 5,
    comentario: 'A visão por competência deixou claro onde o comprador precisa conferir a recomendação automática.',
    tarefas: [
      { texto: 'Analisar giro e necessidade de reposição', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Relatório de vendas', efeito: 'P' },
      { texto: 'Comparar preços e condições de fornecedores', frequencia: 'Semanal', criticidade: 'Alta', ferramenta: 'Planilha e e-mail', efeito: 'A' },
      { texto: 'Definir quantidade final de compra', frequencia: 'Semanal', criticidade: 'Alta', ferramenta: 'ERP', efeito: 'N' },
      { texto: 'Negociar exceções e produtos sazonais', frequencia: 'Eventual', criticidade: 'Alta', ferramenta: '', efeito: 'I' },
    ],
    competencias: [
      { texto: 'Questionar recomendações baseadas apenas no histórico', eixo: 'Letramento em IA', tarefa: 0, alvo: 'N3', origem: 'regra' },
      { texto: 'Interpretar indicadores de giro e ruptura', eixo: 'Proficiência técnica', tarefa: 0, alvo: 'N2' },
      { texto: 'Julgar fatores locais e sazonais', eixo: 'Relacionais e de julgamento', tarefa: 2, alvo: 'N3' },
    ],
    salvaguardas: ['Sim', 'Sim', 'Sim', 'Sim', 'Sim', 'Sim'],
    ocupantes: [{ id: 3006, apelido: 'Patrícia', tempo: 970, prazo: 21, niveis: ['N2', 'N2', 'N3'], trilhas: 2 }],
  },
  {
    id: 2005, empresa: 1003, nome: 'Consultor de atendimento', origem: 'texto', criada: '2026-10-11T14:50:00.000Z', tempo: 2140, nota: 5,
    comentario: 'Foi fácil representar a diferença entre recomendação técnica e decisão de atendimento.',
    tarefas: [
      { texto: 'Entender necessidade e preferência do cliente', frequencia: 'Diária', criticidade: 'Alta', ferramenta: '', efeito: 'N', origem: 'manual' },
      { texto: 'Consultar modelos e disponibilidade de armações', frequencia: 'Diária', criticidade: 'Média', ferramenta: 'Catálogo digital', efeito: 'A', origem: 'ia' },
      { texto: 'Sugerir opções compatíveis com perfil e orçamento', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Catálogo com recomendações', efeito: 'P', origem: 'ia', editada: true },
      { texto: 'Confirmar medidas e dados do pedido antes do fechamento', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Sistema da ótica', efeito: 'N', origem: 'manual' },
    ],
    competencias: [
      { texto: 'Explicar ao cliente o limite de uma recomendação automática', eixo: 'Letramento em IA', tarefa: 2, alvo: 'N2', origem: 'regra' },
      { texto: 'Operar catálogo e cadastro do pedido', eixo: 'Proficiência técnica', tarefa: 3, alvo: 'N2' },
      { texto: 'Conduzir atendimento sem deixar a sugestão substituir a escuta', eixo: 'Relacionais e de julgamento', tarefa: 0, alvo: 'N3' },
    ],
    perdas: [{ tarefa: 1, descricao: 'A busca manual em catálogos extensos perde centralidade com filtros e recomendações automáticas.' }],
    salvaguardas: ['Sim', 'Sim', 'Sim', 'Sim', 'Sim', 'Sim'],
    ocupantes: [
      { id: 3007, apelido: 'Renata', tempo: 760, prazo: 14, niveis: ['N2', 'N3', 'N3'], trilhas: 2 },
      { id: 3008, apelido: 'Lucas', tempo: 890, prazo: 21, niveis: ['N1', 'N2', 'N2'], trilhas: 1 },
    ],
  },
  {
    id: 2006, empresa: 1004, nome: 'Balconista técnico', origem: 'planilha', criada: '2026-10-12T17:20:00.000Z', tempo: 3450, nota: 4,
    comentario: 'A estrutura mostrou que a consulta automática ajuda, mas não substitui experiência com aplicação das peças.',
    tarefas: [
      { texto: 'Identificar peça a partir do veículo e da necessidade informada', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Catálogo eletrônico', efeito: 'P', origem: 'planilha' },
      { texto: 'Checar compatibilidade entre versões e fabricantes', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Catálogo eletrônico e consulta técnica', efeito: 'A', origem: 'planilha' },
      { texto: 'Explicar alternativas de marca e diferença de aplicação', frequencia: 'Diária', criticidade: 'Alta', ferramenta: '', efeito: 'I', origem: 'manual' },
      { texto: 'Confirmar código e quantidade antes de faturar', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'ERP', efeito: 'N', origem: 'manual' },
    ],
    competencias: [
      { texto: 'Reconhecer quando a busca automática retornou peça incompatível', eixo: 'Letramento em IA', tarefa: 1, alvo: 'N2', origem: 'regra' },
      { texto: 'Consultar catálogos por veículo, motor e versão', eixo: 'Proficiência técnica', tarefa: 0, alvo: 'N3', origem: 'planilha' },
      { texto: 'Explicar risco de aplicação incorreta ao cliente', eixo: 'Relacionais e de julgamento', tarefa: 2, alvo: 'N3' },
    ],
    salvaguardas: ['Sim', 'Sim', 'Sim', 'Sim', 'Sim', 'Sim'],
    ocupantes: [
      { id: 3009, apelido: 'Eduardo', tempo: 1210, prazo: 21, niveis: ['N1', 'N3', 'N3'], trilhas: 2 },
      { id: 3010, apelido: 'Rafael', tempo: 1330, prazo: 30, niveis: ['N1', 'N2', 'N2'], trilhas: 1 },
    ],
  },
  {
    id: 2007, empresa: 1004, nome: 'Auxiliar de estoque', origem: 'manual', criada: '2026-10-16T17:45:00.000Z', tempo: 1830, nota: 4,
    comentario: 'As tarefas ficaram bem objetivas e foi rápido identificar as que podem ser automatizadas.',
    tarefas: [
      { texto: 'Receber e conferir mercadoria', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Coletor e ERP', efeito: 'P' },
      { texto: 'Endereçar itens no estoque', frequencia: 'Diária', criticidade: 'Média', ferramenta: 'ERP', efeito: 'A' },
      { texto: 'Separar pedidos para o balcão', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Lista de separação', efeito: 'A' },
      { texto: 'Investigar divergência física de estoque', frequencia: 'Semanal', criticidade: 'Alta', ferramenta: '', efeito: 'N' },
    ],
    competencias: [
      { texto: 'Operar coletor e localizar divergências no sistema', eixo: 'Proficiência técnica', tarefa: 0, alvo: 'N2' },
      { texto: 'Reorganizar sequência de separação em períodos de pico', eixo: 'Adaptabilidade', tarefa: 2, alvo: 'N2' },
      { texto: 'Não aceitar baixa automática quando a contagem física divergir', eixo: 'Letramento em IA', tarefa: 3, alvo: 'N1', origem: 'regra' },
    ],
    perdas: [{ tarefa: 1, descricao: 'A memorização de localização física deixa de ser requisito central com o endereçamento no sistema.' }],
    salvaguardas: ['Sim', 'Sim', 'Sim', 'Parcialmente', 'Sim', 'Sim'],
    ocupantes: [{ id: 3011, apelido: 'Bruno', tempo: 690, prazo: 14, niveis: ['N2', 'N1', 'N1'], trilhas: 1 }],
  },
  {
    id: 2008, empresa: 1005, nome: 'Atendente de loja', origem: 'texto', criada: '2026-10-14T15:55:00.000Z', tempo: 2250, nota: 5,
    comentario: 'A ferramenta ajudou a enxergar onde a recomendação de produto precisa continuar sendo validada pelo atendente.',
    tarefas: [
      { texto: 'Entender espécie, porte, idade e necessidade do animal', frequencia: 'Diária', criticidade: 'Alta', ferramenta: '', efeito: 'N', origem: 'manual' },
      { texto: 'Consultar produtos compatíveis e disponibilidade', frequencia: 'Diária', criticidade: 'Média', ferramenta: 'Catálogo digital', efeito: 'A', origem: 'ia' },
      { texto: 'Sugerir alternativas de produto dentro do orçamento', frequencia: 'Diária', criticidade: 'Alta', ferramenta: 'Catálogo com recomendação', efeito: 'P', origem: 'ia', editada: true },
      { texto: 'Encaminhar dúvida clínica ou restrição alimentar ao profissional responsável', frequencia: 'Eventual', criticidade: 'Alta', ferramenta: '', efeito: 'N', origem: 'manual' },
    ],
    competencias: [
      { texto: 'Distinguir recomendação comercial de orientação clínica', eixo: 'Letramento em IA', tarefa: 3, alvo: 'N2', origem: 'regra' },
      { texto: 'Pesquisar catálogo por espécie e necessidade', eixo: 'Proficiência técnica', tarefa: 1, alvo: 'N2' },
      { texto: 'Escutar o cliente antes de oferecer a alternativa sugerida', eixo: 'Relacionais e de julgamento', tarefa: 0, alvo: 'N3' },
    ],
    salvaguardas: ['Sim', 'Sim', 'Sim', 'Sim', 'Sim', 'Sim'],
    ocupantes: [
      { id: 3012, apelido: 'Camila', tempo: 820, prazo: 14, niveis: ['N2', 'N2', 'N3'], trilhas: 2 },
      { id: 3013, apelido: 'Diego', tempo: 930, prazo: 21, niveis: ['N1', 'N2', 'N2'], trilhas: 1 },
    ],
  },
];

function niveisDaFuncao(f: FuncaoSeed, valores: Nivel[]): Niveis {
  const niveis: Niveis = {};
  f.competencias.forEach((_, i) => {
    niveis[ID(f.id * 100 + 50 + i + 1)] = { nivel: valores[i] ?? 'N1', respostas: null };
  });
  return niveis;
}

export function semearBaseApresentacao(db: DatabaseSync): void {
  if (db.prepare('SELECT 1 FROM empresas WHERE id = ?').get(ID(1001))) return;

  const inserirEmpresa = db.prepare('INSERT OR IGNORE INTO empresas (id, nome, cidade, segmento, ativa, criada_em) VALUES (?, ?, ?, ?, 1, ?)');
  const inserirUsuario = db.prepare(`INSERT OR IGNORE INTO usuarios
    (id, email, senha_hash, papel, empresa_id, trocar_senha, falhas, bloqueado_ate, criado_em, ultimo_acesso)
    VALUES (?, ?, ?, 'gestor', ?, 1, 0, 0, ?, ?)`);
  const inserirFuncao = db.prepare(`INSERT OR IGNORE INTO funcoes
    (id, empresa_id, nome, estrutura, origem, tempo_ativo_s, arquivada, criada_em, atualizada_em)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`);
  const inserirOcupante = db.prepare(`INSERT OR IGNORE INTO ocupantes
    (id, funcao_id, apelido, niveis, prazo_dias, tempo_ativo_s, arquivado, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`);
  const inserirExecucao = db.prepare(`INSERT OR IGNORE INTO execucoes
    (id, tipo, empresa_id, funcao_id, ocupante_id, criada_por, criada_em)
    VALUES (?, 'trilha', ?, ?, ?, ?, ?)`);
  const inserirAvaliacao = db.prepare(`INSERT OR IGNORE INTO avaliacoes_uso
    (funcao_id, nota, comentario, criada_em) VALUES (?, ?, ?, ?)`);
  const inserirFerramenta = db.prepare(`INSERT OR IGNORE INTO ferramentas_ia
    (id, empresa_id, nome, criada_em) VALUES (?, ?, ?, ?)`);

  transacao(db, () => {
    for (const e of empresas) {
      inserirEmpresa.run(ID(e.id), e.nome, e.cidade, e.segmento, e.criada);
      inserirUsuario.run(ID(e.id + 100), e.email, SENHA_HASH, ID(e.id), e.criada, e.acesso);
    }

    let ferramentaId = 5001;
    for (const [empresa, nomes] of [
      [1001, ['Assistente de consulta de catálogo', 'Gerador de orçamento']],
      [1002, ['Sugestão de reposição por giro']],
      [1003, ['Recomendação de produtos no catálogo']],
      [1004, ['Busca inteligente de aplicações']],
      [1005, ['Recomendação de produtos por perfil']],
    ] as const) {
      for (const nome of nomes) inserirFerramenta.run(ID(ferramentaId++), ID(empresa), nome, '2026-10-15T12:00:00.000Z');
    }

    let execucaoId = 4001;
    for (const f of funcoes) {
      const estrutura = montarEstrutura(f);
      inserirFuncao.run(ID(f.id), ID(f.empresa), f.nome, JSON.stringify(estrutura), f.origem, f.tempo, f.criada, f.criada);
      inserirAvaliacao.run(ID(f.id), f.nota, f.comentario, new Date(Date.parse(f.criada) + 86_400_000).toISOString());

      f.ocupantes.forEach((o, indice) => {
        const criado = new Date(Date.parse(f.criada) + (indice + 1) * 3_600_000).toISOString();
        inserirOcupante.run(ID(o.id), ID(f.id), o.apelido, JSON.stringify(niveisDaFuncao(f, o.niveis)), o.prazo, o.tempo, criado, criado);
        for (let t = 0; t < o.trilhas; t++) {
          const data = new Date(Date.parse(criado) + (t + 1) * 86_400_000).toISOString();
          inserirExecucao.run(ID(execucaoId++), ID(f.empresa), ID(f.id), ID(o.id), ID(f.empresa + 100), data);
        }
      });
    }
  });
}
