import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { notasDaFuncao } from './avaliacoes.ts';
import type { Estrutura } from './estrutura.ts';
import type { DadosMetrica, TrilhaResumo } from './metricas.ts';
import { jobPath } from './server.ts';

export type Leitor = (execucaoId: string) => unknown | null;

/** Lê o resultado de uma execução concluída (analise.json ou extracao.json); qualquer falha vira null. */
export const leitorDeAnalises: Leitor = id => {
  try {
    const pasta = jobPath(id);
    const status = JSON.parse(readFileSync(path.join(pasta, 'status.json'), 'utf8')) as { status: string; tipo: string };
    if (status.status !== 'concluida') return null;
    return JSON.parse(readFileSync(path.join(pasta, status.tipo === 'extracao' ? 'extracao.json' : 'analise.json'), 'utf8')) as unknown;
  } catch {
    return null;
  }
};

const lerSeguro = (ler: Leitor, id: string): unknown | null => {
  try { return ler(id); } catch { return null; }
};

type Analise = { diagnostico?: { priorizadas?: unknown[] }; plano?: { recomendacoes?: { decisao: string; prazo_dias_sugerido: number | null; criterio_conclusao: string | null }[] } | null };

export function coletarMetricas(db: DatabaseSync, ler: Leitor, empresaId?: string): DadosMetrica[] {
  const funcoes = (empresaId
    ? db.prepare('SELECT f.id, f.nome, f.estrutura, f.origem, f.criada_em, f.tempo_ativo_s, f.arquivada, e.nome AS empresa FROM funcoes f JOIN empresas e ON e.id = f.empresa_id WHERE f.empresa_id = ? ORDER BY e.nome, f.criada_em').all(empresaId)
    : db.prepare('SELECT f.id, f.nome, f.estrutura, f.origem, f.criada_em, f.tempo_ativo_s, f.arquivada, e.nome AS empresa FROM funcoes f JOIN empresas e ON e.id = f.empresa_id ORDER BY e.nome, f.criada_em').all()
  ) as { id: string; nome: string; estrutura: string; origem: string; criada_em: string; tempo_ativo_s: number; arquivada: number; empresa: string }[];
  return funcoes.map(f => {
    const ocupantes = db.prepare('SELECT id, apelido, tempo_ativo_s, arquivado FROM ocupantes WHERE funcao_id = ? ORDER BY criado_em, rowid').all(f.id) as { id: string; apelido: string; tempo_ativo_s: number; arquivado: number }[];
    const ultimasTrilhas: TrilhaResumo[] = [];
    for (const o of ocupantes) {
      const execucoes = db.prepare("SELECT id FROM execucoes WHERE ocupante_id = ? AND tipo = 'trilha' ORDER BY criada_em DESC").all(o.id) as { id: string }[];
      for (const x of execucoes) {
        const a = lerSeguro(ler, x.id) as Analise | null;
        if (!a?.plano) continue;
        ultimasTrilhas.push({
          ocupante: o.apelido, priorizadas: a.diagnostico?.priorizadas?.length ?? 0,
          recomendacoes: (a.plano.recomendacoes ?? []).map(r => ({ decisao: r.decisao, prazo: r.prazo_dias_sugerido, criterio: r.criterio_conclusao })),
        });
        break;
      }
    }
    const trilhas = db.prepare("SELECT COUNT(*) AS n FROM execucoes WHERE funcao_id = ? AND tipo = 'trilha'").get(f.id) as { n: number };
    return {
      empresa: f.empresa, funcao: f.nome, origem: f.origem, criadaEm: f.criada_em, arquivada: Number(f.arquivada) === 1,
      estrutura: JSON.parse(f.estrutura) as Estrutura, tempoEstruturaS: Number(f.tempo_ativo_s),
      tempoPrimeiroOcupanteS: ocupantes.length ? Number(ocupantes[0].tempo_ativo_s) : null,
      ocupantesAtivos: ocupantes.filter(o => Number(o.arquivado) === 0).length, trilhasGeradas: Number(trilhas.n),
      ultimasTrilhas, notas: notasDaFuncao(db, f.id),
    };
  });
}

export function resumoDeExtracoes(db: DatabaseSync, ler: Leitor): { empresa: string; pedidas: number; concluidas: number; tempoMedioS: number | null; funcoesPorIA: number }[] {
  const empresas = db.prepare('SELECT id, nome FROM empresas ORDER BY nome COLLATE NOCASE').all() as { id: string; nome: string }[];
  return empresas.flatMap(e => {
    const ids = (db.prepare("SELECT id FROM execucoes WHERE empresa_id = ? AND tipo = 'extracao'").all(e.id) as { id: string }[]).map(x => x.id);
    if (!ids.length) return [];
    const tempos = ids.map(id => (lerSeguro(ler, id) as { metadados?: { tempo_segundos?: number } } | null)?.metadados?.tempo_segundos).filter((t): t is number => typeof t === 'number');
    const porIA = db.prepare("SELECT COUNT(*) AS n FROM funcoes WHERE empresa_id = ? AND origem = 'texto'").get(e.id) as { n: number };
    return [{ empresa: e.nome, pedidas: ids.length, concluidas: tempos.length, tempoMedioS: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null, funcoesPorIA: Number(porIA.n) }];
  });
}
