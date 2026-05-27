import os
import sys
import time
import random
import torch
import timm
import torchvision.transforms as T
from PIL import Image

if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PESOS_DIR = os.path.join(BASE_DIR, "iaModels")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

from models_config import CLASSES, NUM_CLASSES, IMAGE_SIZE, THRESHOLD

_MEAN = [0.485, 0.456, 0.406]
_STD  = [0.229, 0.224, 0.225]

_transforms = T.Compose([
    T.Resize((IMAGE_SIZE, IMAGE_SIZE), interpolation=T.InterpolationMode.BICUBIC),
    T.ToTensor(),
    T.Normalize(mean=_MEAN, std=_STD),
])

_modelos_carregados = {}

def obter_config_modelo(nome_modelo: str):
    if nome_modelo == "EfficientNetV2":
        return {"timm_name": "tf_efficientnetv2_s.in21k_ft_in1k", "weights_file": "efficientnet_ocular.pth"}
    return {"timm_name": "convnextv2_tiny.fcmae_ft_in1k", "weights_file": "convnext_ocular.pth"}

def carregar_modelo_ia(nome_modelo: str):
    global _modelos_carregados
    config = obter_config_modelo(nome_modelo)
    caminho_pesos = os.path.join(PESOS_DIR, config["weights_file"])
    
    if nome_modelo in _modelos_carregados:
        return _modelos_carregados[nome_modelo], os.path.exists(caminho_pesos)
        
    print(f"[IA] Inicializando arquitetura: {config['timm_name']}")
    model = timm.create_model(config["timm_name"], pretrained=False, num_classes=NUM_CLASSES)
    
    tem_pesos = os.path.exists(caminho_pesos)
    if tem_pesos:
        state = torch.load(caminho_pesos, map_location=DEVICE)
        if isinstance(state, dict) and "model_state_dict" in state:
            state = state["model_state_dict"]
        model.load_state_dict(state)
        print(f"[IA] Pesos carregados com sucesso de: {caminho_pesos}")
    else:
        print(f"[IA] ATENÇÃO: Arquivo de pesos '{caminho_pesos}' não encontrado. Rodará em MOCK.")
        
    model.eval()
    model.to(DEVICE)
    
    _modelos_carregados[nome_modelo] = model
    return model, tem_pesos

def _mock() -> list[dict]:
    time.sleep(random.uniform(1.5, 3.0))
    selecionadas = random.sample(CLASSES, random.randint(1, 3))
    return sorted(
        [{"tag": c["tag"], "doenca": c["nome"], "confianca": round(random.uniform(60.0, 99.0), 2)} for c in selecionadas],
        key=lambda x: x["confianca"],
        reverse=True,
    )

def analisar_imagem(caminho_arquivo: str, modelo_escolhido: str = "ConvNextV2") -> list[dict]:
    if not os.path.exists(caminho_arquivo):
        raise FileNotFoundError(f"Imagem não encontrada: {caminho_arquivo}")

    model, tem_pesos = carregar_modelo_ia(modelo_escolhido)

    if not tem_pesos: return _mock()

    img = Image.open(caminho_arquivo).convert("RGB")
    tensor = _transforms(img).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits = model(tensor)                                          
        probs  = torch.sigmoid(logits)[0].tolist()                      

    resultados = []
    for i, p in enumerate(probs):
        if p >= THRESHOLD:
            resultados.append({
                "tag":       CLASSES[i]["tag"],
                "doenca":    CLASSES[i]["nome"],
                "confianca": round(p * 100, 2),
            })

    return sorted(resultados, key=lambda x: x["confianca"], reverse=True)