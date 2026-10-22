'use client';
import { useEffect } from 'react';

/** A cada 30 s, se a aba está visível e houve interação nos últimos 2 min, registra tempo ativo. */
export function useTempoAtivo(tipo: 'funcao' | 'ocupante', id: string): void {
  useEffect(() => {
    let ultimaInteracao = Date.now();
    const marcar = () => { ultimaInteracao = Date.now(); };
    const eventos = ['keydown', 'pointerdown', 'input', 'scroll'];
    eventos.forEach(e => window.addEventListener(e, marcar, { passive: true }));
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - ultimaInteracao > 120_000) return;
      void fetch('/api/tempo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, id }) }).catch(() => undefined);
    }, 30_000);
    return () => {
      clearInterval(timer);
      eventos.forEach(e => window.removeEventListener(e, marcar));
    };
  }, [tipo, id]);
}
