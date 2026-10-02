# RetAI — Diagnóstico Ocular com Inteligência Artificial

Sistema desktop avançado para análise de doenças oculares a partir de imagens de fundoscopia, construído com arquitetura cliente-servidor (Desktop UI + API Local).

---

## ⬇️ Links e Download

[📥 **Baixar o Aplicativo (Download)**](https://drive.google.com/drive/folders/1sP05Jkeo-fZW5V2MVvnPlYOBCFBatMD9?usp=sharing) | [📄 **Ler o Artigo Científico**](#)


---

## Funcionalidades

### Frontend (Desktop App)
- **Interface Moderna:** Desenvolvida em React, TypeScript e Tailwind CSS, projetada para rodar de forma nativa e segura com Tauri.
- **Autenticação e Gestão de Usuários:** Sistema de login seguro, suporte a recuperação de senha e gestão de permissões (Administradores vs. Médicos).
- **Internacionalização (i18n):** Suporte nativo a múltiplos idiomas.
- **Gerenciamento de Diagnósticos:**
  - Criação de novos diagnósticos com upload e processamento de múltiplas imagens (olho esquerdo/direito).
  - Listagem de diagnósticos anteriores com filtros e barra de confiança (confidence bar) nos resultados.
- **Exportação:** Geração e exportação detalhada de diagnósticos em PDF para entrega ao paciente.
- **Proteção contra Perda de Dados:** Prevenção de fechamento acidental da aplicação enquanto modelos de IA processam diagnósticos em segundo plano.

### Backend (API & IA)
- **API Robusta:** Construída com FastAPI e Python, gerenciando filas de processamento assíncrono (Background Tasks).
- **Integração de Modelos de IA:**
  - Suporte a modelos de ponta baseados em PyTorch e timm (EfficientNet, ConvNeXt).
  - Suporte a fusão e combinação de predições de múltiplos modelos (Ensemble) para maior precisão, especificamente calibrados.
- **Banco de Dados Local:** Gerenciamento seguro via SQLite + SQLAlchemy.
- **Segurança:** Hashes de senha, verificação de contas e geração/validação de tokens JWT nativos da aplicação.

## Regras de Negócios

1. **Perfis de Acesso:**
   - **SuperAdmin:** Possui privilégios para gerenciar (aprovar/remover e resetar senhas) de outros médicos/usuários na plataforma.
   - **Médico/Usuário Padrão:** Só pode visualizar, criar e exportar os diagnósticos e pacientes associados a ele mesmo.
2. **Ciclo de Vida do Diagnóstico:**
   - Ao criar um diagnóstico, seu status é marcado inicialmente como `PROCESSANDO`.
   - O processamento da imagem é delegado a filas assíncronas no backend, permitindo que a interface continue responsiva.
   - O status é atualizado com as predições (ou erro) na finalização, salvando e carimbando a versão exata do modelo de IA que gerou o resultado.
3. **Auditoria e Segurança Médica:**
   - O sistema armazena a data/hora exata de criação, data/hora de finalização e a versão da IA (`modelo_versao`).
   - Imagens são salvas localmente no disco (nunca como BLOBs pesados no banco de dados) e mapeadas por caminhos persistentes, garantindo leveza e backup fácil do banco SQLite.
4. **Isenção de Responsabilidade Diagnóstica:**
   - O software opera explicitamente como *auxílio diagnóstico experimental*. Resultados gerados pela IA não substituem, em nenhuma hipótese, a avaliação e confirmação de um médico oftalmologista habilitado.

## Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| **Desktop UI** | Tauri + React + TypeScript + Vite + Tailwind CSS |
| **Backend API** | Python 3.11+ + FastAPI |
| **Banco de Dados** | SQLite (via SQLAlchemy) |
| **Modelos de IA** | PyTorch (timm: EfficientNetV2 / ConvNeXtV2) |
| **Geração de PDF** | ReportLab (Backend Python) |

## Estrutura do Projeto

```text
RetAI/
├── backend/
│   ├── main.py           # Ponto de entrada FastAPI, inicialização
│   ├── models.py         # Definição das entidades do Banco (Paciente, Medico, Diagnostico...)
│   ├── ml_engine.py      # Core de IA (Carregamento de pesos PyTorch, Inference, Mock)
│   ├── services/         # Regras de negócio especializadas (ex: pdf_export.py)
│   ├── routers/          # Endpoints segregados (auth, diagnosticos, medicos)
│   ├── iaModels/         # Diretório para armazenamento dos pesos de rede neural (.pth)
│   └── start_backend.sh  # Script de inicialização Unix/Mac
└── frontend/
    ├── src-tauri/        # Configuração da shell do Tauri (Rust) e compilação
    ├── src/
    │   ├── App.tsx       # Navegação, controle de Sessão Global/i18n e Hooks de Fechamento Seguro
    │   ├── api.ts        # Camada de comunicação HTTP
    │   ├── components/   # Views e Modais (TelaLista, TelaAuth, TelaNovo, etc.)
    │   ├── locales/      # Dicionários de tradução (i18n)
    │   └── index.css     # Estilos globais e setup Tailwind
    └── vite.config.ts    # Configuração de bundling
```

## Pré-requisitos

- **Python 3.11** ou superior
- **Node.js 18+** e npm
- **Rust** (para compilar o contêiner Desktop Tauri) — instale via [rustup.rs](https://rustup.rs)
- **Tauri CLI** — (`npm install -g @tauri-apps/cli` ou via cargo)

## Como rodar (Desenvolvimento)

### 1. Backend (Python + FastAPI)

Abra o terminal na raiz do projeto:

```bash
cd backend

# Opção A: Script automático (Linux/macOS)
bash start_backend.sh

# Opção B: Instalação Manual
python -m venv .venv
source .venv/bin/activate        # No Windows use: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
- A API principal responderá em: `http://localhost:8000`
- Documentação OpenAPI/Swagger interativa: `http://localhost:8000/docs`

### 2. App Desktop (Tauri + React)

Abra uma **nova janela de terminal**, mantendo o backend rodando, e inicie o frontend:

```bash
cd frontend
npm install
npm run tauri dev
```
*(Para desenvolver puramente via Web sem os bindings Desktop temporariamente: `npm run dev` na porta 1420).*

## Build para Distribuição (Produção)

```bash
# 1. Backend: Compilar em binário standalone usando PyInstaller
cd backend
pip install pyinstaller
pyinstaller --onefile main.py

# 2. Frontend: Gerar instalador nativo Desktop com Tauri
cd frontend
npm run tauri build
# Os instaladores otimizados (DMG, MSI, AppImage) aparecerão em: src-tauri/target/release/bundle/
```

## Utilizando os Modelos Reais de IA

O sistema possui uma arquitetura _fail-safe_ que, caso não encontre os pesos da rede neural (`.pth`), inicializa um módulo de **Mock**. O Mock injeta _delays_ para simular inferência em GPU e devolve classificações simuladas para facilitar os testes da UI.

Para ativar a inferência real (PyTorch/timm):
1. Adquira os arquivos de pesos finetunados (Ex: `Finetune_EfficientNetV2-full.pth`, `Finetune_ConvNeXtV2.pth`, etc.).
2. Cole-os dentro da pasta `backend/iaModels/`.
3. Reinicie a aplicação backend. O script `ml_engine.py` reconhecerá automaticamente a existência dos pesos, montará as arquiteturas necessárias e utilizará processamento acelerado (CUDA) se disponível na máquina host.


