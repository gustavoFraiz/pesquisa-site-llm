import { DatabaseSync } from 'node:sqlite';
import { prepararBanco } from './db.ts';
import type { Estrutura, Niveis } from './estrutura.ts';

/** Utilitários usados só pelos testes (`*.test.ts`). */
export const bancoDeTeste = (): DatabaseSync => prepararBanco(new DatabaseSync(':memory:'));

export const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function inserirEmpresa(db: DatabaseSync, nome = 'Loja Teste', ativa = true): string {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO empresas (id, nome, ativa, criada_em) VALUES (?, ?, ?, ?)').run(id, nome, ativa ? 1 : 0, new Date().toISOString());
  return id;
}

/** A função "Atendente de balcão" da planilha MRCC-PV de exemplo. */
export function exemploAtendente(): { nome: string; estrutura: Estrutura; niveis: Niveis } {
  const ferramenta = 'Assistente de IA interno (catálogo)';
  const estrutura: Estrutura = {
    versao: 1,
    tarefas: [
      { id: ID(1), tarefa: 'Consultar preço e estoque', frequencia: 'Diária', criticidade: 'Média', ferramenta, efeito_ia: 'A', origem: 'planilha', editada: false },
      { id: ID(2), tarefa: 'Montar orçamento para o cliente', frequencia: 'Diária', criticidade: 'Alta', ferramenta, efeito_ia: 'P', origem: 'planilha', editada: false },
      { id: ID(3), tarefa: 'Negociar prazo com cliente insatisfeito', frequencia: 'Semanal', criticidade: 'Alta', ferramenta: '', efeito_ia: 'I', origem: 'planilha', editada: false },
      { id: ID(4), tarefa: 'Revisar o orçamento gerado pela IA', frequencia: 'Diária', criticidade: 'Alta', ferramenta, efeito_ia: 'N', origem: 'planilha', editada: false },
    ],
    competencias: [
      { id: ID(11), competencia: 'Letramento em IA', eixo: 'Letramento em IA', tarefa_id: ID(4), alvo: 'N2', origem: 'planilha', editada: false },
      { id: ID(12), competencia: 'Proficiência na ferramenta de orçamento', eixo: 'Proficiência técnica', tarefa_id: ID(2), alvo: 'N2', origem: 'planilha', editada: false },
      { id: ID(13), competencia: 'Adaptabilidade a novos fluxos de trabalho', eixo: 'Adaptabilidade', tarefa_id: ID(1), alvo: 'N2', origem: 'planilha', editada: false },
      { id: ID(14), competencia: 'Julgamento em situação de atendimento difícil', eixo: 'Relacionais e de julgamento', tarefa_id: ID(3), alvo: 'N3', origem: 'planilha', editada: false },
    ],
    perdem_centralidade: [],
    salvaguardas: [
      { numero: 1, resposta: 'Sim', observacao: 'O atendente ainda consulta, negocia e monta orçamento — a IA assumiu só uma parte.', ajuste: '' },
      { numero: 2, resposta: 'Sim', observacao: 'Ele continua fechando o atendimento do início ao fim.', ajuste: '' },
      { numero: 3, resposta: 'Não', observacao: 'Ele revisa o orçamento da IA por instrução do gerente, mas não sabe por que essa checagem existe.', ajuste: 'Incluir, na sessão de letramento em IA, uma explicação do motivo da checagem: evitar erro de preço que gera prejuízo à loja.' },
      { numero: 4, resposta: 'Sim', observacao: 'Ele decide como conduzir a negociação e como revisar o orçamento.', ajuste: '' },
      { numero: 5, resposta: 'Sim', observacao: 'O gerente confere o orçamento fechado e comenta o resultado.', ajuste: '' },
      { numero: 6, resposta: 'Sim', observacao: 'O guia de aplicação instrui checar manualmente sempre que o valor do orçamento ultrapassar R$ 2.000.', ajuste: '' },
    ],
  };
  const niveis: Niveis = {
    [ID(11)]: { nivel: 'N0', respostas: null }, [ID(12)]: { nivel: 'N1', respostas: null },
    [ID(13)]: { nivel: 'N2', respostas: null }, [ID(14)]: { nivel: 'N2', respostas: null },
  };
  return { nome: 'Atendente de balcão', estrutura, niveis };
}
