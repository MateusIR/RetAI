import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import auth, medicos, diagnosticos

app = FastAPI(title="RetAI API", version="1.0.0")

# 2. Configura o CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:1420").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Armazenamento de imagens dinâmico (Pasta do Usuário)
USER_HOME = Path.home()
APP_DATA_DIR = USER_HOME / ".retai_data"
IMG_DIR = str(APP_DATA_DIR / "imagens_salvas")

os.makedirs(IMG_DIR, exist_ok=True)
app.mount("/imagens_salvas", StaticFiles(directory=IMG_DIR), name="imagens_salvas")

# 4. Rotas
app.include_router(auth.router)
app.include_router(medicos.router)
app.include_router(diagnosticos.router)

# 5. Inicializador do Servidor embutido (Necessário para o PyInstaller)
if __name__ == "__main__":
    import uvicorn
    import multiprocessing
    
    # Previne que o PyInstaller crie dezenas de processos zumbis
    multiprocessing.freeze_support() 
    
    uvicorn.run(app, host="127.0.0.1", port=8000)