'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo, Selecao } from '@/components/Campo';
import type { AcaoRegistrada } from '@/lib/catalogo';

const EIXOS = ['Letramento em IA', 'Proficiência técnica', 'Adaptabilidade', 'Relacionais e de julgamento', 'Geral'];
const VAZIA = { eixo: 'Geral', acao: '', recurso: '', custo: 'R$ 0' };

export default function GerenciarAcoes({ iniciais, titulo }: { iniciais: AcaoRegistrada[]; titulo: string }) {
  const [acoes, setAcoes] = useState(iniciais);
  const [form, setForm] = useState(VAZIA);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const executar = async (acao: () => Promise<void>) => {
    setErro('');
    setOcupado(true);
    try {
      await acao();
      setAcoes((await chamarApi<{ acoes: AcaoRegistrada[] }>('/api/acoes')).acoes);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setOcupado(false);
    }
  };
  const incluir = (e: React.FormEvent) => {
    e.preventDefault();
    void executar(async () => { await chamarApi('/api/acoes', { method: 'POST', json: form }); setForm(VAZIA); });
  };
  return (
    <>
      {erro && <div className="alert error" role="alert">{erro}<button onClick={() => setErro('')} aria-label="Fechar aviso">×</button></div>}
      <form className="panel form-grid" onSubmit={incluir}>
        <h2 className="wide">Nova ação</h2>
        <Campo rotulo="Ação de desenvolvimento" largo><input required minLength={5} maxLength={300} value={form.acao} onChange={e => setForm({ ...form, acao: e.target.value })} placeholder="Descreva em uma frase o que a pessoa vai fazer" /></Campo>
        <Campo rotulo="Eixo"><Selecao valor={form.eixo} opcoes={EIXOS} aoMudar={v => setForm({ ...form, eixo: v })} /></Campo>
        <Campo rotulo="Recurso"><input required minLength={2} maxLength={120} value={form.recurso} onChange={e => setForm({ ...form, recurso: e.target.value })} placeholder="Ex.: Prática assistida" /></Campo>
        <Campo rotulo="Custo"><input required maxLength={40} value={form.custo} onChange={e => setForm({ ...form, custo: e.target.value })} /></Campo>
        <div className="wide"><button className="button primary" disabled={ocupado}>Incluir ação</button></div>
      </form>
      <div className="priority-table">
        <div className="section-title"><h2>{titulo} <span>{acoes.filter(a => a.ativa).length} ativas</span></h2></div>
        <div className="table-scroll"><table>
          <thead><tr><th>Ação</th><th>Eixo</th><th>Recurso</th><th>Custo</th><th>Situação</th><th></th></tr></thead>
          <tbody>{acoes.map(a => (
            <tr key={a.id}>
              <td>{a.acao}</td><td>{a.eixo}</td><td>{a.recurso}</td><td>{a.custo}</td>
              <td><span className={`badge ${a.ativa ? 'medium' : 'none'}`}>{a.ativa ? 'Ativa' : 'Desativada'}</span></td>
              <td><button className="text-button" disabled={ocupado} onClick={() => void executar(() => chamarApi(`/api/acoes/${a.id}`, { method: 'PATCH', json: { ativa: !a.ativa } }).then(() => undefined))}>{a.ativa ? 'Desativar' : 'Reativar'}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
