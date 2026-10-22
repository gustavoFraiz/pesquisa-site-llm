import type { Estrutura, Nivel, Niveis } from './estrutura.ts';

export const PESOS: Record<string, number> = { Alta: 3, 'Média': 2, Baixa: 1, 'Diária': 3, Semanal: 2, Eventual: 1 };

export type Lacuna = {
  competenciaId: string; competencia: string; eixo: string; tarefa: string; atual: Nivel | null; alvo: Nivel;
  lacuna: number | null; score: number | null; prioridade: 'Alta' | 'Média' | 'Nenhuma' | 'Sem nível';
};

const numero = (n: Nivel) => Number(n[1]);

/** Espelha recomendar.analisar: lacuna = max(0, alvo - atual); score = lacuna*10 + pesos; desempate pela ordem. */
export function calcularLacunas(estrutura: Estrutura, niveis: Niveis): Lacuna[] {
  const tarefas = new Map(estrutura.tarefas.map(t => [t.id, t]));
  const lacunas = estrutura.competencias.map((c, ordem) => {
    const tarefa = tarefas.get(c.tarefa_id);
    const atual = niveis[c.id]?.nivel ?? null;
    const lacuna = atual ? Math.max(0, numero(c.alvo) - numero(atual)) : null;
    const score = lacuna === null || !tarefa ? null : lacuna * 10 + PESOS[tarefa.criticidade] + PESOS[tarefa.frequencia];
    const prioridade: Lacuna['prioridade'] = lacuna === null ? 'Sem nível' : lacuna === 0 ? 'Nenhuma' : lacuna >= 2 ? 'Alta' : 'Média';
    return { ordem, item: { competenciaId: c.id, competencia: c.competencia, eixo: c.eixo, tarefa: tarefa?.tarefa ?? '', atual, alvo: c.alvo, lacuna, score, prioridade } };
  });
  return lacunas.sort((a, b) => (b.item.score ?? -1) - (a.item.score ?? -1) || a.ordem - b.ordem).map(l => l.item);
}
