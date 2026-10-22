import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bancoDeTeste, exemploAtendente, inserirEmpresa } from './apoio-testes.ts';
import { registrarAvaliacao } from './avaliacoes.ts';
import { arquivarFuncao, criarFuncao } from './funcoes.ts';
import { coletarMetricas, resumoDeExtracoes } from './metricas-dados.ts';
import { arquivarOcupante, criarOcupante } from './ocupantes.ts';

function cenario() {
  const db = bancoDeTeste();
  const empresa = inserirEmpresa(db, 'Loja Local');
  db.prepare("INSERT INTO usuarios (id, email, senha_hash, papel, empresa_id, criado_em) VALUES ('u1', 'g@l.com', 'x', 'gestor', ?, '2026-10-20')").run(empresa);
  const { nome, estrutura, niveis } = exemploAtendente();
  const funcao = criarFuncao(db, empresa, { nome, estrutura, origem: 'planilha' });
  const primeiro = criarOcupante(db, empresa, funcao, { apelido: 'Primeiro', niveis });
  const segundo = criarOcupante(db, empresa, funcao, { apelido: 'Segundo', niveis });
  db.prepare('UPDATE ocupantes SET tempo_ativo_s = 600 WHERE id = ?').run(primeiro);
  db.prepare('UPDATE funcoes SET tempo_ativo_s = 1200 WHERE id = ?').run(funcao);
  const execucao = (id: string, ocupante: string | null, tipo: string, quando: string) =>
    db.prepare('INSERT INTO execucoes (id, tipo, empresa_id, funcao_id, ocupante_id, criada_por, criada_em) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, tipo, empresa, ocupante ? funcao : null, ocupante, 'u1', quando);
  execucao('t-velha', segundo, 'trilha', '2026-10-20T10:00:00Z');
  execucao('t-nova', segundo, 'trilha', '2026-10-21T10:00:00Z');
  execucao('t-quebrada', primeiro, 'trilha', '2026-10-21T11:00:00Z');
  execucao('x1', null, 'extracao', '2026-10-21T09:00:00Z');
  execucao('x2', null, 'extracao', '2026-10-21T09:30:00Z');
  arquivarOcupante(db, empresa, primeiro);
  registrarAvaliacao(db, empresa, funcao, { nota: 4, comentario: '' });
  return { db, empresa, funcao };
}

const analise = (priorizadas: number) => ({ diagnostico: { priorizadas: Array.from({ length: priorizadas }, () => ({})) }, plano: { recomendacoes: [{ decisao: 'recomendada', prazo_dias_sugerido: 14, criterio_conclusao: 'c' }] } });
const ler = (id: string) => {
  if (id === 't-nova') return analise(3);
  if (id === 't-velha') return analise(1);
  if (id === 't-quebrada') throw new Error('arquivo corrompido');
  if (id === 'x1') return { tarefas: [], metadados: { tempo_segundos: 80 } };
  return null;
};

test('coleta tempos, última trilha concluída por ocupante e notas', () => {
  const { db } = cenario();
  const [d] = coletarMetricas(db, ler);
  assert.deepEqual([d.empresa, d.funcao, d.arquivada, d.tempoEstruturaS, d.tempoPrimeiroOcupanteS, d.ocupantesAtivos, d.trilhasGeradas], ['Loja Local', 'Atendente de balcão', false, 1200, 600, 1, 3]);
  assert.deepEqual(d.ultimasTrilhas, [{ ocupante: 'Segundo', priorizadas: 3, recomendacoes: [{ decisao: 'recomendada', prazo: 14, criterio: 'c' }] }]);
  assert.deepEqual(d.notas, [4]);
});

test('inclui funções arquivadas e filtra por empresa', () => {
  const { db, empresa, funcao } = cenario();
  arquivarFuncao(db, empresa, funcao);
  assert.equal(coletarMetricas(db, ler)[0].arquivada, true);
  assert.deepEqual(coletarMetricas(db, ler, crypto.randomUUID()), []);
});

test('resume as extrações por empresa', () => {
  const { db } = cenario();
  assert.deepEqual(resumoDeExtracoes(db, ler), [{ empresa: 'Loja Local', pedidas: 2, concluidas: 1, tempoMedioS: 80, funcoesPorIA: 0 }]);
});
