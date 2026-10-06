"""Relatório gerencial em PDF, sem nova inferência."""
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle

ARQUIVO_PDF = 'relatorio-v2.pdf'


def gerar_pdf(pasta: Path):
    resultado = json.loads((pasta / 'analise.json').read_text(encoding='utf-8'))
    dados, plano, meta = resultado['diagnostico'], resultado.get('plano'), resultado['metadados']
    azul, verde, cinza = (colors.HexColor(c) for c in ('#172e4c', '#18765d', '#647184'))
    claro, linha = colors.HexColor('#f3f6fa'), colors.HexColor('#dde4ec')
    largura = A4[0] - 40 * mm
    base = ParagraphStyle('texto', fontName='Helvetica', fontSize=9, leading=13, textColor=azul, spaceAfter=5)
    estilos = {'texto': base}
    for nome, opcoes in {
        'marca': dict(fontName='Helvetica-Bold', fontSize=8, leading=11, textColor=verde, spaceAfter=5),
        'titulo': dict(fontName='Helvetica-Bold', fontSize=21, leading=25, spaceAfter=9),
        'secao': dict(fontName='Helvetica-Bold', fontSize=13, leading=18, spaceBefore=14, spaceAfter=8, keepWithNext=True),
        'item': dict(fontName='Helvetica-Bold', fontSize=11, leading=15, spaceAfter=5, keepWithNext=True),
        'acao': dict(fontName='Helvetica-Bold', fontSize=10, leading=15, spaceAfter=7),
        'muted': dict(fontSize=8.5, leading=12, textColor=cinza),
        'fonte': dict(fontSize=7.5, leading=10, textColor=cinza, spaceAfter=0),
        'celula': dict(fontSize=8.5, leading=12, spaceAfter=0),
        'centro': dict(fontSize=8.5, leading=12, spaceAfter=0, alignment=TA_CENTER),
        'cabecalho': dict(fontName='Helvetica-Bold', fontSize=8, leading=12, spaceAfter=0, textColor=colors.white),
    }.items():
        estilos[nome] = ParagraphStyle(nome, parent=base, **opcoes)

    def texto(valor):
        return escape(str(valor) if valor is not None and str(valor).strip() else 'Não informado').replace('\n', '<br/>')

    def p(valor, estilo='texto'):
        return Paragraph(texto(valor), estilos[estilo])

    def rotulo(label, valor, estilo='texto'):
        return Paragraph(f'<b>{texto(label)}</b><br/>{texto(valor)}', estilos[estilo])

    def tabela(linhas, larguras, fundo=claro, cabecalho=False):
        t = Table(linhas, colWidths=larguras, repeatRows=1 if cabecalho else 0, hAlign='LEFT')
        comandos = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]
        if cabecalho:
            comandos.extend([('BACKGROUND', (0, 0), (-1, 0), azul), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, claro]), ('LINEBELOW', (0, 0), (-1, -1), .3, linha)])
        else:
            comandos.append(('BACKGROUND', (0, 0), (-1, -1), fundo))
        t.setStyle(TableStyle(comandos))
        return t

    def painel(conteudo, fundo=claro):
        return tabela([[conteudo]], [largura], fundo)

    criado = meta.get('gerado_em_utc')
    if criado:
        try:
            criado = datetime.fromisoformat(criado.replace('Z', '+00:00')).astimezone(timezone(timedelta(hours=-3))).strftime('%d/%m/%Y · %H:%M (Brasília)')
        except ValueError:
            pass
    funcoes = list(dict.fromkeys(c['funcao'] for c in dados['competencias']))
    historia = [p('MRCC-PV  /  RELATÓRIO GERENCIAL', 'marca'), p('Plano de desenvolvimento', 'titulo')]
    informacoes = Table([[rotulo('FUNÇÃO ANALISADA', '; '.join(funcoes)), rotulo('DATA DA ANÁLISE', criado, 'muted')]], colWidths=[largura * .63, largura * .37], hAlign='LEFT')
    informacoes.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 12)]))
    historia.extend([informacoes, painel([Paragraph(f'<b>Revisão do gestor pendente.</b> {texto(dados["status_ciclo"])}', estilos['muted'])]), Spacer(1, 2 * mm)])

    historia.append(p('01  Competências e prioridades', 'secao'))
    linhas = [[p(v, 'cabecalho') for v in ['Competência', 'Atual / alvo', 'Lacuna', 'Score', 'Prioridade']]]
    for c in sorted(dados['competencias'], key=lambda c: -c['score']):
        prioridade = Paragraph(f'<font color="{"#a35d27" if c["prioridade"] == "Alta" else "#172e4c"}">{texto(c["prioridade"])}</font>', estilos['centro'])
        linhas.append([p(c['competencia'], 'celula'), p(f'N{c["atual_num"]} / N{c["alvo_num"]}', 'centro'), p(c['lacuna'], 'centro'), p(c['score'], 'centro'), prioridade])
    historia.extend([tabela(linhas, [largura * f for f in (.46, .16, .10, .10, .18)], cabecalho=True), Spacer(1, 3 * mm),
                     p('N0 · Não exposto    N1 · Assistido    N2 · Autônomo    N3 · Crítico', 'muted'), p('O score combina a lacuna com a frequência e a criticidade da tarefa.', 'fonte')])

    historia.append(p('02  Ações propostas', 'secao'))
    competencias = {c['id']: c for c in dados['competencias']}
    catalogo = {a['id']: a for a in dados['catalogo']}
    if plano and plano['recomendacoes']:
        historia.append(p('Propostas para revisão. O custo do catálogo não inclui o tempo de trabalho da equipe.', 'muted'))
        for i, proposta in enumerate(plano['recomendacoes'], 1):
            c, a = competencias[proposta['competencia_id']], catalogo.get(proposta['acao_id'])
            bloco = [Spacer(1, 3 * mm), p(f'AÇÃO {i:02d}  ·  PRIORIDADE {c["prioridade"].upper()}', 'marca'), p(c['competencia'], 'item'), p(f'Tarefa: {c["tarefa"]}', 'muted')]
            if proposta['decisao'] == 'recomendada' and a:
                bloco.extend([p(a['acao'], 'acao'), p(proposta['justificativa'])])
                fatos = tabela([[rotulo('RESPONSÁVEL SUGERIDO', proposta['responsavel_sugerido'], 'celula'), rotulo('PRAZO SUGERIDO', f'{proposta["prazo_dias_sugerido"]} dias', 'celula'), rotulo('CUSTO NO CATÁLOGO', a['custo'], 'celula')]], [largura / 3] * 3)
                bloco.extend([fatos, Spacer(1, 2 * mm), Paragraph(f'<b>Recurso:</b> {texto(a["recurso"])}', estilos['muted']), painel([p('COMO OBSERVAR A CONCLUSÃO', 'marca'), p(proposta['criterio_conclusao'])], colors.HexColor('#edf6f2'))])
            else:
                decisao = {'sem_acao_adequada': 'Nenhuma ação adequada disponível no catálogo', 'dados_insuficientes': 'Informações insuficientes'}.get(proposta['decisao'], proposta['decisao'])
                bloco.extend([p(decisao, 'acao'), p(proposta['justificativa'])])
            bloco.extend([Spacer(1, 2 * mm), Paragraph(f'<b>Orientação ao gestor:</b> {texto(proposta["orientacao_ao_gestor"])}', estilos['muted']), p('Fontes: ' + '; '.join([c['fonte'], c['contexto_tarefa']['fonte']] + ([a['fonte']] if a else [])), 'fonte'), Spacer(1, 3 * mm)])
            historia.append(KeepTogether(bloco))
    elif plano:
        historia.append(p('Não há lacunas positivas nesta rodada. Revise as salvaguardas e acompanhe o trabalho.'))
    else:
        historia.append(p('Este relatório contém somente o diagnóstico. As recomendações ainda não foram geradas.'))

    if plano and plano['recomendacoes']:
        historia.append(PageBreak())
    historia.append(p('03  Salvaguardas e ajustes', 'secao'))
    salvaguardas = [[p('Âncora / resposta', 'cabecalho'), p('Observações e ajustes registrados', 'cabecalho')]]
    for s in dados['salvaguardas']:
        identificacao = [rotulo(s['ancora'], s['resposta'] or 'Não informada', 'celula'), Spacer(1, 2), p(s['fonte'], 'fonte')]
        conteudo = []
        if s['observacao']:
            conteudo.append(p(s['observacao'], 'celula'))
        if s['ajuste']:
            conteudo.extend([Spacer(1, 2 * mm), rotulo('Ajuste registrado', s['ajuste'], 'celula')])
        elif s['resposta'] != 'Sim':
            conteudo.append(p('Ajuste não registrado.', 'muted'))
        salvaguardas.append([identificacao, conteudo or [p('Sem observação registrada.', 'muted')]])
    quadro_salvaguardas = tabela(salvaguardas, [largura * .32, largura * .68], cabecalho=True)
    quadro_salvaguardas.setStyle(TableStyle([('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)]))
    historia.extend([quadro_salvaguardas, Spacer(1, 3 * mm), p(dados['validacao_bilateral'], 'muted')])
    if dados.get('pendencias'):
        historia.append(p('Pendências para revisão', 'item'))
        historia.extend(p(v) for v in dados['pendencias'])

    historia.extend([p('04  Referências e limites', 'secao'), p('A validação automática confere estrutura, competências e catálogo. A adequação pedagógica, os critérios e a validação bilateral continuam sujeitos à avaliação humana.', 'muted')])
    if meta.get('origem_criterios'):
        historia.append(Paragraph(f'<b>Origem dos critérios:</b> {texto(meta["origem_criterios"])}', estilos['muted']))
    if meta.get('modelo'):
        historia.append(p(f'Modelo utilizado: {meta["modelo"]}', 'muted'))
    for trecho in dados.get('metodologia', {}).get('trechos', []):
        historia.append(Paragraph(f'<b>{texto(trecho["referencia"])}:</b> {texto(trecho["texto"])}', estilos['muted']))
    historia.extend(p(v, 'muted') for v in dados.get('metodologia', {}).get('limites', []))

    def rodape(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(linha)
        canvas.setLineWidth(.5)
        canvas.line(20 * mm, 17 * mm, A4[0] - 20 * mm, 17 * mm)
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(cinza)
        canvas.drawString(20 * mm, 12 * mm, 'MRCC-PV  |  Relatório gerencial · Revisão pendente')
        canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f'{doc.page:02d}')
        canvas.restoreState()

    fd, nome = tempfile.mkstemp(prefix='.relatorio-', suffix='.pdf', dir=pasta)
    os.close(fd)
    temporario = Path(nome)
    try:
        documento = BaseDocTemplate(str(temporario), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm, topMargin=20 * mm, bottomMargin=25 * mm, title='Plano de desenvolvimento MRCC-PV', author='MRCC-PV')
        quadro = Frame(documento.leftMargin, documento.bottomMargin, documento.width, documento.height, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        documento.addPageTemplates(PageTemplate(id='relatorio', frames=[quadro], onPage=rodape))
        documento.build(historia)
        destino = pasta / ARQUIVO_PDF
        temporario.replace(destino)
        return destino
    finally:
        temporario.unlink(missing_ok=True)
