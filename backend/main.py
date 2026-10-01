import os
import sys
from dotenv import load_dotenv

if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    # Executável compilado pelo PyInstaller
    env_path = os.path.join(sys._MEIPASS, '.env')
    load_dotenv(env_path)
else:
    load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import auth, medicos, diagnosticos

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="RetAI API", version="1.0.0")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", 
    "http://localhost:1420,tauri://localhost,https://tauri.localhost,http://localhost:8000,http://127.0.0.1:8000"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Armazenamento de imagens ──────────────────────────────────────────────────
IMG_DIR = os.getenv("IMG_DIR", "./imagens_salvas")
os.makedirs(IMG_DIR, exist_ok=True)
app.mount("/imagens_salvas", StaticFiles(directory=IMG_DIR), name="imagens_salvas")

# ── Rotas ─────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(medicos.router)
app.include_router(diagnosticos.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    import multiprocessing
    
    # Necessário para o PyInstaller no Windows não gerar processos infinitos
    multiprocessing.freeze_support()
    
    # Rodar o app numa única thread principal, sem reload
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")