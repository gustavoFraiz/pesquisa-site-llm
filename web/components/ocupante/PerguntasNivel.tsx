'use client';
import { useState } from 'react';
import BotoesOpcao from '@/components/BotoesOpcao';
import { Selecao } from '@/components/Campo';
import { NIVEIS, ROTULOS_NIVEL, type Competencia, type Nivel, type NivelOcupante } from '@/lib/estrutura';
import { DESCRICAO_NIVEL, nivelPorRespostas, perguntasDoEixo, perguntasVisiveis, responder, type Respostas } from '@/lib/niveis';

const SIM_NAO = [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }];
type Props = { competencia: Competencia; valor?: NivelOcupante; aoMudar: (v: NivelOcupante | null) => void; desabilitado: boolean };

export default function PerguntasNivel({ competencia, valor, aoMudar, desabilitado }: Props) {
  const [direto, setDireto] = useState(Boolean(valor && valor.respostas === null));
  const [respostas, setRespostas] = useState<Respostas>(valor?.respostas ?? [null, null, null]);
  const perguntas = perguntasDoEixo(competencia.eixo);
  const nivel = valor?.nivel ?? null;
  const responderPergunta = (indice: number, sim: boolean) => {
    const novas = responder(respostas, indice, sim);
    setRespostas(novas);
    const calculado = nivelPorRespostas(novas);
    aoMudar(calculado ? { nivel: calculado, respostas: novas } : null);
  };
  return (
    <div className="perguntas-nivel">
      {direto ? (
        <div className="field">
          <span>Nível atual</span>
          <Selecao valor={nivel ?? ''} vazio="Escolha o nível" opcoes={NIVEIS.map(n => ({ valor: n, rotulo: ROTULOS_NIVEL[n] }))} aoMudar={v => aoMudar({ nivel: v as Nivel, respostas: null })} />
        </div>
      ) : perguntas.slice(0, perguntasVisiveis(respostas)).map((p, i) => (
        <fieldset className="pergunta" key={p} disabled={desabilitado}>
          <BotoesOpcao rotulo={p} valor={respostas[i] === null ? '' : respostas[i] ? 'sim' : 'nao'} opcoes={SIM_NAO} aoMudar={v => responderPergunta(i, v === 'sim')} />
        </fieldset>
      ))}
      {nivel && <p className="nivel-calculado"><strong>{ROTULOS_NIVEL[nivel]}</strong> — {DESCRICAO_NIVEL[nivel]}</p>}
      <button type="button" className="text-button inline-action" disabled={desabilitado} onClick={() => setDireto(!direto)}>
        {direto ? 'Responder pelas perguntas' : 'Prefiro escolher o nível diretamente'}
      </button>
    </div>
  );
}
