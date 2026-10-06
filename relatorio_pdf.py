"""PDF de leitura para o gestor, produzido a partir da análise já salva."""
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def gerar_pdf(pasta: Path):
    resultado = json.loads((pasta / 'analise.json').read_text(encoding='utf-8'))
    dados, plano, meta = resultado['diagnostico'], resultado.get('plano'), resultado['metadados']
    azul, verde = colors.HexColor('#172e4c'), colors.HexColor('#18765d')
    estilos = getSampleStyleSheet()
    estilos.add(ParagraphStyle('TituloMRCC', fontName='Helvetica-Bold', fontSize=22, leading=27, textColor=azul, spaceAfter=12))
    estilos.add(ParagraphStyle('SecaoMRCC', fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=verde, spaceBefore=17, spaceAfter=9, keepWithNext=True))
    estilos.add(ParagraphStyle('ItemMRCC', fontName='Helvetica-Bold', fontSize=11, leading=15, textColor=azul, spaceBefore=10, spaceAfter=6, keepWithNext=True))
    estilos.add(ParagraphStyle('TextoMRCC', fontName='Helvetica', fontSize=10, leading=15, textColor=azul, spaceAfter=7, alignment=TA_LEFT))
    estilos.add(ParagraphStyle('TabelaMRCC', parent=estilos['TextoMRCC'], fontSize=9, leading=12, spaceAfter=0))
    historia = []

    def texto(valor):
        return escape(str(valor) if valor is not None and str(valor).strip() else 'Não informado').replace('\n', '<br/>')

    def paragrafo(valor, estilo='TextoMRCC'):
        historia.append(Paragraph(texto(valor), estilos[estilo]))

    def campo(label, valor):
        historia.append(Paragraph(f'<b>{texto(label)}:</b> {texto(valor)}', estilos['TextoMRCC']))

    paragrafo('MRCC-PV', 'TituloMRCC')
    paragrafo('Análise e recomendações para o gestor', 'ItemMRCC')
    funcoes = list(dict.fromkeys(c['funcao'] for c in dados['competencias']))
    campo('Função', '; '.join(funcoes))
    criado = meta.get('gerado_em_utc')
    if criado:
        try:
            criado = datetime.fromisoformat(criado.replace('Z', '+00:00')).astimezone(timezone(timedelta(hours=-3))).strftime('%d/%m/%Y às %H:%M (Brasília)')
        except ValueError:
            pass
    campo('Análise criada em', criado)
    campo('Situação', dados['status_ciclo'])
    paragrafo('Propostas para revisão. A decisão final, os prazos e a avaliação do desenvolvimento cabem ao gestor e ao ocupante da função.')

    paragrafo('1. Competências e prioridades', 'SecaoMRCC')
    paragrafo('N0: não exposto; N1: uso assistido; N2: uso autônomo; N3: uso crítico. A lacuna compara nível atual e nível-alvo; o score também considera frequência e criticidade da tarefa.')
    linhas = [['Competência', 'Atual / alvo', 'Lacuna', 'Score', 'Prioridade']]
    for c in sorted(dados['competencias'], key=lambda c: -c['score']):
        linhas.append([c['competencia'], f'N{c["atual_num"]} / N{c["alvo_num"]}', c['lacuna'], c['score'], c['prioridade']])
    tabela = Table([[Paragraph(texto(v), estilos['TabelaMRCC']) for v in linha] for linha in linhas],
                   colWidths=[80 * mm, 28 * mm, 19 * mm, 18 * mm, 29 * mm], repeatRows=1, hAlign='LEFT')
    tabela.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d8f4e8')),
                               ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3f6fa')]),
                               ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 7),
                               ('RIGHTPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 8),
                               ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    historia.append(tabela)

    paragrafo('2. Propostas de ações', 'SecaoMRCC')
    competencias = {c['id']: c for c in dados['competencias']}
    catalogo = {a['id']: a for a in dados['catalogo']}
    if plano:
        paragrafo(plano['resumo'])
        if not plano['recomendacoes']:
            paragrafo('Não há lacunas positivas nesta rodada. Revise as salvaguardas e acompanhe o trabalho.')
        for i, p in enumerate(plano['recomendacoes'], 1):
            c = competencias[p['competencia_id']]
            paragrafo(f'{i}. {c["competencia"]}', 'ItemMRCC')
            campo('Tarefa', c['tarefa'])
            campo('Prioridade', c['prioridade'])
            a = catalogo.get(p['acao_id'])
            if p['decisao'] == 'recomendada' and a:
                campo('Ação proposta', a['acao'])
                campo('Recurso', a['recurso'])
                campo('Custo informado no catálogo', a['custo'])
                paragrafo('O custo do catálogo não inclui o tempo de trabalho da equipe.')
                campo('Responsável sugerido', p['responsavel_sugerido'])
                campo('Prazo sugerido', f'{p["prazo_dias_sugerido"]} dias')
                campo('Como observar a conclusão', p['criterio_conclusao'])
            else:
                campo('Decisão pendente', {'sem_acao_adequada': 'Nenhuma ação adequada disponível no catálogo', 'dados_insuficientes': 'Informações insuficientes'}.get(p['decisao'], p['decisao']))
            campo('Justificativa', p['justificativa'])
            campo('Orientação ao gestor', p['orientacao_ao_gestor'])
            campo('Fontes', '; '.join([c['fonte'], c['contexto_tarefa']['fonte']] + ([a['fonte']] if a else [])))
            historia.append(Spacer(1, 4 * mm))
    else:
        paragrafo('Este relatório contém somente o diagnóstico. As recomendações ainda não foram geradas.')

    paragrafo('3. Salvaguardas e ajustes do trabalho', 'SecaoMRCC')
    for s in dados['salvaguardas']:
        paragrafo(s['ancora'], 'ItemMRCC')
        campo('Resposta', s['resposta'])
        campo('Observação', s['observacao'])
        campo('Ajuste registrado', s['ajuste'] or 'Não registrado')
        campo('Fonte', s['fonte'])
    paragrafo(dados['validacao_bilateral'])
    if dados.get('pendencias'):
        paragrafo('Pendências para revisão', 'ItemMRCC')
        for pendencia in dados['pendencias']:
            paragrafo(pendencia)

    paragrafo('4. Referências e limites', 'SecaoMRCC')
    paragrafo('A validação automática confere estrutura, competências e catálogo. A adequação pedagógica, os critérios de conclusão e a validação bilateral continuam sujeitos à avaliação humana.')
    if meta.get('origem_criterios'):
        campo('Origem dos critérios', meta['origem_criterios'])
    if meta.get('modelo'):
        campo('Modelo utilizado', meta['modelo'])
    for trecho in dados.get('metodologia', {}).get('trechos', []):
        campo(trecho['referencia'], trecho['texto'])
    for limite in dados.get('metodologia', {}).get('limites', []):
        paragrafo(limite)

    def rodape(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(verde)
        canvas.line(18 * mm, 16 * mm, A4[0] - 18 * mm, 16 * mm)
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(azul)
        canvas.drawString(18 * mm, 11 * mm, 'MRCC-PV | Propostas para revisão do gestor')
        canvas.drawRightString(A4[0] - 18 * mm, 11 * mm, f'Página {doc.page}')
        canvas.restoreState()

    fd, nome = tempfile.mkstemp(prefix='.relatorio-', suffix='.pdf', dir=pasta)
    os.close(fd)
    temporario = Path(nome)
    try:
        documento = SimpleDocTemplate(str(temporario), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
                                     topMargin=18 * mm, bottomMargin=23 * mm, title='Análise e recomendações MRCC-PV', author='MRCC-PV')
        documento.build(historia, onFirstPage=rodape, onLaterPages=rodape)
        destino = pasta / 'relatorio.pdf'
        temporario.replace(destino)
        return destino
    finally:
        temporario.unlink(missing_ok=True)
