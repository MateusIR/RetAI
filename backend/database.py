import os
import sys
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base
from dotenv import load_dotenv

# Identifica se está rodando via código-fonte ou PyInstaller .exe
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Carrega o .env empacotado
load_dotenv(os.path.join(BASE_DIR, ".env"))

USER_HOME = Path.home()
APP_DATA_DIR = USER_HOME / ".retai_data"
os.makedirs(APP_DATA_DIR, exist_ok=True) # Garante que a pasta existe

# O banco de dados agora mora definitivamente na pasta do usuário
DB_PATH = os.getenv("DB_PATH", str(APP_DATA_DIR / "diagnosticos_app.db"))

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()