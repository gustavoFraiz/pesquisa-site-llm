export const EIXOS = ['Letramento em IA', 'Proficiência técnica', 'Adaptabilidade', 'Relacionais e de julgamento'] as const;
export const FREQUENCIAS = ['Diária', 'Semanal', 'Eventual'] as const;
export const CRITICIDADES = ['Alta', 'Média', 'Baixa'] as const;
export const EFEITOS = ['A', 'P', 'I', 'N'] as const;
export const NIVEIS = ['N0', 'N1', 'N2', 'N3'] as const;
export const RESPOSTAS = ['Sim', 'Não', 'Parcialmente', 'Não sei'] as const;
export const ORIGENS_TAREFA = ['modelo', 'ia', 'manual', 'copia', 'planilha'] as const;
export const ORIGENS_COMPETENCIA = ['regra', 'modelo', 'manual', 'copia', 'planilha'] as const;
export const LIMITES = { tarefas: 12, competencias: 8, texto: 300, ferramenta: 200, nota: 1000 } as const;

export type Eixo = (typeof EIXOS)[number];
export type Frequencia = (typeof FREQUENCIAS)[number];
export type Criticidade = (typeof CRITICIDADES)[number];
export type Efeito = (typeof EFEITOS)[number];
export type Nivel = (typeof NIVEIS)[number];
export type Resposta = (typeof RESPOSTAS)[number];
export type OrigemTarefa = (typeof ORIGENS_TAREFA)[number];
export type OrigemCompetencia = (typeof ORIGENS_COMPETENCIA)[number];

export const ROTULOS_NIVEL: Record<Nivel, string> = {
  N0: 'N0 - Não exposto', N1: 'N1 - Usuário assistido', N2: 'N2 - Usuário autônomo', N3: 'N3 - Usuário crítico',
};

export type Tarefa = { id: string; tarefa: string; frequencia: Frequencia; criticidade: Criticidade; ferramenta: string; efeito_ia: Efeito | null; origem: OrigemTarefa; editada: boolean };
export type Competencia = { id: string; competencia: string; eixo: Eixo; tarefa_id: string; alvo: Nivel; origem: OrigemCompetencia; motivo?: string; editada: boolean };
export type PerdaCentralidade = { id: string; descricao: string; tarefa_id: string; origem: 'regra' | 'manual' };
export type RespostaSalvaguarda = { numero: number; resposta: Resposta; observacao: string; ajuste: string };
export type Estrutura = { versao: 1; tarefas: Tarefa[]; competencias: Competencia[]; perdem_centralidade: PerdaCentralidade[]; salvaguardas: RespostaSalvaguarda[]; sugestoes_ignoradas?: string[] };
export type NivelOcupante = { nivel: Nivel; respostas: (boolean | null)[] | null };
export type Niveis = Record<string, NivelOcupante>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const novoId = (): string => globalThis.crypto.randomUUID();

export function novaTarefa(): Tarefa {
  return { id: novoId(), tarefa: '', frequencia: 'Diária', criticidade: 'Média', ferramenta: '', efeito_ia: null, origem: 'manual', editada: false };
}

export function novaCompetencia(tarefaId = ''): Competencia {
  return { id: novoId(), competencia: '', eixo: EIXOS[0], tarefa_id: tarefaId, alvo: 'N2', origem: 'manual', editada: false };
}

export function estruturaVazia(): Estrutura {
  return {
    versao: 1, tarefas: [novaTarefa()], competencias: [], perdem_centralidade: [],
    salvaguardas: [1, 2, 3, 4, 5, 6].map(numero => ({ numero, resposta: 'Não sei' as Resposta, observacao: '', ajuste: '' })),
  };
}

function falha(campo: string): never {
  throw new Error(`Campo inválido: ${campo}.`);
}
function objeto(v: unknown, campo: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) falha(campo);
  return v as Record<string, unknown>;
}
function lista(v: unknown, campo: string, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) falha(campo);
  return v;
}
function texto(v: unknown, campo: string, max: number): string {
  if (typeof v !== 'string' || v.length > max) falha(campo);
  return v;
}
function opcao<T extends string>(v: unknown, opcoes: readonly T[], campo: string): T {
  if (typeof v !== 'string' || !(opcoes as readonly string[]).includes(v)) falha(campo);
  return v as T;
}
function identificador(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !UUID.test(v)) falha(campo);
  return v;
}
function booleano(v: unknown, campo: string): boolean {
  if (typeof v !== 'boolean') falha(campo);
  return v;
}
function unicos(ids: string[], campo: string): void {
  if (new Set(ids).size !== ids.length) falha(campo);
}

export function validarEstrutura(valor: unknown): Estrutura {
  const e = objeto(valor, 'estrutura');
  if (e.versao !== 1) falha('versão da estrutura');
  const tarefas: Tarefa[] = lista(e.tarefas, 'tarefas', LIMITES.tarefas).map((item, i) => {
    const t = objeto(item, `tarefa ${i + 1}`);
    return {
      id: identificador(t.id, 'tarefa'),
      tarefa: texto(t.tarefa, 'tarefa', LIMITES.texto),
      frequencia: opcao(t.frequencia, FREQUENCIAS, 'frequência'),
      criticidade: opcao(t.criticidade, CRITICIDADES, 'criticidade'),
      ferramenta: texto(t.ferramenta, 'ferramenta', LIMITES.ferramenta),
      efeito_ia: t.efeito_ia === null ? null : opcao(t.efeito_ia, EFEITOS, 'efeito da IA'),
      origem: opcao(t.origem, ORIGENS_TAREFA, 'origem da tarefa'),
      editada: booleano(t.editada, 'editada'),
    };
  });
  unicos(tarefas.map(t => t.id), 'tarefas repetidas');
  const idsTarefas = new Set(tarefas.map(t => t.id));
  const referencia = (v: unknown, campo: string, permitirVazio: boolean): string => {
    if (permitirVazio && v === '') return '';
    const id = identificador(v, campo);
    if (!idsTarefas.has(id)) falha(campo);
    return id;
  };
  const competencias: Competencia[] = lista(e.competencias, 'competências', LIMITES.competencias).map((item, i) => {
    const c = objeto(item, `competência ${i + 1}`);
    const base: Competencia = {
      id: identificador(c.id, 'competência'),
      competencia: texto(c.competencia, 'competência', LIMITES.texto),
      eixo: opcao(c.eixo, EIXOS, 'eixo'),
      tarefa_id: referencia(c.tarefa_id, 'tarefa associada', true),
      alvo: opcao(c.alvo, NIVEIS, 'nível-alvo'),
      origem: opcao(c.origem, ORIGENS_COMPETENCIA, 'origem da competência'),
      editada: booleano(c.editada, 'editada'),
    };
    return c.motivo === undefined ? base : { ...base, motivo: texto(c.motivo, 'motivo', LIMITES.texto) };
  });
  unicos(competencias.map(c => c.id), 'competências repetidas');
  const perdem_centralidade: PerdaCentralidade[] = lista(e.perdem_centralidade, 'perda de centralidade', LIMITES.tarefas).map((item, i) => {
    const p = objeto(item, `perda de centralidade ${i + 1}`);
    return {
      id: identificador(p.id, 'perda de centralidade'),
      descricao: texto(p.descricao, 'descrição', LIMITES.texto),
      tarefa_id: referencia(p.tarefa_id, 'tarefa da perda de centralidade', false),
      origem: opcao(p.origem, ['regra', 'manual'] as const, 'origem'),
    };
  });
  const salvaguardas: RespostaSalvaguarda[] = lista(e.salvaguardas, 'salvaguardas', 6).map((item, i) => {
    const s = objeto(item, `salvaguarda ${i + 1}`);
    if (s.numero !== i + 1) falha('número da salvaguarda');
    return {
      numero: i + 1,
      resposta: opcao(s.resposta, RESPOSTAS, 'resposta da salvaguarda'),
      observacao: texto(s.observacao, 'observação', LIMITES.nota),
      ajuste: texto(s.ajuste, 'ajuste', LIMITES.nota),
    };
  });
  if (salvaguardas.length !== 6) falha('salvaguardas');
  const resultado: Estrutura = { versao: 1, tarefas, competencias, perdem_centralidade, salvaguardas };
  if (e.sugestoes_ignoradas !== undefined) {
    resultado.sugestoes_ignoradas = lista(e.sugestoes_ignoradas, 'sugestões ignoradas', 50).map(v => texto(v, 'sugestões ignoradas', 80));
  }
  return resultado;
}

const chave = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

export function pendenciasTarefas(e: Estrutura): string[] {
  const p: string[] = [];
  if (!e.tarefas.length) p.push('Cadastre ao menos uma tarefa.');
  const vistas = new Set<string>();
  e.tarefas.forEach((t, i) => {
    if (!t.tarefa.trim()) p.push(`Tarefa ${i + 1}: descreva a atividade.`);
    else if (vistas.has(chave(t.tarefa))) p.push(`Tarefa ${i + 1}: já existe outra tarefa com o mesmo texto.`);
    else vistas.add(chave(t.tarefa));
    if (!t.efeito_ia) p.push(`Tarefa ${i + 1}: indique o efeito da IA.`);
  });
  return p;
}

export function pendenciasCompetencias(e: Estrutura): string[] {
  const p: string[] = [];
  if (!e.competencias.length) p.push('Cadastre ao menos uma competência.');
  e.competencias.forEach((c, i) => {
    if (!c.competencia.trim()) p.push(`Competência ${i + 1}: informe o nome.`);
    if (!c.tarefa_id) p.push(`Competência ${i + 1}: escolha a tarefa associada.`);
  });
  return p;
}

export const pendenciasEstrutura = (e: Estrutura): string[] => [...pendenciasTarefas(e), ...pendenciasCompetencias(e)];

/** Cópia para nova função ou modelo: IDs novos, origem marcada e nada de sugestões ignoradas. */
export function copiarEstrutura(e: Estrutura, origem: 'modelo' | 'copia', manterSalvaguardas: boolean): Estrutura {
  const ids = new Map(e.tarefas.map(t => [t.id, novoId()]));
  const tarefa = (id: string) => ids.get(id) ?? '';
  return {
    versao: 1,
    tarefas: e.tarefas.map(t => ({ ...t, id: tarefa(t.id), origem, editada: false })),
    competencias: e.competencias.map(c => ({ ...c, id: novoId(), tarefa_id: tarefa(c.tarefa_id), origem, editada: false })),
    perdem_centralidade: e.perdem_centralidade.map(p => ({ ...p, id: novoId(), tarefa_id: tarefa(p.tarefa_id) })),
    salvaguardas: manterSalvaguardas ? e.salvaguardas.map(s => ({ ...s })) : estruturaVazia().salvaguardas,
  };
}

/** Sem ferramenta e sem efeito escolhido, a tarefa "não mudou" (fluxo alternativo do UC3). */
export function efeitoAutomatico(t: Tarefa): Tarefa {
  return t.tarefa.trim() && !t.ferramenta.trim() && t.efeito_ia === null ? { ...t, efeito_ia: 'I' } : t;
}
