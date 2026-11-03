import BotaoSair from './BotaoSair';

export default function Topo({ subtitulo, inicio = '/', acoes }: { subtitulo: string; inicio?: string; acoes?: React.ReactNode }) {
  return (
    <header className="topbar">
      <a className="brand" href={inicio}><span className="brand-mark">M</span><span>MRCC<span className="brand-suffix">/PV</span><small>{subtitulo}</small></span></a>
      <div className="header-actions">{acoes}<BotaoSair /></div>
    </header>
  );
}
