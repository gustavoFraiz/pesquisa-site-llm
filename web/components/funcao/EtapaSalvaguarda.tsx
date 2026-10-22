'use client';
import { Campo, Selecao } from '@/components/Campo';
import { LIMITES, RESPOSTAS, type Estrutura, type RespostaSalvaguarda } from '@/lib/estrutura';
import { SALVAGUARDAS } from '@/lib/seed';

export default function EtapaSalvaguarda({ estrutura, aoMudar }: { estrutura: Estrutura; aoMudar: (e: Estrutura) => void }) {
  const alterar = (numero: number, campos: Partial<RespostaSalvaguarda>) =>
    aoMudar({ ...estrutura, salvaguardas: estrutura.salvaguardas.map(s => (s.numero === numero ? { ...s, ...campos } : s)) });
  return (
    <>
      <div className="alert info"><strong>Validação com duas pessoas</strong><p>Esta tela registra uma resposta por âncora. Ela não comprova as respostas separadas e a concordância entre gestor e ocupante previstas em UC7.</p></div>
      {SALVAGUARDAS.map(a => {
        const s = estrutura.salvaguardas[a.numero - 1];
        const precisaAjuste = s.resposta !== 'Sim';
        return (
          <article className="safeguard" key={a.numero}>
            <div className="safeguard-top">
              <div><span className="eyebrow">ÂNCORA {a.numero}</span><h2>{a.ancora}</h2><p>{a.verificacao}</p></div>
              <Campo rotulo="Resposta"><Selecao valor={s.resposta} opcoes={RESPOSTAS} aoMudar={v => alterar(a.numero, { resposta: v as RespostaSalvaguarda['resposta'] })} /></Campo>
            </div>
            <div className="entry-fields">
              <Campo rotulo="Observação"><textarea value={s.observacao} maxLength={LIMITES.nota} onChange={e => alterar(a.numero, { observacao: e.target.value })} /></Campo>
              <Campo rotulo={precisaAjuste ? 'Ajuste registrado — necessário' : 'Ajuste registrado (se necessário)'}>
                <textarea value={s.ajuste} maxLength={LIMITES.nota} className={precisaAjuste && !s.ajuste.trim() ? 'needs-adjustment' : ''} onChange={e => alterar(a.numero, { ajuste: e.target.value })} />
              </Campo>
            </div>
          </article>
        );
      })}
    </>
  );
}
