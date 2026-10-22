'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import { Campo } from '@/components/Campo';
import type { ResumoEmpresa } from '@/lib/empresas';

const VAZIO = { nome: '', cidade: '', segmento: '', email: '' };
type Acao = 'ativar' | 'desativar' | 'redefinir-senha';

export default function PainelEmpresas({ iniciais }: { iniciais: ResumoEmpresa[] }) {
  const [empresas, setEmpresas] = useState(iniciais);
  const [form, setForm] = useState(VAZIO);
  const [credencial, setCredencial] = useState<{ email: string; senha: string } | null>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const executar = async (acao: () => Promise<void>) => {
    setErro('');
    setOcupado(true);
    try { await acao(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível concluir.'); } finally { setOcupado(false); }
  };
  const recarregar = async () => setEmpresas((await chamarApi<{ empresas: ResumoEmpresa[] }>('/api/admin/empresas')).empresas);
  const criar = (e: React.FormEvent) => {
    e.preventDefault();
    void executar(async () => {
      const r = await chamarApi<{ email: string; senhaTemporaria: string }>('/api/admin/empresas', { method: 'POST', json: form });
      setCredencial({ email: r.email, senha: r.senhaTemporaria });
      setForm(VAZIO);
      await recarregar();
    });
  };
  const alterar = (empresa: ResumoEmpresa, acao: Acao) => {
    const perguntas: Record<Acao, string> = {
      ativar: `Reativar ${empresa.nome}?`,
      desativar: `Desativar ${empresa.nome}? O gestor perde o acesso até a reativação.`,
      'redefinir-senha': `Gerar nova senha temporária para ${empresa.emailGestor}? A senha atual deixa de funcionar.`,
    };
    if (!window.confirm(perguntas[acao])) return;
    void executar(async () => {
      const r = await chamarApi<{ senhaTemporaria?: string }>(`/api/admin/empresas/${empresa.id}`, { method: 'PATCH', json: { acao } });
      if (r.senhaTemporaria) setCredencial({ email: empresa.emailGestor ?? '', senha: r.senhaTemporaria });
      await recarregar();
    });
  };
  const mudar = (campo: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [campo]: e.target.value });
  return (
    <main className="page">
      <div className="page-heading"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Empresas participantes</h1><p>Cadastre cada loja com o e-mail do gestor. A senha temporária aparece uma única vez.</p></div></div>
      {erro && <div className="alert error" role="alert">{erro}<button onClick={() => setErro('')} aria-label="Fechar aviso">×</button></div>}
      {credencial && (
        <div className="alert info" role="status">
          <strong>Acesso de {credencial.email}</strong>
          <p>Senha temporária: <code className="secret">{credencial.senha}</code></p>
          <p>Copie e envie ao gestor agora. Ela não será mostrada de novo; no primeiro acesso o gestor cria a própria senha.</p>
          <button className="text-button" onClick={() => setCredencial(null)}>Já copiei</button>
        </div>
      )}
      <form className="panel form-grid" onSubmit={criar}>
        <h2 className="wide">Nova empresa</h2>
        <Campo rotulo="Nome da loja"><input required maxLength={120} value={form.nome} onChange={mudar('nome')} /></Campo>
        <Campo rotulo="E-mail do gestor"><input type="email" required maxLength={200} value={form.email} onChange={mudar('email')} /></Campo>
        <Campo rotulo="Cidade"><input maxLength={120} value={form.cidade} onChange={mudar('cidade')} /></Campo>
        <Campo rotulo="Segmento"><input maxLength={120} value={form.segmento} onChange={mudar('segmento')} placeholder="Ex.: material de construção" /></Campo>
        <div className="wide"><button className="button primary" disabled={ocupado}>Cadastrar empresa</button></div>
      </form>
      <div className="priority-table">
        <div className="section-title"><h2>Empresas <span>{empresas.length}</span></h2></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Loja</th><th>Gestor</th><th>Último acesso</th><th>Funções</th><th>Ocupantes</th><th>Trilhas</th><th>Situação</th><th></th></tr></thead>
            <tbody>{empresas.map(e => (
              <tr key={e.id}>
                <td><a className="text-button" href={`/admin/empresas/${e.id}`}><strong>{e.nome}</strong></a><br /><span className="helper">{[e.segmento, e.cidade].filter(Boolean).join(' · ')}</span></td>
                <td>{e.emailGestor ?? '—'}</td>
                <td>{e.ultimoAcesso ? new Date(e.ultimoAcesso).toLocaleString('pt-BR') : 'Nunca'}</td>
                <td>{e.funcoes}</td><td>{e.ocupantes}</td><td>{e.trilhas}</td>
                <td><span className={`badge ${e.ativa ? 'medium' : 'none'}`}>{e.ativa ? 'Ativa' : 'Desativada'}</span></td>
                <td><div className="row-actions">
                  <button className="text-button" disabled={ocupado} onClick={() => alterar(e, 'redefinir-senha')}>Nova senha</button>
                  <button className="text-button danger" disabled={ocupado} onClick={() => alterar(e, e.ativa ? 'desativar' : 'ativar')}>{e.ativa ? 'Desativar' : 'Reativar'}</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
