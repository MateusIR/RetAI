"""
Módulo de internacionalização do backend.
Mantém dicionários de tradução para pt_BR e en.
Uso:
    from i18n import t
    msg = t("mensagem original", lang)
"""

TRANSLATIONS = {
    "pt_BR": {
         "diabetic_retinopathy":  "Retinopatia Diabética",
        "macular_edema":         "Edema Macular",
        "scar":                  "Cicatriz Retiniana",
        "amd":                   "Degeneração Macular (DMRI)",
        "drusens":               "Drusas",
        "myopic_fundus":         "Fundo Míope",
        "increased_cup_disc":    "Aumento da Relação C/D",
        "vascular_occlusion":    "Oclusão Vascular Retiniana",
        "retinal_detachment":    "Descolamento de Retina",
        },
    "en": {
        # ── Autenticação / Erros gerais ──────────────────────────────────
        "Token inválido ou expirado": "Invalid or expired token",
        "Token revogado. Faça login novamente.": "Token revoked. Please log in again.",
        "Se o e-mail estiver cadastrado, a solicitação foi enviada ao Administrador.":
            "If the email is registered, the request was sent to the Administrator.",
        "Dados incorretos ou usuário não é Superadmin.":
            "Incorrect data or user is not Superadmin.",
        "A nova senha deve ter ao menos 6 caracteres.":
            "The new password must be at least 6 characters long.",
        "Senha de administrador redefinida com sucesso.":
            "Administrator password successfully reset.",
        "Apenas superadmins podem redefinir senhas.":
            "Only superadmins can reset passwords.",
        "Senha deve ter ao menos 6 caracteres.":
            "Password must have at least 6 characters.",
        "Médico não encontrado.": "Physician not found.",
        "Senha do usuário atualizada com sucesso.":
            "User password updated successfully.",
        "A senha deve ter pelo menos 6 caracteres.":
            "Password must be at least 6 characters long.",
        "Este e-mail já está cadastrado.": "This email is already registered.",
        "Este CPF já está cadastrado.": "This CPF is already registered.",
        "Este CRM já está cadastrado.": "This CRM is already registered.",
        "O nome informado não confere com o titular do CRM no Conselho.":
            "The provided name does not match the CRM holder at the Council.",
        "Médico registrado com sucesso.": "Physician successfully registered.",
        "Conta não verificada criada com sucesso.":
            "Unverified account successfully created.",
        "E-mail ou senha incorretos.": "Incorrect email or password.",
        "Logout realizado com sucesso.": "Logout successfully completed.",
        "Não autorizado.": "Not authorized.",
        "Selecione ao menos um olho.": "Select at least one eye.",
        "Arquivo OD não enviado.": "OD file not sent.",
        "Arquivo OE não enviado.": "OE file not sent.",
        "Processando": "Processing",
        "Diagnóstico não encontrado.": "Diagnosis not found.",
        "Acesso não autorizado.": "Access denied.",
        "Apenas médicos verificados podem preencher o parecer.":
            "Only verified physicians can fill in the report.",
        "Apenas médicos verificados podem gerar PDFs.":
            "Only verified physicians can generate PDFs.",

        # ── Validações CPF / CRM ────────────────────────────────────────
        "CPF inválido: deve conter exatamente 11 dígitos.":
            "Invalid CPF: must contain exactly 11 digits.",
        "CPF inválido: número não permitido.":
            "Invalid CPF: number not allowed.",
        "CPF inválido: dígitos verificadores incorretos.":
            "Invalid CPF: incorrect check digits.",
        "Formato de CRM inválido. Use: número seguido da UF (ex: 123456-SP, 123456/SP ou 123456 SP).":
            "Invalid CRM format. Use: number followed by the state abbreviation (e.g., 123456-SP, 123456/SP or 123456 SP).",
        "UF '{}' inválida no CRM. Use a sigla do estado (ex: SP, RJ, MG).":
            "Invalid state '{}' in CRM. Use the state abbreviation (e.g., SP, RJ, MG).",
        "Não foi possível conectar ao serviço de validação de CRM.":
            "Could not connect to CRM validation service.",
        "Timeout ao consultar o CRM. Tente novamente.":
            "Timeout when querying CRM. Try again.",
        "Serviço de CRM retornou status {}.":
            "CRM service returned status {}.",
        "Resposta inesperada do serviço de CRM.":
            "Unexpected response from CRM service.",
        "Limite de consultas de CRM atingido em todas as chaves disponíveis. \nTente novamente amanhã ou contate o administrador. \nEm caso de urgencia, crie uma conta não verificada momentaneamente até o limite ser renovado.":
            "CRM query limit reached for all available keys.\nTry again tomorrow or contact the administrator.\nIf urgent, create an unverified account temporarily until the limit is renewed.",
        "CRM {} não encontrado. Verifique o número e o estado.":
            "CRM {} not found. Check the number and state.",
        "CRM {} está com situação '{}' no cadastro e não pode ser usado para cadastro.":
            "CRM {} has status '{}' in the registry and cannot be used for registration.",
        "Este e-mail já está cadastrado. Faça login ou use outro e-mail.":
            "This email is already registered. Log in or use another email.",
        "Médicos não verificados não podem ser promovidos a superadmin.":
            "Unverified physicians cannot be promoted to superadmin.",

        # ── PDF ──────────────────────────────────────────────────────────
        "Laudo de Diagnóstico #{}": "Diagnosis Report #{}",
        "Emitido em {}": "Issued on {}",
        "Dados do Paciente": "Patient Data",
        "Paciente": "Patient",
        "Idade / Sexo": "Age / Sex",
        "anos": "years",
        "Masculino": "Male",
        "Feminino": "Female",
        "CPF": "CPF",
        "Imagens Retinianas": "Retinal Images",
        "Olho Direito (OD)": "Right Eye (OD)",
        "Olho Esquerdo (OE)": "Left Eye (OE)",
        "Imagem {} indisponível.": "Image {} unavailable.",
        "Nenhuma imagem disponível.": "No images available.",
        "Resultados da Análise": "Analysis Results",
        "Nenhum resultado encontrado.": "No results found.",
        "Parecer do Médico Responsável": "Attending Physician's Report",
        "Assinatura e carimbo": "Signature and stamp",
        "—": "—",

        # ── Doenças (nomes em português → inglês) ──────────────────────
       # i18n.py — seção de doenças, chaves agora são as tags
        "diabetic_retinopathy": "Diabetic Retinopathy",
        "macular_edema":        "Macular Edema",
        "scar":                 "Retinal Scar",
        "amd":                  "Age-related Macular Degeneration (AMD)",
        "drusens":              "Drusens",
        "myopic_fundus":        "Myopic Fundus",
        "increased_cup_disc":   "Increased Cup/Disc Ratio",
        "vascular_occlusion":   "Retinal Vascular Occlusion",
        "retinal_detachment":   "Retinal Detachment",
 },
}

def t(message: str, lang: str = "pt_BR") -> str:
    """Retorna a mensagem traduzida se existir, caso contrário a original."""
    return TRANSLATIONS.get(lang, {}).get(message, message)