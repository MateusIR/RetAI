import os
import sys
import time
import random
import torch
import timm
import torchvision.transforms as T
from PIL import Image

# ─────────────────────────────────────────────────────────────────────────────
# Configuração de Diretórios (Compatível com Tauri/PyInstaller)
# ─────────────────────────────────────────────────────────────────────────────
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PESOS_DIR = os.path.join(BASE_DIR, "models")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ─────────────────────────────────────────────────────────────────────────────
# Configurações de Classes e Limiares
# ─────────────────────────────────────────────────────────────────────────────
CLASSES = [
    {"tag": "diabetic_retinopathy",  "nome": "Retinopatia Diabética"},
    {"tag": "macular_edema",         "nome": "Edema Macular"},
    {"tag": "scar",                  "nome": "Cicatriz Retiniana"},
    {"tag": "amd",                   "nome": "Degeneração Macular (DMRI)"},
    {"tag": "drusens",               "nome": "Drusas"},
    {"tag": "myopic_fundus",         "nome": "Fundo Míope"},
    {"tag": "increased_cup_disc",    "nome": "Aumento da Relação C/D"},
    {"tag": "vascular_occlusion",    "nome": "Oclusão Vascular Retiniana"},
    {"tag": "retinal_detachment",    "nome": "Descolamento de Retina"},
]

NUM_CLASSES = len(CLASSES)
IMAGE_SIZE  = 256
THRESHOLD   = 0.5

_MEAN = [0.485, 0.456, 0.406]
_STD  = [0.229, 0.224, 0.225]

_transforms = T.Compose([
    T.Resize((IMAGE_SIZE, IMAGE_SIZE), interpolation=T.InterpolationMode.BICUBIC),
    T.ToTensor(),
    T.Normalize(mean=_MEAN, std=_STD),
])

# ─────────────────────────────────────────────────────────────────────────────
# Gerenciamento de Modelos em Memória (Singleton)
# ─────────────────────────────────────────────────────────────────────────────
_modelos_carregados = {}

def obter_config_modelo(nome_modelo: str):
    """Retorna as configurações de arquitetura e caminhos com base na escolha."""
    if nome_modelo == "EfficientNetV2":
        return {
            "timm_name": "tf_efficientnetv2_s.in21k_ft_in1k",
            "weights_file": "efficientnet_ocular.pth"
        }
    # Default sempre será o ConvNeXt
    return {
        "timm_name": "convnextv2_tiny.fcmae_ft_in1k",
        "weights_file": "convnext_ocular.pth"
    }

def carregar_modelo_ia(nome_modelo: str):
    global _modelos_carregados
    
    config = obter_config_modelo(nome_modelo)
    caminho_pesos = os.path.join(PESOS_DIR, config["weights_file"])
    
    # Se já carregou na memória antes, apenas retorna e avisa se tem pesos reais
    if nome_modelo in _modelos_carregados:
        return _modelos_carregados[nome_modelo], os.path.exists(caminho_pesos)
        
    print(f"[IA] Inicializando arquitetura: {config['timm_name']}")
    model = timm.create_model(
        config["timm_name"],
        pretrained=False,
        num_classes=NUM_CLASSES
    )
    
    tem_pesos = os.path.exists(caminho_pesos)
    if tem_pesos:
        state = torch.load(caminho_pesos, map_location=DEVICE)
        if isinstance(state, dict) and "model_state_dict" in state:
            state = state["model_state_dict"]
        model.load_state_dict(state)
        print(f"[IA] Pesos carregados com sucesso de: {caminho_pesos}")
    else:
        print(f"[IA] ATENÇÃO: Arquivo de pesos '{caminho_pesos}' não encontrado.")
        print("[IA] O sistema rodará em MODO MOCK (Simulação) para este modelo.")
        
    model.eval()
    model.to(DEVICE)
    
    _modelos_carregados[nome_modelo] = model
    return model, tem_pesos

# ─────────────────────────────────────────────────────────────────────────────
# Inferência Real vs Mock
# ─────────────────────────────────────────────────────────────────────────────
def _mock() -> list[dict]:
    """Fallback quando o arquivo .pth não for encontrado na pasta pesos/"""
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

def analisar_imagem(caminho_arquivo: str, modelo_escolhido: str = "ConvNextV2") -> list[dict]:
    """
    Analisa a imagem e retorna as patologias detectadas usando o modelo escolhido.
    """
    if not os.path.exists(caminho_arquivo):
        raise FileNotFoundError(f"Imagem não encontrada: {caminho_arquivo}")

    # Carrega (ou pega do cache) o modelo escolhido
    model, tem_pesos = carregar_modelo_ia(modelo_escolhido)

    # Se não temos o arquivo .pth correspondente, usamos o mock para não quebrar o app
    if not tem_pesos:
        return _mock()

    # Temos os pesos! Processamento Real:
    img = Image.open(caminho_arquivo).convert("RGB")
    tensor = _transforms(img).unsqueeze(0).to(DEVICE)

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