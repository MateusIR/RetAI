from fpdf import FPDF
from io import BytesIO
from datetime import datetime
import os
from i18n import t

def gerar_pdfs_diagnosticos(diagnosticos, lang="pt_BR") -> BytesIO:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(15, 15, 15)

    # Nota: Garanta que essas fontes existam no diretório `fonts/`
    pdf.add_font("Syne", "", "fonts/Syne-Regular.ttf", uni=True)
    pdf.add_font("Syne", "B", "fonts/Syne-Bold.ttf", uni=True)
    pdf.add_font("Syne", "BI", "fonts/Syne-SemiBold.ttf", uni=True)
    pdf.add_font("Syne", "I", "fonts/Syne-Medium.ttf", uni=True)

    def section_title(text: str):
        pdf.set_font("Syne", "BI", 12)
        pdf.set_text_color(20, 20, 20)
        pdf.cell(0, 8, text, ln=True)
        pdf.set_draw_color(230, 230, 230)
        pdf.line(15, pdf.get_y(), 195, pdf.get_y())
        pdf.ln(4)

    def label_value(label: str, value: str):
        pdf.set_font("Syne", "I", 9)
        pdf.set_text_color(110, 110, 110)
        pdf.cell(45, 6, label)
        pdf.set_font("Syne", "", 11)
        pdf.set_text_color(25, 25, 25)
        pdf.cell(0, 6, value, ln=True)

    def formatar_cpf(cpf: str):
        if not cpf: return ""
        digits = ''.join(filter(str.isdigit, cpf))
        if len(digits) == 11: return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"
        return cpf

    for diag in diagnosticos:
        pdf.add_page()
        pdf.set_font("Syne", "B", 18)
        pdf.set_text_color(15, 15, 15)
        pdf.cell(0, 10, t("Laudo de Diagnóstico #{}", lang).format(diag.id), ln=True, align="C")

        pdf.set_font("Syne", "I", 9)
        pdf.set_text_color(120, 120, 120)
        data_emissao = datetime.now().strftime('%d/%m/%Y às %H:%M')
        pdf.cell(0, 6, t("Emitido em {}", lang).format(data_emissao), ln=True, align="C")
        pdf.ln(10)

        section_title(t("Dados do Paciente", lang))
        label_value(t("Paciente", lang), diag.paciente.nome)
        idade_sexo = f"{diag.paciente.idade} {t('anos', lang)} · {t('Masculino', lang) if diag.paciente.sexo == 'M' else t('Feminino', lang)}"
        label_value(t("Idade / Sexo", lang), idade_sexo)
        if diag.paciente.cpf:
            label_value(t("CPF", lang), formatar_cpf(diag.paciente.cpf))
        pdf.ln(3)

        section_title(t("Imagens Retinianas", lang))
        if diag.imagens:
            for img in diag.imagens:
                caminho = img.caminho_arquivo
                if os.path.exists(caminho):
                    try:
                        current_y = pdf.get_y()
                        if current_y > 220: pdf.add_page()
                        pdf.image(caminho, x=35, w=140)
                        pdf.ln(78)
                        pdf.set_font("Syne", "I", 9)
                        pdf.set_text_color(90, 90, 90)
                        olho_label = t("Olho Direito (OD)", lang) if img.tipo == "OD" else t("Olho Esquerdo (OE)", lang)
                        pdf.cell(0, 5, olho_label, ln=True, align="C")
                        pdf.ln(6)
                    except Exception:
                        pdf.set_font("Syne", "", 10)
                        pdf.set_text_color(180, 40, 40)
                        pdf.cell(0, 6, t("Imagem {} indisponível.", lang).format(img.tipo), ln=True)
                        pdf.ln(2)
        else:
            pdf.set_font("Syne", "", 10)
            pdf.set_text_color(120, 120, 120)
            pdf.cell(0, 6, t("Nenhuma imagem disponível.", lang), ln=True)
        pdf.ln(4)

        section_title(t("Resultados da Análise", lang))
        resultados = diag.resultados
        if resultados:
            olhos = {}
            for r in resultados:
                if r.olho_analisado not in olhos: olhos[r.olho_analisado] = []
                olhos[r.olho_analisado].append(r)
            for olho, res_list in olhos.items():
                nome_olho = t("Olho Direito (OD)", lang) if olho == "OD" else t("Olho Esquerdo (OE)", lang)
                pdf.set_font("Syne", "BI", 11)
                pdf.set_text_color(30, 30, 30)
                pdf.cell(0, 7, nome_olho, ln=True)
                pdf.ln(1)
                for r in res_list:
                    pdf.set_font("Syne", "", 10)
                    pdf.set_text_color(35, 35, 35)
                    doenca_traduzida = t(r.doenca, lang)
                    pdf.cell(120, 7, doenca_traduzida)
                    confianca = f"{r.confianca}%"
                    if r.confianca >= 80: pdf.set_text_color(180, 40, 40)
                    elif r.confianca >= 60: pdf.set_text_color(200, 120, 20)
                    else: pdf.set_text_color(30, 140, 70)
                    pdf.set_font("Syne", "BI", 10)
                    pdf.cell(0, 7, confianca, ln=True, align="R")
                pdf.ln(4)
        else:
            pdf.set_font("Syne", "", 10)
            pdf.set_text_color(120, 120, 120)
            pdf.cell(0, 6, t("Nenhum resultado encontrado.", lang), ln=True)
        pdf.ln(2)

        section_title(t("Parecer do Médico Responsável", lang))
        pdf.set_fill_color(248, 248, 248)
        pdf.set_draw_color(225, 225, 225)
        parecer = diag.parecer or t("—", lang)
        pdf.set_font("Syne", "", 11)
        pdf.set_text_color(25, 25, 25)
        pdf.multi_cell(0, 7, parecer, border=1, fill=True)
        pdf.ln(16)

        pdf.set_draw_color(170, 170, 170)
        line_width = 70
        start_x = 125
        pdf.line(start_x, pdf.get_y(), start_x + line_width, pdf.get_y())
        pdf.ln(3)
        pdf.set_font("Syne", "I", 9)
        pdf.set_text_color(110, 110, 110)
        pdf.cell(0, 5, t("Assinatura e carimbo", lang), align="R")

    buffer = BytesIO()
    pdf.output(buffer)
    buffer.seek(0)
    return buffer