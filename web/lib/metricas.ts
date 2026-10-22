import type { Estrutura } from './estrutura.ts';

export type TrilhaResumo = { ocupante: string; priorizadas: number; recomendacoes: { decisao: string; prazo: number | null; criterio: string | null }[] };
export type DadosMetrica = {
  empresa: string; funcao: string; origem: string; criadaEm: string; arquivada: boolean;
  estrutura: Estrutura; tempoEstruturaS: number; tempoPrimeiroOcupanteS: number | null;
  ocupantesAtivos: number; trilhasGeradas: number; ultimasTrilhas: TrilhaResumo[]; notas: number[];
};
export type LinhaMetrica = Record<string, string | number | null>;

export const COLUNAS: { chave: string; titulo: string }[] = [
  ['empresa', 'Empresa'], ['funcao', 'Função'], ['situacao', 'Situação'], ['origem', 'Origem'], ['criadaEm', 'Criada em'],
  ['tempoEstruturaMin', 'Tempo da estrutura (min)'], ['tempoPrimeiroOcupanteMin', 'Tempo do 1º ocupante (min)'], ['tempoTotalMin', 'Tempo total (min)'],
  ['ate90min', 'Até 90 min (RNF01)'], ['coberturaEfeitoPct', 'Tarefas com efeito (%)'], ['tarefas', 'Tarefas'], ['competencias', 'Competências'],
  ['perdemCentralidade', 'Perdem centralidade (RF07)'], ['lacunasPorOcupante', 'Lacunas priorizadas por ocupante'], ['densidadeMinima3', 'Todos com ≥ 3 lacunas (OE2)'],
  ['completudeTrilhaPct', 'Propostas com prazo e critério (%)'], ['diretrizUsoCritico', 'Diretriz de uso crítico (OE5)'],
  ['alertaPreservacao', 'Variedade e autonomia ambas "Não" (OE5)'], ['facilidadeMedia', 'Facilidade percebida (1–5)'], ['avaliacoes', 'Avaliações'],
  ['tarefasPorOrigem', 'Tarefas por origem'], ['competenciasPorOrigem', 'Competências por origem'],
  ['tarefasEditadasPct', 'Tarefas editadas após sugestão (%)'], ['competenciasEditadasPct', 'Competências editadas após sugestão (%)'],
  ['ocupantes', 'Ocupantes ativos'], ['trilhas', 'Trilhas geradas'],
].map(([chave, titulo]) => ({ chave, titulo }));

const minutos = (s: number) => Math.round(s / 6) / 10;
const pct = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : null);
const porOrigem = (itens: { origem: string }[]) => {
  const contagem = new Map<string, number>();
  for (const i of itens) contagem.set(i.origem, (contagem.get(i.origem) ?? 0) + 1);
  return [...contagem].sort(([a], [b]) => a.localeCompare(b)).map(([o, n]) => `${o}: ${n}`).join('; ') || '—';
};
const editadas = (itens: { origem: string; editada: boolean }[]) => {
  const sugeridas = itens.filter(i => i.origem !== 'manual');
  return pct(sugeridas.filter(i => i.editada).length, sugeridas.length);
};

export function calcularMetrica(d: DadosMetrica): LinhaMetrica {
  const e = d.estrutura;
  const total = d.tempoEstruturaS + (d.tempoPrimeiroOcupanteS ?? 0);
  const recomendacoes = d.ultimasTrilhas.flatMap(t => t.recomendacoes);
  const completas = recomendacoes.filter(r => r.decisao === 'recomendada' && r.prazo !== null && r.criterio !== null).length;
  const ancora = (n: number) => e.salvaguardas[n - 1];
  return {
    empresa: d.empresa, funcao: d.funcao, situacao: d.arquivada ? 'Arquivada' : 'Ativa', origem: d.origem.split(':')[0], criadaEm: d.criadaEm.slice(0, 10),
    tempoEstruturaMin: minutos(d.tempoEstruturaS),
    tempoPrimeiroOcupanteMin: d.tempoPrimeiroOcupanteS === null ? null : minutos(d.tempoPrimeiroOcupanteS),
    tempoTotalMin: minutos(total),
    ate90min: d.tempoPrimeiroOcupanteS === null ? '—' : total <= 90 * 60 ? 'Sim' : 'Não',
    coberturaEfeitoPct: pct(e.tarefas.filter(t => t.efeito_ia).length, e.tarefas.length),
    tarefas: e.tarefas.length, competencias: e.competencias.length, perdemCentralidade: e.perdem_centralidade.length,
    lacunasPorOcupante: d.ultimasTrilhas.length ? d.ultimasTrilhas.map(t => `${t.ocupante}: ${t.priorizadas}`).join('; ') : '—',
    densidadeMinima3: d.ultimasTrilhas.length ? (d.ultimasTrilhas.every(t => t.priorizadas >= 3) ? 'Sim' : 'Não') : '—',
    completudeTrilhaPct: pct(completas, recomendacoes.length),
    diretrizUsoCritico: ancora(6).resposta === 'Sim' || ancora(6).ajuste.trim() ? 'Sim' : 'Não',
    alertaPreservacao: ancora(1).resposta === 'Não' && ancora(4).resposta === 'Não' ? 'Sim' : 'Não',
    facilidadeMedia: d.notas.length ? Math.round((d.notas.reduce((a, b) => a + b, 0) / d.notas.length) * 10) / 10 : null,
    avaliacoes: d.notas.length,
    tarefasPorOrigem: porOrigem(e.tarefas), competenciasPorOrigem: porOrigem(e.competencias),
    tarefasEditadasPct: editadas(e.tarefas), competenciasEditadasPct: editadas(e.competencias),
    ocupantes: d.ocupantesAtivos, trilhas: d.trilhasGeradas,
  };
}

function celula(v: string | number | null): string {
  if (v === null) return '';
  // Texto digitado começando com = + - @ viraria fórmula no Excel: o apóstrofo força texto.
  const texto = typeof v === 'number' ? String(v).replace('.', ',') : /^\s*[=+\-@＝＋－＠]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function paraCsv(linhas: LinhaMetrica[]): string {
  const cabecalho = COLUNAS.map(c => celula(c.titulo)).join(';');
  const corpo = linhas.map(l => COLUNAS.map(c => celula(l[c.chave] ?? null)).join(';'));
  return `﻿${[cabecalho, ...corpo].join('\r\n')}\r\n`;
}
