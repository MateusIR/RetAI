"""
validators.py — Validação de CPF e CRM para o RetAI.

CPF : algoritmo oficial dos dígitos verificadores (100 % local, sem chamada externa).
CRM : consulta a API consultacrm.com.br com fallback automático entre duas chaves.
      Em caso de cota esgotada na primeira chave, tenta a segunda automaticamente.

Comportamento de rede:
  - Timeout de 8 s por tentativa.
  - Chave esgotada/inválida → tenta a próxima chave da lista.
  - Todas as chaves esgotadas → 503 com mensagem para o administrador.
  - CRM não encontrado → 404.
  - Erros de rede/servidor → 503.
"""

from os import getenv
import re
import unicodedata
import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session


# ──────────────────────────────────────────────────────────────────────────────
# NOME — Validação de Correspondência CFM
# ──────────────────────────────────────────────────────────────────────────────

def validar_correspondencia_nome(nome_input: str, nome_cfm: str) -> bool:
    """
    Verifica se o nome inserido é uma subsequência válida do nome do CFM.
    Permite nomes omitidos e abreviações (ex: "S" para "Silva"), 
    desde que a ordem original seja mantida.
    """
    def normalizar(txt: str) -> list[str]:
        # Remove acentos
        txt_sem_acento = ''.join(c for c in unicodedata.normalize('NFD', txt) if unicodedata.category(c) != 'Mn')
        # Minúsculas e extração apenas de letras
        palavras = re.findall(r'\b[a-z]+\b', txt_sem_acento.lower())
        # Remove preposições comuns em nomes
        stopwords = {"de", "da", "do", "das", "dos", "e"}
        return [p for p in palavras if p not in stopwords]

    tokens_input = normalizar(nome_input)
    tokens_cfm = normalizar(nome_cfm)

    if not tokens_input or not tokens_cfm:
        return False

    i, j = 0, 0
    # Percorre ambos os nomes
    while i < len(tokens_input) and j < len(tokens_cfm):
        # Verifica se a palavra do CFM começa com a palavra/letra do Input
        if tokens_cfm[j].startswith(tokens_input[i]):
            i += 1  # Achou correspondência, avança o ponteiro do input
            j += 1  # Avança o ponteiro do CFM
        else:
            j += 1  # Não bateu, avança apenas o do CFM para tentar achar mais à frente

    # Se 'i' chegou ao fim da lista do input, significa que todas as palavras
    # inseridas foram encontradas na ordem correta dentro do nome do CFM.
    return i == len(tokens_input)

# ──────────────────────────────────────────────────────────────────────────────
# CPF
# ──────────────────────────────────────────────────────────────────────────────

# Sequências trivialmente inválidas (000.000.000-00, 111.111.111-11, …)
_CPF_BLACKLIST = {str(d) * 11 for d in range(10)}


def _cpf_digits(cpf_clean: str) -> bool:
    """Verifica os dois dígitos verificadores do CPF."""
    def calc(digits, weights):
        total = sum(int(d) * w for d, w in zip(digits, weights))
        remainder = (total * 10) % 11
        return 0 if remainder == 10 else remainder

    d1 = calc(cpf_clean[:9], range(10, 1, -1))
    d2 = calc(cpf_clean[:10], range(11, 1, -1))
    return cpf_clean[9] == str(d1) and cpf_clean[10] == str(d2)


def validar_cpf(cpf: str) -> None:
    """
    Levanta HTTPException 422 se o CPF for inválido.
    Aceita CPF formatado (000.000.000-00) ou só dígitos.
    """
    cpf_clean = re.sub(r"\D", "", cpf)

    if len(cpf_clean) != 11:
        raise HTTPException(
            status_code=422,
            detail="CPF inválido: deve conter exatamente 11 dígitos.",
        )
    if cpf_clean in _CPF_BLACKLIST:
        raise HTTPException(
            status_code=422,
            detail="CPF inválido: número não permitido.",
        )
    if not _cpf_digits(cpf_clean):
        raise HTTPException(
            status_code=422,
            detail="CPF inválido: dígitos verificadores incorretos.",
        )


# ──────────────────────────────────────────────────────────────────────────────
# CRM — API pública do Portal CFM
# ──────────────────────────────────────────────────────────────────────────────

# UFs válidas (incluindo DF)
_UFS_VALIDAS = {
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
    "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
    "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
}


# Timeout em segundos para a chamada ao CFM
_CFM_TIMEOUT = 8.0


def _parse_crm(crm: str) -> tuple[str, str]:
    """
    Extrai (numero, uf) de strings como:
      "123456-SP", "CRM 123456 SP", "123456/SP", "123456SP", "123456 SP"
    Retorna (numero_limpo, uf_maiuscula) ou levanta HTTPException 422.
    """
    crm = crm.strip().upper()
    # Remove prefixo "CRM" se existir
    crm = re.sub(r"^CRM[\s\-/]*", "", crm)

    # Tenta separar número e UF por delimitadores comuns
    m = re.match(r"^(\d+)[\s\-/]+([A-Z]{2})$", crm)
    if not m:
        # Tenta sem delimitador: últimos 2 chars são a UF
        m = re.match(r"^(\d+)([A-Z]{2})$", crm)
    if not m:
        raise HTTPException(
            status_code=422,
            detail=(
                "Formato de CRM inválido. Use: número seguido da UF "
                "(ex: 123456-SP, 123456/SP ou 123456 SP)."
            ),
        )

    numero, uf = m.group(1), m.group(2)

    if uf not in _UFS_VALIDAS:
        raise HTTPException(
            status_code=422,
            detail=f"UF '{uf}' inválida no CRM. Use a sigla do estado (ex: SP, RJ, MG).",
        )

    return numero, uf
_CONSULTACRM_BASE = "https://www.consultacrm.com.br/api/index.php"
_CONSULTACRM_KEYS = [k for k in getenv("CONSULTACRM_KEYS", "").split(",") if k]  # tenta a primeira, cai na segunda se esgotar

async def _consultar_crm_com_chave(numero: str, uf: str, chave: str) -> dict | None:
    """
    Faz uma tentativa com a chave fornecida.
    Retorna o JSON se ok, None se a chave estiver esgotada/inválida,
    ou levanta HTTPException para erros de rede/servidor.
    """
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
        raise HTTPException(503, "Não foi possível conectar ao serviço de validação de CRM.")
    except httpx.TimeoutException:
        raise HTTPException(503, "Timeout ao consultar o CRM. Tente novamente.")
    except httpx.RequestError as exc:
        raise HTTPException(503, f"Erro de rede: {exc}")

    if resp.status_code != 200:
        raise HTTPException(503, f"Serviço de CRM retornou status {resp.status_code}.")

    try:
        data = resp.json()
    except Exception:
        raise HTTPException(503, "Resposta inesperada do serviço de CRM.")

    # Chave esgotada ou inválida — a API retorna erro nesse campo
    erro = data.get("erro") or data.get("error") or ""
    if erro and any(p in str(erro).lower() for p in ("limite", "cota", "chave", "invalid", "key")):
        return None  # sinaliza para tentar a próxima chave

    return data


async def validar_crm(crm: str) -> dict:
    numero, uf = _parse_crm(crm)

    data = None
    for chave in _CONSULTACRM_KEYS:
        data = await _consultar_crm_com_chave(numero, uf, chave)
        if data is not None:
            break

    if data is None:
        raise HTTPException(
            503,
            "Limite de consultas de CRM atingido em todas as chaves disponíveis. \n"
            "Tente novamente amanhã ou contate o administrador. \n"
            "Em caso de urgencia, crie uma conta não verificada momentaneamente até o limite ser renovado."
        )

    total = int(data.get("total", 0))
    items = data.get("item") or []   # ← "item" (singular), não "items"

    if not total or not items:
        raise HTTPException(
            404,
            f"CRM {numero}/{uf} não encontrado. Verifique o número e o estado."
        )

    medico = items[0]
    situacao = str(medico.get("situacao", "")).upper()
    nome_cfm = medico.get("nome", "")

    situacoes_invalidas = {"CANCELADO", "SUSPENSO", "INATIVO", "FALECIDO", "TRANSFERIDO"}
    if any(s in situacao for s in situacoes_invalidas):
        raise HTTPException(
            422,
            f"CRM {numero}/{uf} está com situação '{situacao}' no cadastro "
            "e não pode ser usado para cadastro."
        )

    return {
        "numero": numero,
        "uf": uf,
        "nome_cfm": nome_cfm,
        "situacao": situacao,
        "dados_completos": medico,
    }
    
# ──────────────────────────────────────────────────────────────────────────────
# UNICIDADE — Verificação de duplicatas no banco antes de consultar o CRM
# ──────────────────────────────────────────────────────────────────────────────



def verificar_unicidade_medico(
    db: Session,
    email: str,
    cpf: str,
    crm: str,
    medico_id: int | None = None,  # passar ao editar, None ao criar
) -> None:
    """
    Verifica se email, CPF e CRM já estão cadastrados.
    Levanta HTTPException 409 com campo específico em caso de conflito.
    medico_id é usado para excluir o próprio registro na edição.
    """
    # Import aqui para evitar circular import — ajuste o path se necessário
    from models import Medico  # ← troque por seu import real

    filtro_base = db.query(Medico)
    if medico_id:
        filtro_base = filtro_base.filter(Medico.id != medico_id)

    if filtro_base.filter(Medico.email == email.strip().lower()).first():
        raise HTTPException(
            status_code=409,
            detail="Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
        )

    cpf_clean = re.sub(r"\D", "", cpf)
    if filtro_base.filter(Medico.cpf == cpf).first():
        raise HTTPException(
            status_code=409,
            detail="Este CPF já está cadastrado.",
        )

    numero, uf = _parse_crm(crm)  # já valida formato
    crm_normalizado = f"{numero}-{uf}"
    if filtro_base.filter(Medico.crm == crm_normalizado).first():
        raise HTTPException(
            status_code=409,
            detail="Este CRM já está cadastrado.",
        )