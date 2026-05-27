import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import auth, medicos, diagnosticos

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="RetAI API", version="1.0.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:1420").split(",")
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