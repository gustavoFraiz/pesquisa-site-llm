"""Teste real e identificado de abstenção: catálogo vazio em caso sintético."""
import argparse
import copy
import json
from datetime import datetime, timezone
from pathlib import Path

import recomendar as r


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("planilha", type=Path)
    parser.add_argument("--modelo", default=r.MODELO)
    args = parser.parse_args()
    dados = copy.deepcopy(r.analisar(args.planilha))
    dados["metodologia"] = r.carregar_pbl4(Path(__file__).parent / "PBL4_Projeto_do_Artefato_1.docx")
    dados["catalogo"] = []
    dados["trilha_existente"] = []
    for c in dados["competencias"] + dados["priorizadas"]:
        c["acoes_permitidas"] = []
    dados["cenario_sintetico"] = "Catálogo vazio para testar abstenção. Não representa alteração das respostas reais."
    pasta = Path(__file__).parent / "resultados" / ("validacao_sem_catalogo_" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ"))
    pasta.mkdir(parents=True)
    pasta.joinpath("entrada_sintetica.json").write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")
    erro = None
    plano, metricas = None, {}
    try:
        plano, metricas = r.gerar(dados, args.modelo, pasta)
        passou = all(p.decisao == "sem_acao_adequada" and p.acao_id is None for p in plano.recomendacoes)
    except (ValueError, RuntimeError, OSError) as e:
        passou, erro = False, str(e)
    resultado = {"tipo": "teste_sintetico_real_da_llm", "cenario": dados["cenario_sintetico"],
                 "expectativa": "sem_acao_adequada para todas as lacunas", "passou": passou,
                 "versao_prompt": r.VERSAO_PROMPT, "metricas": metricas, "plano": plano.model_dump() if plano else None, "erro": erro,
                 "limite": "Este teste não demonstra qualidade pedagógica ou eficácia com gestores."}
    pasta.joinpath("resultado_validacao.json").write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Teste sem catálogo: {'PASSOU' if passou else 'FALHOU'}. Resultados: {pasta}")
    return 0 if passou else 1


if __name__ == "__main__":
    raise SystemExit(main())
