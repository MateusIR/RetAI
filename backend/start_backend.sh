#!/usr/bin/env bash
# start_backend.sh — Inicia o servidor FastAPI
# Use: ./start_backend.sh (ou bash start_backend.sh no Windows WSL)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cria venv se não existir
if [ ! -d ".venv" ]; then
  echo "📦 Criando ambiente virtual..."
  python3 -m venv .venv
fi

# Ativa venv
source .venv/bin/activate

# Instala dependências
echo "📥 Instalando dependências..."
pip install -q -r requirements.txt

# Inicia API
echo "🚀 Iniciando API em http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
