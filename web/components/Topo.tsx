import BotaoSair from './BotaoSair';

export default function Topo({ subtitulo, inicio = '/' }: { subtitulo: string; inicio?: string }) {
  return (
    <header className="topbar">
      <a className="brand" href={inicio}><span className="brand-mark">M</span><span>MRCC<span className="brand-suffix">/PV</span><small>{subtitulo}</small></span></a>
      <div className="header-actions"><BotaoSair /></div>
    </header>
  );
}
