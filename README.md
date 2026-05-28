# RetAI — Apoio ao Diagnóstico Oftalmológico com IA

O **RetAI** é uma aplicação desktop *local-first* projetada para auxiliar médicos oftalmologistas e clínicos gerais na detecção de patologias oculares através de imagens de fundoscopia. Atuando como uma ferramenta de segunda opinião baseada em *Deep Learning*, o sistema foca em privacidade (adequação à LGPD), rodando o motor de inteligência artificial de forma nativa e isolada na máquina da clínica.

---

## 🛠 Tecnologias e Arquitetura

O sistema adota uma arquitetura cliente-servidor embutida via **Tauri**, empacotando a interface e o motor de processamento local em um único executável.

| Camada | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Interface (Frontend)** | Tauri + React 18 + Vite | Renderização ágil e responsiva com baixo consumo de memória. |
| **Estilização** | Tailwind CSS v4 | Componentes visuais modernos adequados ao ambiente clínico. |
| **Servidor (Backend)** | Python + FastAPI | Alta performance e processamento assíncrono (*Background Tasks*). |
| **Banco de Dados** | SQLite + SQLAlchemy | Armazenamento relacional e *on-premise* focado em privacidade. |
| **Motor de IA** | PyTorch + `timm` | Inferência local utilizando modelos *ConvNeXtV2* e *EfficientNetV2*. |

---

## ✨ Funcionalidades Principais

* **Processamento Multiclasse Local:** Submissão de imagens do Olho Direito (OD) e Olho Esquerdo (OE) para inferência local de múltiplas doenças (Retinopatia Diabética, Edema Macular, DMRI, etc.) em menos de 1 segundo por paciente, sem depender de internet.
* **Controle de Acesso e Antifraude:** Fluxo rigoroso de registro com validação algorítmica de CPF e integração com a API ConsultaCrm para validação oficial do profissional de saúde e bloqueio de fraudes.
* **Contas Não Verificadas:** Fluxo de contingência que permite o acesso à ferramenta sem CRM válido, porém com restrições severas: sem acesso à emissão de laudos e com diagnósticos voláteis (excluídos ao fim da sessão).
* **Gestão de Credenciais Offline:** Sistema descentralizado onde o usuário pioneiro ("Superadmin") pode gerenciar acessos e resetar senhas da equipe localmente, além de possuir um fluxo seguro de *Self-Reset*.
* **Exportação de Laudos Clínicos:** Geração dinâmica de relatórios em PDF para impressão, contendo as imagens, índices de confiança das patologias, dados do paciente e campo para o parecer definitivo do médico.
* **Internacionalização (i18n):** Suporte nativo e dinâmico para os idiomas Português (pt-BR) e Inglês (en).

---

## 📁 Estrutura do Projeto

```text
RetAI/
├── backend/
│   ├── main.py                # Ponto de entrada do FastAPI e roteamento
│   ├── ml_engine.py           # Motor de inferência PyTorch (ConvNext / EfficientNet)
│   ├── models.py              # Esquemas do banco (Medico, Paciente, Diagnostico, etc)
│   ├── security.py            # Autenticação JWT e controle de sessão
│   ├── validators.py          # Validação de CPF, cruzamento de dados e ConsultaCRM
│   ├── routers/               # Endpoints REST (auth.py, medicos.py, diagnosticos.py)
│   ├── services/              # Lógica de serviços (ex: pdf_export.py)
│   ├── iaModels/              # Diretório para os pesos da rede neural (.pth)
│   └── fonts/                 # Fontes `.ttf` para a geração de PDFs
│
└── frontend/src/
    ├── App.tsx                # Layout base, roteamento de tabs e segurança de sessão
    ├── api.ts                 # Camada centralizada de chamadas HTTP (Fetch API)
    ├── useAuth.ts             # Hook customizado para gestão de token e auto-logout
    ├── i18n.ts                # Configuração do i18next (pt-BR, en)
    ├── components/
    │   ├── TelaAuth.tsx       # Módulo de login, registro, e self-reset administrativo
    │   ├── TelaLista.tsx      # Tabela de diagnósticos, filtros multiclasse e ações em massa
    │   ├── TelaNovo.tsx       # Formulário de novo diagnóstico com Drag & Drop de imagens
    │   ├── ModalDetalhe.tsx   # Visualização de resultados, bounding boxes e input de parecer
    │   └── ui/                # Componentes reutilizáveis (Header, Modais, Dialogs, Badges)
    └── utils/
        └── pdfExport.ts       # Geração programática de HTML para impressão
```

---

## 🚀 Como Rodar o Projeto (Desenvolvimento)

### Pré-requisitos

* Python 3.11
* Node.js 18+
* Rust e Tauri CLI instalados.

### 1. Configuração do Backend e Motor de IA

O backend requer os pesos do modelo de IA para rodar a inferência real (caso contrário, rodará em modo Mock gerando resultados aleatórios).

1. Baixe os pesos treinados (`convnext_ocular.pth` e/ou `efficientnet_ocular.pth`).
2. Coloque os arquivos dentro da pasta `backend/iaModels/`.
3. Configure o arquivo `.env`. Requer api key da consultacrm para funções completas.

ex:

CONSULTACRM_KEYS =12341234,.....

JWT_SECRET_KEY=SUA_chave

DB_PATH=./RET_AI.db

IMG_DIR=./imagens_salvas

VITE_API_URL=http://localhost:8000

4. Inicie o servidor:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # No Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

A API estará rodando em `http://localhost:8000`. 

### 2. Configuração do Frontend (Web/Vite)

Para testar a interface de forma ágil pelo navegador:

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:1420`.

### 3. Rodando o App Desktop (Tauri)

Para iniciar o ambiente desktop completo nativo:

```bash
cd frontend
npm run tauri dev
```


---

## ⬇️ Links e Download

[📥 **Baixar o Aplicativo (Download)**](https://drive.google.com/drive/folders/1sP05Jkeo-fZW5V2MVvnPlYOBCFBatMD9?usp=sharing) | [📄 **Ler o Artigo Científico**](#)


---

## ⚠️ Aviso Legal

O RetAI é uma ferramenta tecnológica de apoio ao diagnóstico clínico desenvolvida no contexto de pesquisa acadêmica. Os índices de confiança e resultados preditivos **não substituem**, sob nenhuma hipótese, a avaliação clínica, o julgamento profissional e o laudo de um médico oftalmologista habilitado.