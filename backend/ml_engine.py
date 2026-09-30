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
    if nome_modelo == "efficientnet":
        return {"timm_name": "tf_efficientnetv2_s.in21k_ft_in1k", "weights_file": "Finetune_EfficientNetV2-v10-full.pth", "num_classes": NUM_CLASSES}
    if nome_modelo == "convnext_nd":
        return {"timm_name": "convnextv2_tiny.fcmae_ft_in1k", "weights_file": "Finetune_ConvNeXtV2-Kfold_fold2_FULLbrsetND.pth", "num_classes": 8}
    return {"timm_name": "convnextv2_tiny.fcmae_ft_in1k", "weights_file": "Finetune_ConvNeXtV2-Kfold_fold1_FULLbrset.pth", "num_classes": NUM_CLASSES}

def carregar_modelo_ia(nome_modelo: str):
    global _modelos_carregados
    config = obter_config_modelo(nome_modelo)
    caminho_pesos = os.path.join(PESOS_DIR, config["weights_file"])
    
    if nome_modelo in _modelos_carregados:
        return _modelos_carregados[nome_modelo], os.path.exists(caminho_pesos)
        
    print(f"[IA] Inicializando arquitetura: {config['timm_name']}")
    model = timm.create_model(config["timm_name"], pretrained=False, num_classes=config["num_classes"])
    
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

def analisar_imagem(caminho_arquivo: str, modelo_escolhido: str = "multiplo") -> list[dict]:
    if not os.path.exists(caminho_arquivo):
        raise FileNotFoundError(f"Imagem não encontrada: {caminho_arquivo}")

    img = Image.open(caminho_arquivo).convert("RGB")
    tensor = _transforms(img).unsqueeze(0).to(DEVICE)

    def obter_probs(modelo_nome: str):
        model, tem_pesos = carregar_modelo_ia(modelo_nome)
        if not tem_pesos: return None
        with torch.no_grad():
            logits = model(tensor)                                          
            probs  = torch.sigmoid(logits)[0].tolist()
        return probs

    resultados_finais = []

    if modelo_escolhido == "multiplo":
        probs_eff = obter_probs("efficientnet")
        probs_conv_nd = obter_probs("convnext_nd")

        if not probs_eff or not probs_conv_nd:
            return _mock()

        idx_detachment = 8
        has_detachment = probs_eff[idx_detachment] >= THRESHOLD

        for i, class_info in enumerate(CLASSES):
            if i == idx_detachment:
                prob = probs_eff[i]
                include = prob >= THRESHOLD
            else:
                if has_detachment:
                    prob = probs_eff[i]
                    include = prob >= THRESHOLD
                else:
                    prob = (probs_eff[i] + probs_conv_nd[i]) / 2.0
                    include = (probs_eff[i] >= THRESHOLD) or (probs_conv_nd[i] >= THRESHOLD)
            
            if include:
                resultados_finais.append({
                    "tag": class_info["tag"],
                    "doenca": class_info["nome"],
                    "confianca": round(prob * 100, 2),
                })
    else:
        probs = obter_probs(modelo_escolhido)
        if not probs: return _mock()

        for i, p in enumerate(probs):
            if p >= THRESHOLD:
                resultados_finais.append({
                    "tag": CLASSES[i]["tag"],
                    "doenca": CLASSES[i]["nome"],
                    "confianca": round(p * 100, 2),
                })

    return sorted(resultados_finais, key=lambda x: x["confianca"], reverse=True)