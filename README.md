# OculAI — Diagnóstico Ocular (MVP)

Sistema desktop para análise de doenças oculares a partir de imagens de fundoscopia.

## Stack

| Camada | Tecnologia |
|---|---|
| Desktop UI | Tauri + React + TypeScript + Tailwind CSS |
| Backend API | Python + FastAPI |
| Banco de dados | SQLite (via SQLAlchemy) |
| IA (Produção) | PyTorch — EfficientNet / ResNet / ViT |
| IA (MVP Mock) | Simulação com `time.sleep` + `random` |

## Estrutura do projeto

```
meu-app-diagnostico/
├── backend/
│   ├── main.py           # FastAPI — rotas, fila de background tasks
│   ├── models.py         # SQLAlchemy — Paciente, Diagnostico, Imagem, Resultado
│   ├── ml_engine.py      # Motor de IA (mock → substituir pelo modelo real)
│   ├── requirements.txt
│   ├── start_backend.sh  # Script de inicialização
│   └── imagens_salvas/   # Gerado automaticamente
└── frontend/
    ├── src/
    │   ├── App.tsx                     # Navegação principal + layout
    │   ├── api.ts                      # Camada de serviço HTTP
    │   ├── index.css                   # Tema escuro + classes utilitárias
    │   └── components/
    │       ├── TelaLista.tsx           # Lista de diagnósticos + filtros
    │       ├── TelaNovo.tsx            # Formulário + upload de imagens
    │       └── ModalDetalhe.tsx        # Resultados com barra de confiança
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    └── tailwind.config.js
```

## Pré-requisitos

- **Python 3.11**
- **Node.js 18+**
- **Rust** (para compilar o app Tauri) — instale via https://rustup.rs
- **Tauri CLI** — `cargo install tauri-cli` (ou via npm)

## Como rodar (desenvolvimento)

### 1. Backend Python

```bash
cd backend

# Opção A: Script automático (Linux/macOS)
bash start_backend.sh

# Opção B: Manual
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

A API ficará disponível em: http://localhost:8000
Documentação interativa: http://localhost:8000/docs

### 2. Frontend (modo web — desenvolvimento rápido)

```bash
cd frontend
npm install
npm run dev
```

Acesse: http://localhost:1420

### 3. App Desktop (Tauri)

```bash
cd frontend
npm install
npm run tauri dev
```

> Requer Rust e Tauri CLI instalados. Veja: https://tauri.app/v1/guides/getting-started/prerequisites

## Build para distribuição

```bash
# Backend: empacotar com PyInstaller
pip install pyinstaller
cd backend
pyinstaller --onefile main.py

# Frontend (Tauri):
cd frontend
npm run tauri build
# Gera instalador em: src-tauri/target/release/bundle/
```

## Substituindo o Mock pelo modelo real

Edite `backend/ml_engine.py` e descomente o bloco de produção:

1. Coloque o arquivo do modelo em `backend/modelo_ocular.pt`
2. Ajuste `NUM_CLASSES` e a lista `CLASSES` para seu modelo
3. Descomente as importações e a função `analisar_imagem` real
4. Comente ou remova a versão mock

### Modelos recomendados (BRSET / IDRiD)

```python
# EfficientNet-B3
model = models.efficientnet_b3(pretrained=False)
model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, NUM_CLASSES)

# ResNet-50
model = models.resnet50(pretrained=False)
model.fc = torch.nn.Linear(model.fc.in_features, NUM_CLASSES)
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `DB_PATH` | `./diagnosticos_app.db` | Caminho do banco SQLite |
| `IMG_DIR` | `./imagens_salvas` | Diretório para armazenar imagens |
| `VITE_API_URL` | `http://localhost:8000` | URL da API (frontend) |

## Auditoria

Cada diagnóstico registra:
- Data/hora de criação e finalização
- Versão do modelo utilizado (`modelo_versao`)
- Imagens originais salvas em disco (nunca no banco)
- Todos os resultados com confiança por olho analisado

## Aviso legal

Este software é um auxílio diagnóstico experimental.
Os resultados **não substituem** a avaliação de um oftalmologista habilitado.
