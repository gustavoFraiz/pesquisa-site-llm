import { PESOS } from './lacunas.ts';
import { LIMITES, novoId, type Competencia, type Eixo, type Estrutura, type Nivel, type PerdaCentralidade, type Tarefa } from './estrutura.ts';

export type SugestaoCompetencia = { chave: string; competencia: Competencia };
export type SugestaoPerda = { chave: string; perda: PerdaCentralidade };

const ORDEM_REGRA: Record<string, number> = { R1: 0, R2: 1, R4: 2, R3: 3 };
const normalizar = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
/** Texto do gestor embutido em nomes e motivos: limitado para não passar dos limites da validação. */
const trecho = (texto: string) => { const t = texto.trim(); return t.length > 120 ? `${t.slice(0, 117)}…` : t; };
const peso = (t: Tarefa) => PESOS[t.criticidade] + PESOS[t.frequencia];

function maisPesada(tarefas: Tarefa[]): Tarefa | undefined {
  return tarefas.reduce<Tarefa | undefined>((melhor, t) => (!melhor || peso(t) > peso(melhor) ? t : melhor), undefined);
}

function competencia(nome: string, eixo: Eixo, tarefa: Tarefa, alvo: Nivel, motivo: string): Competencia {
  return { id: novoId(), competencia: nome, eixo, tarefa_id: tarefa.id, alvo, origem: 'regra', motivo, editada: false };
}

export function sugerir(e: Estrutura): { competencias: SugestaoCompetencia[]; perdem_centralidade: SugestaoPerda[] } {
  const ignoradas = new Set(e.sugestoes_ignoradas ?? []);
  const tarefas = e.tarefas.filter(t => t.tarefa.trim() && t.efeito_ia);
  const com = (efeito: Tarefa['efeito_ia']) => tarefas.filter(t => t.efeito_ia === efeito);
  const candidatas: SugestaoCompetencia[] = [];

  const grupoLetramento = [com('N'), com('P'), com('A').filter(t => t.criticidade === 'Alta')].find(g => g.length);
  const alvoLetramento = grupoLetramento && maisPesada(grupoLetramento);
  if (alvoLetramento) {
    const motivos: Record<string, string> = {
      N: `A tarefa "${trecho(alvoLetramento.tarefa)}" é nova por causa da IA: exige entender e conferir o que a ferramenta produz.`,
      P: `A IA passou a ajudar na tarefa "${trecho(alvoLetramento.tarefa)}": é preciso saber avaliar o resultado.`,
      A: `A IA faz a tarefa crítica "${trecho(alvoLetramento.tarefa)}": alguém precisa conferir o resultado.`,
    };
    candidatas.push({ chave: 'R1', competencia: competencia('Letramento em IA', 'Letramento em IA', alvoLetramento, 'N2', motivos[alvoLetramento.efeito_ia as string]) });
  }

  const comFerramenta = (com('P').some(t => t.ferramenta.trim()) ? com('P') : com('N')).filter(t => t.ferramenta.trim());
  const ferramentas = new Map<string, Tarefa[]>();
  for (const t of comFerramenta) ferramentas.set(normalizar(t.ferramenta), [...(ferramentas.get(normalizar(t.ferramenta)) ?? []), t]);
  for (const [chave, lista] of ferramentas) {
    const t = maisPesada(lista) as Tarefa;
    const nome = trecho(t.ferramenta);
    candidatas.push({ chave: `R2:${chave.slice(0, 70)}`, competencia: competencia(`Proficiência em ${nome}`, 'Proficiência técnica', t, 'N2', `A ferramenta "${nome}" passou a fazer parte da tarefa "${trecho(t.tarefa)}".`) });
  }

  const automatizada = maisPesada(com('A'));
  if (automatizada) {
    candidatas.push({ chave: 'R3', competencia: competencia('Adaptabilidade a novos fluxos de trabalho', 'Adaptabilidade', automatizada, 'N2', `A IA passou a fazer a tarefa "${trecho(automatizada.tarefa)}": o trabalho muda de forma e exige adaptação.`) });
  }

  for (const t of com('I').filter(t => t.criticidade === 'Alta')) {
    candidatas.push({ chave: `R4:${t.id}`, competencia: competencia(`Julgamento em: ${trecho(t.tarefa)}`, 'Relacionais e de julgamento', t, 'N3', `A tarefa "${trecho(t.tarefa)}" é crítica e continua dependendo do julgamento da pessoa.`) });
  }

  const nomes = new Set(e.competencias.map(c => normalizar(c.competencia)));
  const pares = new Set(e.competencias.map(c => `${c.eixo}|${c.tarefa_id}`));
  const pesoPorTarefa = new Map(tarefas.map(t => [t.id, peso(t)]));
  const competencias = candidatas
    .filter(s => !ignoradas.has(s.chave) && !nomes.has(normalizar(s.competencia.competencia)) && !pares.has(`${s.competencia.eixo}|${s.competencia.tarefa_id}`))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (pesoPorTarefa.get(b.s.competencia.tarefa_id) ?? 0) - (pesoPorTarefa.get(a.s.competencia.tarefa_id) ?? 0)
      || ORDEM_REGRA[a.s.chave.split(':')[0]] - ORDEM_REGRA[b.s.chave.split(':')[0]] || a.i - b.i)
    .map(x => x.s);

  const comPerda = new Set(e.perdem_centralidade.map(p => p.tarefa_id));
  const perdem_centralidade = com('A')
    .filter(t => !comPerda.has(t.id) && !ignoradas.has(`R7:${t.id}`))
    .map(t => ({ chave: `R7:${t.id}`, perda: { id: novoId(), descricao: `Executar manualmente: ${trecho(t.tarefa)}`, tarefa_id: t.id, origem: 'regra' as const } }));

  return { competencias, perdem_centralidade };
}

export function aceitarSugestoes(e: Estrutura, chaves: string[]): { estrutura: Estrutura; recusadas: string[] } {
  const { competencias, perdem_centralidade } = sugerir(e);
  const pedidas = new Set(chaves);
  const novas = [...e.competencias];
  const recusadas: string[] = [];
  for (const s of competencias.filter(c => pedidas.has(c.chave))) {
    if (novas.length < LIMITES.competencias) novas.push(s.competencia);
    else recusadas.push(s.competencia.competencia);
  }
  const perdas = [...e.perdem_centralidade, ...perdem_centralidade.filter(p => pedidas.has(p.chave)).map(p => p.perda)];
  return { estrutura: { ...e, competencias: novas, perdem_centralidade: perdas }, recusadas };
}

export function ignorarSugestao(e: Estrutura, chave: string): Estrutura {
  const atuais = e.sugestoes_ignoradas ?? [];
  return atuais.includes(chave) ? e : { ...e, sugestoes_ignoradas: [...atuais, chave].slice(-50) };
}
