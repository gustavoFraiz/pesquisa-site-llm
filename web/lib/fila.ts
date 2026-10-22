import { HttpErro } from './http.ts';

export type ItemFila = { id: string; empresaId: string; executar: () => Promise<void> };

/** Um worker: as LLMs não disputam os 2 núcleos da VM. Fica em memória; reinício encerra a fila. */
export class Fila {
  #aguardando: ItemFila[] = [];
  #atual: ItemFila | null = null;
  #maxAguardando: number;

  constructor(maxAguardando = 6) {
    this.#maxAguardando = maxAguardando;
  }

  enfileirar(item: ItemFila): number {
    if (this.#atual?.empresaId === item.empresaId || this.#aguardando.some(i => i.empresaId === item.empresaId)) {
      throw new HttpErro(429, 'Já há uma geração desta loja em andamento ou na fila. Aguarde ela terminar.');
    }
    if (this.#aguardando.length >= this.#maxAguardando) throw new HttpErro(429, 'Muitas solicitações agora; tente em alguns minutos.');
    this.#aguardando.push(item);
    this.#processar();
    return this.posicao(item.id) ?? 0;
  }

  posicao(id: string): number | null {
    if (this.#atual?.id === id) return 0;
    const indice = this.#aguardando.findIndex(i => i.id === id);
    return indice < 0 ? null : indice + 1;
  }

  #processar(): void {
    if (this.#atual || !this.#aguardando.length) return;
    const item = this.#aguardando.shift() as ItemFila;
    this.#atual = item;
    void item.executar().catch(() => undefined).finally(() => {
      this.#atual = null;
      this.#processar();
    });
  }
}
