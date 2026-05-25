"""
validators.py — Validação de CPF e CRM para o RetAI, com internacionalização.

CPF : algoritmo oficial dos dígitos verificadores (100 % local).
CRM : consulta a API consultacrm.com.br com fallback automático entre duas chaves.

Parâmetro 'lang' esperado em todas as funções públicas para retornar mensagens traduzidas.
"""

from os import getenv
import re
import unicodedata
import httpx
from fastapi import HTTPException
from i18n import t

# ──────────────────────────────────────────────────────────────────────────────
# NOME — Validação de Correspondência CFM
# ──────────────────────────────────────────────────────────────────────────────

def validar_correspondencia_nome(nome_input: str, nome_cfm: str) -> bool:
    """
    Verifica se o nome inserido é uma subsequência válida do nome do CFM.
    Permite nomes omitidos e abreviações, desde que a ordem original seja mantida.
    """
    def normalizar(txt: str) -> list[str]:
        txt_sem_acento = ''.join(c for c in unicodedata.normalize('NFD', txt) if unicodedata.category(c) != 'Mn')
        palavras = re.findall(r'\b[a-z]+\b', txt_sem_acento.lower())
        stopwords = {"de", "da", "do", "das", "dos", "e"}
        return [p for p in palavras if p not in stopwords]

    tokens_input = normalizar(nome_input)
    tokens_cfm = normalizar(nome_cfm)

    if not tokens_input or not tokens_cfm:
        return False

    i, j = 0, 0
    while i < len(tokens_input) and j < len(tokens_cfm):
        if tokens_cfm[j].startswith(tokens_input[i]):
            i += 1
            j += 1
        else:
            j += 1

    return i == len(tokens_input)

# ──────────────────────────────────────────────────────────────────────────────
# CPF
# ──────────────────────────────────────────────────────────────────────────────

_CPF_BLACKLIST = {str(d) * 11 for d in range(10)}

def _cpf_digits(cpf_clean: str) -> bool:
    def calc(digits, weights):
        total = sum(int(d) * w for d, w in zip(digits, weights))
        remainder = (total * 10) % 11
        return 0 if remainder == 10 else remainder

    d1 = calc(cpf_clean[:9], range(10, 1, -1))
    d2 = calc(cpf_clean[:10], range(11, 1, -1))
    return cpf_clean[9] == str(d1) and cpf_clean[10] == str(d2)

def validar_cpf(cpf: str, lang: str = "pt_BR") -> None:
    cpf_clean = re.sub(r"\D", "", cpf)

    if len(cpf_clean) != 11:
        raise HTTPException(status_code=422, detail=t("CPF inválido: deve conter exatamente 11 dígitos.", lang))
    if cpf_clean in _CPF_BLACKLIST:
        raise HTTPException(status_code=422, detail=t("CPF inválido: número não permitido.", lang))
    if not _cpf_digits(cpf_clean):
        raise HTTPException(status_code=422, detail=t("CPF inválido: dígitos verificadores incorretos.", lang))

# ──────────────────────────────────────────────────────────────────────────────
# CRM — API pública do Portal CFM
# ──────────────────────────────────────────────────────────────────────────────

_UFS_VALIDAS = {
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
    "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
    "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
}

_CFM_TIMEOUT = 8.0
_CONSULTACRM_BASE = "https://www.consultacrm.com.br/api/index.php"
_CONSULTACRM_KEYS = [k for k in getenv("CONSULTACRM_KEYS", "").split(",") if k]

def _parse_crm(crm: str, lang: str = "pt_BR") -> tuple[str, str]:
    crm = crm.strip().upper()
    crm = re.sub(r"^CRM[\s\-/]*", "", crm)

    m = re.match(r"^(\d+)[\s\-/]+([A-Z]{2})$", crm)
    if not m:
        m = re.match(r"^(\d+)([A-Z]{2})$", crm)
    if not m:
        raise HTTPException(
            status_code=422,
            detail=t("Formato de CRM inválido. Use: número seguido da UF (ex: 123456-SP, 123456/SP ou 123456 SP).", lang),
        )

    numero, uf = m.group(1), m.group(2)

    if uf not in _UFS_VALIDAS:
        raise HTTPException(
            status_code=422,
            detail=t("UF '{}' inválida no CRM. Use a sigla do estado (ex: SP, RJ, MG).", lang).format(uf),
        )

    return numero, uf

async def _consultar_crm_com_chave(numero: str, uf: str, chave: str, lang: str) -> dict | None:
    params = {
        "tipo": "crm",
        "uf": uf,
        "q": numero,
        "chave": chave,
        "destino": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=_CFM_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(_CONSULTACRM_BASE, params=params)
    except httpx.ConnectError:
        raise HTTPException(503, detail=t("Não foi possível conectar ao serviço de validação de CRM.", lang))
    except httpx.TimeoutException:
        raise HTTPException(503, detail=t("Timeout ao consultar o CRM. Tente novamente.", lang))
    except httpx.RequestError as exc:
        raise HTTPException(503, detail=f"{t('Erro de rede:', lang)} {exc}")

    if resp.status_code != 200:
        raise HTTPException(503, detail=t("Serviço de CRM retornou status {}.", lang).format(resp.status_code))

    try:
        data = resp.json()
    except Exception:
        raise HTTPException(503, detail=t("Resposta inesperada do serviço de CRM.", lang))

    erro = data.get("erro") or data.get("error") or ""
    if erro and any(p in str(erro).lower() for p in ("limite", "cota", "chave", "invalid", "key")):
        return None

    return data

async def validar_crm(crm: str, lang: str = "pt_BR") -> dict:
    numero, uf = _parse_crm(crm, lang)

    data = None
    for chave in _CONSULTACRM_KEYS:
        data = await _consultar_crm_com_chave(numero, uf, chave, lang)
        if data is not None:
            break

    if data is None:
        raise HTTPException(
            503,
            detail=t(
                "Limite de consultas de CRM atingido em todas as chaves disponíveis. \n"
                "Tente novamente amanhã ou contate o administrador. \n"
                "Em caso de urgencia, crie uma conta não verificada momentaneamente até o limite ser renovado.",
                lang,
            ),
        )

    total = int(data.get("total", 0))
    items = data.get("item") or []

    if not total or not items:
        raise HTTPException(
            404,
            detail=t("CRM {} não encontrado. Verifique o número e o estado.", lang).format(f"{numero}/{uf}"),
        )

    medico = items[0]
    situacao = str(medico.get("situacao", "")).upper()
    nome_cfm = medico.get("nome", "")

    situacoes_invalidas = {"CANCELADO", "SUSPENSO", "INATIVO", "FALECIDO", "TRANSFERIDO"}
    if any(s in situacao for s in situacoes_invalidas):
        raise HTTPException(
            422,
            detail=t(
                "CRM {} está com situação '{}' no cadastro e não pode ser usado para cadastro.", lang
            ).format(f"{numero}/{uf}", situacao),
        )

    return {
        "numero": numero,
        "uf": uf,
        "nome_cfm": nome_cfm,
        "situacao": situacao,
        "dados_completos": medico,
    }