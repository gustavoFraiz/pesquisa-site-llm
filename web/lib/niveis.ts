import type { Eixo, Nivel } from './estrutura.ts';

export type Respostas = (boolean | null)[];

/** Descrições observáveis do Quadro 4 do PBL3. */
export const DESCRICAO_NIVEL: Record<Nivel, string> = {
  N0: 'Não usa a ferramenta na tarefa; a competência ainda não é exigida.',
  N1: 'Executa seguindo instruções prontas e depende de apoio diante de variações.',
  N2: 'Faz sem apoio na maior parte das situações e reconhece quando o resultado não serve.',
  N3: 'Avalia erros e limites, decide quando não usar e consegue orientar um colega.',
};

const FERRAMENTA: [string, string, string] = [
  'Usa a ferramenta nesta tarefa?',
  'Usa sem instruções prontas e sem ajuda na maior parte das vezes?',
  'Percebe erros da ferramenta, decide quando não usar e conseguiria ensinar um colega?',
];
const PRATICA: [string, string, string] = [
  'Já realiza esta tarefa no dia a dia?',
  'Resolve sem ajuda na maior parte das situações?',
  'Avalia a própria decisão, reconhece quando chamar o gestor e conseguiria orientar um colega?',
];

export const perguntasDoEixo = (eixo: Eixo): [string, string, string] =>
  (eixo === 'Letramento em IA' || eixo === 'Proficiência técnica' ? FERRAMENTA : PRATICA);

export function nivelPorRespostas(r: Respostas): Nivel | null {
  for (let i = 0; i < 3; i++) {
    if (r[i] === false) return (['N0', 'N1', 'N2'] as const)[i];
    if (r[i] !== true) return null;
  }
  return 'N3';
}

export function perguntasVisiveis(r: Respostas): number {
  let visiveis = 1;
  while (visiveis < 3 && r[visiveis - 1] === true) visiveis++;
  return visiveis;
}

export function responder(r: Respostas, indice: number, valor: boolean): Respostas {
  return [0, 1, 2].map(i => (i < indice ? r[i] ?? null : i === indice ? valor : null));
}
