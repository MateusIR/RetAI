import time
import random
import os
import torch
import torchvision.transforms as T
from PIL import Image

# ─────────────────────────────────────────────────────────────────────────────
# Metadados do modelo
# ─────────────────────────────────────────────────────────────────────────────
MODEL_VERSION = "ConvNeXtV2-Tiny"

# ─────────────────────────────────────────────────────────────────────────────
# Classes treinadas (multi-label, mesma ordem do TARGET_COLS do notebook)
# Cada entrada tem: chave interna (tag), nome de exibição em PT-BR
# ─────────────────────────────────────────────────────────────────────────────
CLASSES = [
    {"tag": "diabetic_retinopathy",  "nome": "Retinopatia Diabética"},
    {"tag": "macular_edema",         "nome": "Edema Macular"},
    {"tag": "scar",                  "nome": "Cicatriz Retiniana"},
    {"tag": "amd",                   "nome": "Degeneração Macular (AMD)"},
    {"tag": "drusens",               "nome": "Drusens"},
    {"tag": "myopic_fundus",         "nome": "Fundo Míope"},
    {"tag": "increased_cup_disc",    "nome": "Aumento da Relação C/D"},
    {"tag": "vascular_occlusion",    "nome": "Oclusão Vascular Retiniana"},
    {"tag": "retinal_detachment",    "nome": "Descolamento de Retina"},
]

NUM_CLASSES = len(CLASSES)

# ─────────────────────────────────────────────────────────────────────────────
# Configurações do modelo — devem bater com o treinamento
# ─────────────────────────────────────────────────────────────────────────────
IMAGE_SIZE   = 256          # Igual ao IMAGE_SIZE do notebook
THRESHOLD    = 0.5          # Limiar de decisão sigmoid para positivo
MODEL_PATH   = "modelo_ocular.pt"

# Normalização ImageNet (mesma usada no val_transform do notebook)
_MEAN = [0.485, 0.456, 0.406]
_STD  = [0.229, 0.224, 0.225]

# ─────────────────────────────────────────────────────────────────────────────
# Pré-processamento idêntico ao val_transform do notebook
# (sem augmentations — apenas Resize + ToTensor + Normalize)
# ─────────────────────────────────────────────────────────────────────────────
_transforms = T.Compose([
    T.Resize((IMAGE_SIZE, IMAGE_SIZE), interpolation=T.InterpolationMode.BICUBIC),
    T.ToTensor(),
    T.Normalize(mean=_MEAN, std=_STD),
])

# ─────────────────────────────────────────────────────────────────────────────
# Carregamento do modelo (lazy, feito uma única vez)
# ─────────────────────────────────────────────────────────────────────────────
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_model = None


def _carregar_modelo():
    """
    Carrega o ConvNeXtV2-Tiny via timm e injeta os pesos salvos.

    O notebook salva apenas o state_dict do modelo, portanto recriamos
    a arquitetura identicamente antes de carregar os pesos.

    Requer: pip install timm
    """
    try:
        import timm
    except ImportError as exc:
        raise RuntimeError(
            "Biblioteca 'timm' não encontrada. Instale com: pip install timm"
        ) from exc

    # Mesma chamada usada no notebook (convnextv2_tiny.fcmae_ft_in1k)
    model = timm.create_model(
        "convnextv2_tiny.fcmae_ft_in1k",
        pretrained=False,       # pesos vêm do .pt salvo
        num_classes=NUM_CLASSES,
    )

    if os.path.exists(MODEL_PATH):
        state = torch.load(MODEL_PATH, map_location=DEVICE)

        # Suporte a checkpoints que salvam {'model_state_dict': ...}
        if isinstance(state, dict) and "model_state_dict" in state:
            state = state["model_state_dict"]

        model.load_state_dict(state)
        print(f"[modelo] Pesos carregados de '{MODEL_PATH}'")
    else:
        print(
            f"[modelo] ATENÇÃO: '{MODEL_PATH}' não encontrado. "
            "Rodando com pesos aleatórios (modo debug)."
        )

    model.eval()
    return model.to(DEVICE)


def _get_model():
    global _model
    if _model is None:
        _model = _carregar_modelo()
    return _model


# ─────────────────────────────────────────────────────────────────────────────
# Inferência real
# ─────────────────────────────────────────────────────────────────────────────
def _inferir(caminho_arquivo: str) -> list[dict]:
    """Roda o modelo real e retorna as detecções acima do limiar."""
    img = Image.open(caminho_arquivo).convert("RGB")
    tensor = _transforms(img).unsqueeze(0).to(DEVICE)

    model = _get_model()
    with torch.no_grad():
        logits = model(tensor)                          # (1, NUM_CLASSES)
        probs  = torch.sigmoid(logits)[0].tolist()      # sigmoid → [0, 1]

    resultados = []
    for i, p in enumerate(probs):
        if p >= THRESHOLD:
            resultados.append({
                "tag":       CLASSES[i]["tag"],
                "doenca":    CLASSES[i]["nome"],
                "confianca": round(p * 100, 2),
            })

    return sorted(resultados, key=lambda x: x["confianca"], reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
# Fallback mock (usado apenas quando o .pt ainda não existe)
# ─────────────────────────────────────────────────────────────────────────────
def _mock(caminho_arquivo: str) -> list[dict]:
    time.sleep(random.uniform(1.5, 3.0))
    selecionadas = random.sample(CLASSES, random.randint(1, 3))
    return sorted(
        [
            {
                "tag":       c["tag"],
                "doenca":    c["nome"],
                "confianca": round(random.uniform(60.0, 99.0), 2),
            }
            for c in selecionadas
        ],
        key=lambda x: x["confianca"],
        reverse=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Ponto de entrada público
# ─────────────────────────────────────────────────────────────────────────────
def analisar_imagem(caminho_arquivo: str) -> list[dict]:
    """
    Analisa uma imagem de fundo de olho e retorna as patologias detectadas.

    Retorna uma lista de dicts:
        [
            {"tag": "diabetic_retinopathy", "doenca": "Retinopatia Diabética", "confianca": 87.4},
            ...
        ]

    A chave "tag" é a identificação interna (coluna do dataset BRSET).
    A chave "doenca" é o nome legível para exibição no frontend.
    """
    if not os.path.exists(caminho_arquivo):
        raise FileNotFoundError(f"Imagem não encontrada: {caminho_arquivo}")

    if os.path.exists(MODEL_PATH):
        return _inferir(caminho_arquivo)
    else:
        # Modelo ainda não treinado/disponível → simula para dev/demo
        return _mock(caminho_arquivo)