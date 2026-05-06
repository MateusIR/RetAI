"""
ml_engine.py — Motor de IA (MOCK para MVP)

Para produção, substituir o conteúdo de `analisar_imagem` por:
1. Carregamento do modelo: torch.load() ou torchvision.models
2. Pré-processamento: torchvision.transforms (resize, normalize)
3. Inferência: model(tensor).softmax(dim=1)
4. Mapeamento dos índices para nomes de doenças

Modelos recomendados para doenças oculares (BRSET / IDRiD):
- EfficientNet-B3 (torchvision.models.efficientnet_b3)
- ResNet-50 (torchvision.models.resnet50)
- ViT-B/16 (torchvision.models.vit_b_16)
"""

import time
import random
import os

# ── Produção: descomente e ajuste ──────────────────────────────────────────
# import torch
# import torchvision.transforms as T
# from torchvision import models
# from PIL import Image
#
# MODEL_PATH = os.getenv("MODEL_PATH", "modelo_ocular.pt")
# DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# NUM_CLASSES = 5
#
# def _carregar_modelo():
#     model = models.efficientnet_b3(pretrained=False)
#     model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, NUM_CLASSES)
#     model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
#     model.eval()
#     return model.to(DEVICE)
#
# _model = _carregar_modelo()
#
# CLASSES = [
#     "Retinopatia Diabética",
#     "Glaucoma",
#     "Catarata",
#     "Degeneração Macular",
#     "Normal",
# ]
#
# _transforms = T.Compose([
#     T.Resize((224, 224)),
#     T.ToTensor(),
#     T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
# ])
#
# def analisar_imagem(caminho_arquivo: str) -> list[dict]:
#     img = Image.open(caminho_arquivo).convert("RGB")
#     tensor = _transforms(img).unsqueeze(0).to(DEVICE)
#     with torch.no_grad():
#         probs = torch.softmax(_model(tensor), dim=1)[0].tolist()
#     resultados = [
#         {"doenca": CLASSES[i], "confianca": round(p * 100, 2)}
#         for i, p in enumerate(probs)
#         if p >= 0.15  # Filtra classes com confiança acima de 15%
#     ]
#     return sorted(resultados, key=lambda x: x["confianca"], reverse=True)
# ──────────────────────────────────────────────────────────────────────────

MODEL_VERSION = "mock-v0.1"

DOENCAS_MOCK = [
    "Retinopatia Diabética",
    "Glaucoma",
    "Catarata",
    "Degeneração Macular Relacionada à Idade",
    "Oclusão de Veia Retiniana",
    "Normal",
]


def analisar_imagem(caminho_arquivo: str) -> list[dict]:
    """
    MOCK — Simula inferência com delay realista.
    Retorna lista de doenças detectadas com confiança >= 50%.
    """
    if not os.path.exists(caminho_arquivo):
        raise FileNotFoundError(f"Imagem não encontrada: {caminho_arquivo}")

    # Simula tempo de processamento (GPU/CPU)
    time.sleep(random.uniform(2.0, 4.5))

    # Sorteia entre 1 e 3 doenças com confiança variada
    num_doencas = random.randint(1, 3)
    selecionadas = random.sample(DOENCAS_MOCK, num_doencas)

    resultados = []
    for doenca in selecionadas:
        confianca = round(random.uniform(52.0, 98.5), 2)
        resultados.append({"doenca": doenca, "confianca": confianca})

    return sorted(resultados, key=lambda x: x["confianca"], reverse=True)
