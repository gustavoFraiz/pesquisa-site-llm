"""Verificação manual da extração com a LLM real. Uso: python validar_extracao.py"""
import json
import tempfile
from pathlib import Path

import recomendar as r
import web_extracao as x

ENTRADA = {
    'funcao': 'Atendente de balcão',
    'descricao': ('O atendente consulta preço e estoque no assistente de IA da loja, monta o orçamento com ajuda da IA, '
                  'revisa o orçamento que a IA gerou antes de entregar ao cliente e negocia prazo quando o cliente está insatisfeito.'),
    'ferramentas': ['Assistente de IA interno (catálogo)'],
}

with tempfile.TemporaryDirectory() as tmp:
    resultado = x.gerar(ENTRADA, r.MODELO, Path(tmp))
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    assert 1 <= len(resultado['tarefas']) <= 12
    print(f"OK: {len(resultado['tarefas'])} tarefa(s) em {resultado['metadados']['tempo_segundos']} s")
