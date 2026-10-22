import type { Opcao } from './Campo';

export default function BotoesOpcao({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: string; opcoes: readonly Opcao[]; aoMudar: (v: string) => void }) {
  const lista = opcoes.map(o => (typeof o === 'string' ? { valor: o, rotulo: o } : o));
  return (
    <div className="field">
      <span>{rotulo}</span>
      <div className="segmented" role="radiogroup" aria-label={rotulo}>
        {lista.map(o => (
          <button type="button" key={o.valor} role="radio" aria-checked={valor === o.valor} className={valor === o.valor ? 'ativo' : ''} onClick={() => aoMudar(o.valor)}>{o.rotulo}</button>
        ))}
      </div>
    </div>
  );
}
