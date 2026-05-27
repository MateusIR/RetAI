# ─────────────────────────────────────────────────────────────────────────────
# Classes treinadas (multi-label)
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
IMAGE_SIZE = 256
THRESHOLD = 0.5