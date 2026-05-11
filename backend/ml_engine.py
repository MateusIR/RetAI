import time
import random
import os
import torch
import torchvision.transforms as T
from torchvision import models
from PIL import Image

MODEL_VERSION = "EfficientNet-B3 / Mock-v0.2"

# ── PRODUÇÃO: Descomente este bloco quando tiver o arquivo .pt ──────────
"""
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
NUM_CLASSES = 6
MODEL_PATH = "modelo_ocular.pt"

CLASSES = [
    "Retinopatia Diabética",
    "Glaucoma",
    "Catarata",
    "Degeneração Macular Relacionada à Idade",
    "Oclusão de Veia Retiniana",
    "Normal",
]

def _carregar_modelo():
    # EfficientNet-B3 é excelente para apps locais pelo equilíbrio entre peso e precisão
    model = models.efficientnet_b3(weights=None)
    model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, NUM_CLASSES)
    if os.path.exists(MODEL_PATH):
        model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
    model.eval()
    return model.to(DEVICE)

# _model = _carregar_modelo()

_transforms = T.Compose([
    T.Resize((300, 300)), # Resolução nativa da EfficientNet-B3
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])
"""
# ──────────────────────────────────────────────────────────────────────────

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
    Simula inferência. Para usar o modelo real, substitua o conteúdo abaixo por:
    img = Image.open(caminho_arquivo).convert("RGB")
    tensor = _transforms(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        output = _model(tensor)
        probs = torch.softmax(output, dim=1)[0].tolist()
    return [{"doenca": CLASSES[i], "confianca": round(p*100, 2)} for i, p in enumerate(probs) if p > 0.1]
    """
    if not os.path.exists(caminho_arquivo):
        raise FileNotFoundError(f"Imagem não encontrada: {caminho_arquivo}")

    time.sleep(random.uniform(1.5, 3.0)) # Delay realista
    num_doencas = random.randint(1, 2)
    selecionadas = random.sample(DOENCAS_MOCK, num_doencas)

    resultados = []
    for doenca in selecionadas:
        confianca = round(random.uniform(60.0, 99.0), 2)
        resultados.append({"doenca": doenca, "confianca": confianca})

    return sorted(resultados, key=lambda x: x["confianca"], reverse=True)