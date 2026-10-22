'use client';
import { useState } from 'react';
import { chamarApi } from '@/components/api';
import BotoesOpcao from '@/components/BotoesOpcao';
import { Campo } from '@/components/Campo';

export default function AvaliacaoUso({ funcaoId }: { funcaoId: string }) {
  const [nota, setNota] = useState('');
  const [comentario, setComentario] = useState('');
  const [estado, setEstado] = useState<'aberto' | 'enviado' | 'dispensado'>('aberto');
  const [erro, setErro] = useState('');
  if (estado !== 'aberto') return estado === 'enviado' ? <div className="alert info" role="status">Obrigado! Sua avaliação ajuda a pesquisa.</div> : null;
  const enviar = async () => {
    try {
      await chamarApi(`/api/funcoes/${funcaoId}/avaliacao`, { method: 'POST', json: { nota: Number(nota), comentario } });
      setEstado('enviado');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar.');
    }
  };
  return (
    <div className="panel">
      <h2>Como foi preencher esta função?</h2>
      {erro && <div className="alert error" role="alert">{erro}</div>}
      <BotoesOpcao rotulo="1 = muito difícil · 5 = muito fácil" valor={nota} opcoes={['1', '2', '3', '4', '5']} aoMudar={setNota} />
      <Campo rotulo="Comentário (opcional)"><textarea maxLength={500} value={comentario} onChange={e => setComentario(e.target.value)} /></Campo>
      <div className="row-actions">
        <button className="button primary" disabled={!nota} onClick={() => void enviar()}>Enviar</button>
        <button className="text-button" onClick={() => setEstado('dispensado')}>Agora não</button>
      </div>
    </div>
  );
}
