"""Recupera trechos verificáveis do PBL4, sem embeddings nem interpretação automática."""
import hashlib
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

VERSAO_CONTEXTO = "pbl4-m4-v1"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def texto_elemento(elemento):
    return "".join(t.text or "" for t in elemento.findall(".//w:t", NS)).strip()


def carregar_pbl4(caminho: Path) -> dict:
    selecao = {
        "RF09": "§6.1 — RF09", "RF10": "§6.1 — RF10", "RNF08": "§6.2 — RNF08",
        "UC6.principal": "§5.2 — UC6, fluxo principal",
        "UC6.alternativo": "§5.2 — UC6, fluxo alternativo",
        "UC7.principal": "§5.2 — UC7, fluxo principal",
    }
    encontrados = {}
    with zipfile.ZipFile(caminho) as arquivo:
        corpo = ET.fromstring(arquivo.read("word/document.xml")).find("w:body", NS)
        uc = None
        for elemento in corpo:
            if elemento.tag.endswith("}p"):
                texto = texto_elemento(elemento)
                if texto.startswith("UC6 —"):
                    uc = "UC6"
                elif texto.startswith("UC7 —"):
                    uc = "UC7"
                elif texto.startswith("UC") or texto.startswith("6  "):
                    uc = None
            elif elemento.tag.endswith("}tbl"):
                for linha in elemento.findall("w:tr", NS):
                    celulas = [texto_elemento(c) for c in linha.findall("w:tc", NS)]
                    if len(celulas) < 2:
                        continue
                    chave = celulas[0]
                    if chave in ("RF09", "RF10", "RNF08"):
                        encontrados[chave] = celulas[1]
                    elif uc and chave == "Fluxo principal":
                        encontrados[uc + ".principal"] = celulas[1]
                    elif uc == "UC6" and chave == "Fluxo alternativo":
                        encontrados["UC6.alternativo"] = celulas[1]
    faltam = set(selecao) - set(encontrados)
    if faltam:
        raise ValueError("Trechos esperados não encontrados no PBL4: " + ", ".join(sorted(faltam)))
    return {"arquivo": caminho.name, "sha256": hashlib.sha256(caminho.read_bytes()).hexdigest(),
            "versao_contexto": VERSAO_CONTEXTO,
            "trechos": [{"id": chave, "referencia": referencia, "texto": encontrados[chave]} for chave, referencia in selecao.items()],
            "escopo": "A LLM apoia UC6; a decisão é do gestor. UC7 exige participação do gestor e do ocupante.",
            "limites": ["PBL3 não disponível: âncoras completas de N0–N3 e onze indicadores ainda não conferidos.",
                        "Planilha com uma tarefa por competência; PBL4 prevê relação N:N.",
                        "Planilha com uma resposta por salvaguarda; não comprova validação bilateral de UC7."]}
