import {
  CRITICIDADES, EFEITOS, EIXOS, FREQUENCIAS, LIMITES, NIVEIS, RESPOSTAS, ROTULOS_NIVEL,
  novoId, pendenciasEstrutura, validarEstrutura, type Estrutura, type Nivel, type Niveis,
} from './estrutura.ts';
import { HttpErro } from './http.ts';
import { SALVAGUARDAS, type AcaoCatalogo } from './seed.ts';

export type EntradaMotor = {
  tarefas: { funcao: string; tarefa: string; frequencia: string; criticidade: string; ferramenta: string | null; efeito_ia: string }[];
  competencias: { funcao: string; competencia: string; eixo: string; tarefa: string; atual: string; alvo: string }[];
  catalogo: AcaoCatalogo[];
  salvaguardas: { numero: number; ancora: string; verificacao: string; resposta: string; observacao: string | null; ajuste: string | null }[];
  trilha: never[];
  prazo_dias_proposto: number;
};

/** Converte função + ocupante no JSON que `web_bridge.py` já aceita (mesmas colunas da planilha). */
export function montarEntrada(funcao: { nome: string; estrutura: Estrutura }, ocupante: { niveis: Niveis; prazoDias: number }, catalogo: AcaoCatalogo[]): EntradaMotor {
  const e = funcao.estrutura;
  const pendencias = pendenciasEstrutura(e);
  if (pendencias.length) throw new HttpErro(400, `Complete a função antes de gerar. ${pendencias[0]}`);
  const faltando = e.competencias.filter(c => !ocupante.niveis[c.id]);
  if (faltando.length) throw new HttpErro(400, `Informe o nível atual de: ${faltando.map(c => c.competencia.trim()).join(', ')}.`);
  const tarefas = new Map(e.tarefas.map(t => [t.id, t.tarefa.trim()]));
  return {
    tarefas: e.tarefas.map(t => ({
      funcao: funcao.nome, tarefa: t.tarefa.trim(), frequencia: t.frequencia, criticidade: t.criticidade,
      ferramenta: t.ferramenta.trim() || null, efeito_ia: t.efeito_ia as string,
    })),
    competencias: e.competencias.map(c => ({
      funcao: funcao.nome, competencia: c.competencia.trim(), eixo: c.eixo, tarefa: tarefas.get(c.tarefa_id) as string,
      atual: ROTULOS_NIVEL[ocupante.niveis[c.id].nivel], alvo: ROTULOS_NIVEL[c.alvo],
    })),
    catalogo: catalogo.map(a => ({ eixo: a.eixo, acao: a.acao, recurso: a.recurso, custo: a.custo })),
    salvaguardas: SALVAGUARDAS.map(s => {
      const r = e.salvaguardas[s.numero - 1];
      return { numero: s.numero, ancora: s.ancora, verificacao: s.verificacao, resposta: r.resposta, observacao: r.observacao.trim() || null, ajuste: r.ajuste.trim() || null };
    }),
    trilha: [],
    prazo_dias_proposto: ocupante.prazoDias,
  };
}

const texto = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
function opcaoOu<T extends string, P>(v: string, opcoes: readonly T[], padrao: P): T | P {
  return (opcoes as readonly string[]).includes(v) ? (v as T) : padrao;
}
const nivelDe = (v: unknown): Nivel | null => opcaoOu(texto(v).slice(0, 2), NIVEIS, null);

/** Converte a saída de `web_bridge.py importar` (planilha) em estrutura com IDs e níveis do primeiro ocupante. */
export function estruturaDaEntrada(entrada: Record<string, unknown>): { nome: string; estrutura: Estrutura; niveis: Niveis } {
  const linhas = (chave: string) => (Array.isArray(entrada[chave]) ? entrada[chave] : []) as Record<string, unknown>[];
  const tarefasPlanilha = linhas('tarefas').slice(0, LIMITES.tarefas);
  const nome = (texto(tarefasPlanilha[0]?.funcao) || 'Função importada').slice(0, 120);
  const tarefas = tarefasPlanilha.map(t => {
    const ferramenta = texto(t.ferramenta);
    return {
      id: novoId(), tarefa: texto(t.tarefa).slice(0, LIMITES.texto),
      frequencia: opcaoOu(texto(t.frequencia), FREQUENCIAS, 'Diária' as const),
      criticidade: opcaoOu(texto(t.criticidade), CRITICIDADES, 'Média' as const),
      ferramenta: ferramenta === '—' ? '' : ferramenta.slice(0, LIMITES.ferramenta),
      efeito_ia: opcaoOu(texto(t.efeito_ia), EFEITOS, null),
      origem: 'planilha' as const, editada: false,
    };
  });
  const porTexto = new Map(tarefas.map(t => [t.tarefa, t.id]));
  const niveis: Niveis = {};
  const competencias = linhas('competencias').slice(0, LIMITES.competencias).map(c => {
    const id = novoId();
    const atual = nivelDe(c.atual);
    if (atual) niveis[id] = { nivel: atual, respostas: null };
    return {
      id, competencia: texto(c.competencia).slice(0, LIMITES.texto), eixo: opcaoOu(texto(c.eixo), EIXOS, EIXOS[0]),
      tarefa_id: porTexto.get(texto(c.tarefa)) ?? '', alvo: nivelDe(c.alvo) ?? 'N2', origem: 'planilha' as const, editada: false,
    };
  });
  const salvaguardas = [1, 2, 3, 4, 5, 6].map(numero => {
    const s = linhas('salvaguardas').find(x => Number(x.numero) === numero);
    return {
      numero, resposta: opcaoOu(texto(s?.resposta), RESPOSTAS, 'Não sei' as const),
      observacao: texto(s?.observacao).slice(0, LIMITES.nota), ajuste: texto(s?.ajuste).slice(0, LIMITES.nota),
    };
  });
  return { nome, estrutura: validarEstrutura({ versao: 1, tarefas, competencias, perdem_centralidade: [], salvaguardas }), niveis };
}
