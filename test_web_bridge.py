import copy
import tempfile
import unittest
import warnings
import json
from pathlib import Path
from openpyxl import load_workbook
import web_bridge as b
import web_llm
from test_recomendar import plano_teste


class TestBridge(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        warnings.filterwarnings('ignore', message='Data Validation extension is not supported')
        cls.entrada = b.entrada_da_planilha(b.TEMPLATE)

    def test_roundtrip_e_m3_atualizado(self):
        entrada = copy.deepcopy(self.entrada)
        entrada['competencias'][0]['atual'] = 'N2 - Usuário autônomo'
        with tempfile.TemporaryDirectory() as tmp:
            resultado = b.processar(entrada, Path(tmp), 'analise')
            self.assertEqual(len(resultado['diagnostico']['priorizadas']), 2)
            wb = load_workbook(Path(tmp) / 'entrada.xlsx', data_only=True)
            self.assertEqual(wb['M3 - Lacunas']['G2'].value, 0)
            self.assertEqual(wb['M3 - Lacunas']['M2'].value, 'Nenhuma')
            wb.close()

    def test_pesos_importados_preservados(self):
        entrada = copy.deepcopy(self.entrada)
        entrada['pesos_criticidade']['Alta'] = 4
        with tempfile.TemporaryDirectory() as tmp:
            resultado = b.processar(entrada, Path(tmp), 'analise')
            self.assertEqual(resultado['diagnostico']['priorizadas'][0]['score'], 27)

    def test_rejeita_campos_que_poderiam_executar_codigo(self):
        entrada = copy.deepcopy(self.entrada)
        entrada['competencias'][0]['atual'] = '=WEBSERVICE("http://example.com")'
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                b.processar(entrada, Path(tmp), 'analise')

    def test_prompt_compacto_preserva_evidencias_e_regras(self):
        with tempfile.TemporaryDirectory() as tmp:
            resultado = b.processar(self.entrada, Path(tmp), 'analise')
            dados = resultado['diagnostico']
            compacto = b.r.mensagens(dados)
            completo = b.r.mensagens({**dados, 'prompt_compacto': False})
            contexto = json.loads(compacto[1]['content'])['dados']
            self.assertEqual(contexto['salvaguardas'], dados['salvaguardas'])
            self.assertEqual(contexto['metodologia']['trechos'], dados['metodologia']['trechos'])
            self.assertEqual([c['id'] for c in contexto['priorizadas']], [c['id'] for c in dados['priorizadas']])
            self.assertEqual(contexto['priorizadas'][0]['acoes_permitidas'], dados['priorizadas'][0]['acoes_permitidas'])
            self.assertEqual(contexto['priorizadas'][0]['contexto_tarefa']['tarefa'], dados['priorizadas'][0]['contexto_tarefa']['tarefa'])
            self.assertLess(len(json.dumps(compacto)), len(json.dumps(completo)))

    def test_rejeita_criterio_de_outra_tarefa_e_promessa_de_resultado(self):
        with tempfile.TemporaryDirectory() as tmp:
            dados = b.processar(self.entrada, Path(tmp), 'analise')['diagnostico']
            plano = plano_teste(dados)
            referencias = b.r.criterios_referencia(dados)
            for proposta in plano.recomendacoes:
                proposta.criterio_conclusao = referencias[proposta.competencia_id]
            b.r.validar(plano, dados)
            outra_tarefa = plano.model_copy(deep=True)
            outra_tarefa.recomendacoes[0].criterio_conclusao = plano.recomendacoes[1].criterio_conclusao
            with self.assertRaises(ValueError):
                b.r.validar(outra_tarefa, dados)
            promessa = plano.model_copy(deep=True)
            promessa.recomendacoes[0].justificativa = 'A revisão do gestor garante que a autonomia será alcançada.'
            with self.assertRaises(ValueError):
                b.r.validar(promessa, dados)

    def test_seletor_nao_troca_tarefas_e_respeita_prazo_do_gestor(self):
        entrada = copy.deepcopy(self.entrada)
        entrada['prazo_dias_proposto'] = 21
        with tempfile.TemporaryDirectory() as tmp:
            dados = b.processar(entrada, Path(tmp), 'analise')['diagnostico']
            contexto, _ = web_llm.contexto(dados)
            escolhas = web_llm.Escolhas(e=[web_llm.Escolha(c=c['id'], a=1, j='A prática pode contribuir para executar a tarefa com autonomia.') for c in contexto['competencias']])
            plano = web_llm.montar_plano(dados, escolhas)
            for p in plano.recomendacoes:
                self.assertEqual(p.prazo_dias_sugerido, 21)
                self.assertEqual(p.criterio_conclusao, b.r.criterios_referencia(dados)[p.competencia_id])
            escolhas.e.reverse()
            with self.assertRaises(ValueError):
                web_llm.montar_plano(dados, escolhas)
            escolhas.e.reverse()
            escolhas.e[0].a = 999
            with self.assertRaises(ValueError):
                web_llm.montar_plano(dados, escolhas)

    def test_prazo_invalido_rejeitado(self):
        for prazo in (0, 181, True, '14'):
            with self.assertRaises(ValueError):
                b.validar_entrada({**self.entrada, 'prazo_dias_proposto': prazo})


if __name__ == '__main__':
    unittest.main()
