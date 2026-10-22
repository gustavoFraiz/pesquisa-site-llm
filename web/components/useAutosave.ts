'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chamarApi } from './api';

export type EstadoSalvamento = 'salvo' | 'pendente' | 'erro';

/**
 * Salva com debounce de 700 ms, em série, e permite forçar o salvamento antes de navegar ou gerar.
 * `versaoInicial` é a data do último salvamento que a página carregou: o servidor recusa (409) gravar
 * por cima de uma versão mais nova, por exemplo ao voltar pelo navegador para uma página antiga.
 */
export function useAutosave(url: string, corpo: Record<string, unknown>, versaoInicial?: string) {
  const serializado = JSON.stringify(corpo);
  const salvo = useRef(serializado);
  const atual = useRef(serializado);
  const corpoAtual = useRef(corpo);
  const versao = useRef(versaoInicial);
  const cadeia = useRef<Promise<void>>(Promise.resolve());
  const falhou = useRef(false);
  const [estado, setEstado] = useState<EstadoSalvamento>('salvo');
  const [erro, setErro] = useState('');
  useLayoutEffect(() => {
    atual.current = serializado;
    corpoAtual.current = corpo;
  }, [serializado, corpo]);

  const comVersao = () => JSON.stringify({ ...corpoAtual.current, versao: versao.current });

  const salvarAgora = useCallback((): Promise<void> => {
    const tarefa = cadeia.current.then(async () => {
      const valor = atual.current;
      if (valor === salvo.current) return;
      const resposta = await chamarApi<{ versao?: string }>(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: comVersao() });
      if (typeof resposta.versao === 'string') versao.current = resposta.versao;
      salvo.current = valor;
      falhou.current = false;
      if (atual.current === valor) {
        setEstado('salvo');
        setErro('');
      }
    });
    cadeia.current = tarefa.catch((e: unknown) => {
      falhou.current = true;
      setEstado('erro');
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    });
    return tarefa;
  }, [url]);

  useEffect(() => {
    if (serializado === salvo.current) return;
    setEstado('pendente');
    const timer = setTimeout(() => { salvarAgora().catch(() => undefined); }, 700);
    return () => clearTimeout(timer);
  }, [serializado, salvarAgora]);

  useEffect(() => {
    // Saída com alteração pendente (link comum, fechar aba ou navegação interna sem salvarAgora):
    // envia a última versão com keepalive, que sobrevive à troca de página.
    const salvarAoSair = () => {
      if (atual.current === salvo.current) return;
      void fetch(url, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: comVersao() }).catch(() => undefined);
      salvo.current = atual.current;
    };
    // Só pede confirmação quando o último salvamento falhou: aí o envio ao sair provavelmente falha também.
    const aoDescarregar = (e: BeforeUnloadEvent) => { if (falhou.current) e.preventDefault(); else salvarAoSair(); };
    window.addEventListener('beforeunload', aoDescarregar);
    window.addEventListener('pagehide', salvarAoSair);
    return () => {
      window.removeEventListener('beforeunload', aoDescarregar);
      window.removeEventListener('pagehide', salvarAoSair);
      salvarAoSair();
    };
  }, [url]);

  return { estado, erro, salvarAgora };
}
