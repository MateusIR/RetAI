"""
validators.py — Validação de CPF e CRM para o RetAI.

CPF : algoritmo oficial dos dígitos verificadores (100 % local, sem chamada externa).
CRM : consulta a API REST pública do portal CFM. Sem chave de acesso necessária.
      Endpoint descoberto em: portal.cfm.org.br/api_rest_php/api/v1/medicos/

Comportamento de rede:
  - Timeout de 8 s por tentativa.
  - Se o CFM estiver fora do ar ou sem internet → ValidationError com mensagem específica
    para que o frontend mostre "Não foi possível verificar o CRM agora. Tente novamente."
  - Se o CRM não for encontrado → ValidationError "CRM não encontrado no cadastro do CFM."
"""

import re
import unicodedata
import httpx
from fastapi import HTTPException



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

# Base da API REST pública do Portal CFM (sem autenticação)
# Endpoint de busca: GET /medicos/busca?numero=XXXXX&uf=UF
_CFM_API_BASE = "https://portal.cfm.org.br/api_rest_php/api/v1/medicos"

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


async def validar_crm(crm: str) -> dict:
    """
    Valida o CRM consultando a API pública do CFM.

    Retorna dict com dados do médico encontrado (nome, situação, etc.).
    Levanta HTTPException com código e mensagem adequados em caso de falha.

    Códigos de erro retornados:
      422 — CRM com formato inválido ou UF desconhecida
      404 — CRM não encontrado no cadastro do CFM
      503 — CFM inacessível (sem internet ou servidor fora do ar)
    """
    numero, uf = _parse_crm(crm)

    url = f"{_CFM_API_BASE}/busca"
    params = {"numero": numero, "uf": uf}

    try:
        async with httpx.AsyncClient(timeout=_CFM_TIMEOUT) as client:
            resp = await client.get(url, params=params)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Não foi possível conectar ao servidor do CFM. "
                "Verifique sua conexão com a internet e tente novamente."
            ),
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=503,
            detail=(
                "O servidor do CFM demorou demais para responder (timeout de 8 s). "
                "Tente novamente em instantes."
            ),
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Erro de rede ao consultar o CFM: {exc}",
        )

    # HTTP 200 esperado; qualquer outro código é falha do servidor do CFM
    if resp.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail=(
                f"O servidor do CFM retornou status {resp.status_code}. "
                "Tente novamente mais tarde."
            ),
        )

    try:
        data = resp.json()
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Resposta inesperada do servidor do CFM (não é JSON válido).",
        )

    # A API retorna {"status": "sucesso", "dados": [...]} ou {"status": "erro", ...}
    status = data.get("status", "")
    dados = data.get("dados") or []

    if status != "sucesso" or not dados:
        raise HTTPException(
            status_code=404,
            detail=(
                f"CRM {numero}/{uf} não encontrado no cadastro do CFM. "
                "Verifique o número e o estado e tente novamente."
            ),
        )

    # Verifica situação da inscrição (ativa/inativa)
    medico_data = dados[0] if isinstance(dados, list) else dados
    situacao = str(medico_data.get("DS_SITUACAO", "")).upper()
    nome_cfm = medico_data.get("NM_MEDICO", "")

    # Situações que bloqueiam o cadastro
    situacoes_invalidas = {"CANCELADO", "SUSPENSO", "INATIVO", "FALECIDO"}
    if any(s in situacao for s in situacoes_invalidas):
        raise HTTPException(
            status_code=422,
            detail=(
                f"CRM {numero}/{uf} está com situação '{situacao}' no CFM "
                "e não pode ser usado para cadastro."
            ),
        )

    return {
        "numero": numero,
        "uf": uf,
        "nome_cfm": nome_cfm,
        "situacao": situacao,
        "dados_completos": medico_data,
    }