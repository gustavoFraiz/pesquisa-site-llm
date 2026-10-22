export type Opcao = string | { valor: string; rotulo: string };

export function Campo({ rotulo, children, largo = false }: { rotulo: string; children: React.ReactNode; largo?: boolean }) {
  return <label className={`field ${largo ? 'wide' : ''}`}><span>{rotulo}</span>{children}</label>;
}

export function Selecao({ valor, opcoes, aoMudar, vazio = 'Selecione' }: { valor: string; opcoes: readonly Opcao[]; aoMudar: (v: string) => void; vazio?: string }) {
  const lista = opcoes.map(o => (typeof o === 'string' ? { valor: o, rotulo: o } : o));
  const conhecido = lista.some(o => o.valor === valor);
  return (
    <select value={conhecido ? valor : ''} onChange={e => aoMudar(e.target.value)}>
      {!conhecido && <option value="" disabled>{vazio}</option>}
      {lista.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
    </select>
  );
}
