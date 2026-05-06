import shutil
import uuid
import os
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, Depends, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from models import Base, Paciente, Diagnostico, Imagem, Resultado
from ml_engine import analisar_imagem, MODEL_VERSION

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="Diagnóstico Ocular API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Produção Tauri: ["tauri://localhost", "https://tauri.localhost"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Banco de dados ────────────────────────────────────────────────────────────
DB_PATH = os.getenv("DB_PATH", "./diagnosticos_app.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Armazenamento de imagens ──────────────────────────────────────────────────
IMG_DIR = os.getenv("IMG_DIR", "./imagens_salvas")
os.makedirs(IMG_DIR, exist_ok=True)

# Servir imagens estáticas (para preview no frontend)
app.mount("/imagens", StaticFiles(directory=IMG_DIR), name="imagens")


# ── Worker de processamento ───────────────────────────────────────────────────
def processar_diagnostico_worker(diagnostico_id: int):
    """
    Roda em background thread. Processa cada imagem com o modelo de IA
    e atualiza o banco de dados com os resultados.
    """
    db = SessionLocal()
    try:
        diagnostico = db.query(Diagnostico).filter(Diagnostico.id == diagnostico_id).first()
        if not diagnostico:
            return

        for img in diagnostico.imagens:
            try:
                resultados_ia = analisar_imagem(img.caminho_arquivo)
                for res in resultados_ia:
                    novo_resultado = Resultado(
                        diagnostico_id=diagnostico.id,
                        doenca=res["doenca"],
                        confianca=res["confianca"],
                        olho_analisado=img.tipo,
                    )
                    db.add(novo_resultado)
            except Exception as img_err:
                print(f"[WORKER] Erro ao processar imagem {img.id}: {img_err}")
                raise  # Re-lança para capturar no except externo

        diagnostico.status = "CONCLUIDO"
        diagnostico.data_finalizacao = datetime.utcnow()
        db.commit()
        print(f"[WORKER] Diagnóstico {diagnostico_id} concluído.")

    except Exception as e:
        print(f"[WORKER] Erro fatal no diagnóstico {diagnostico_id}: {e}")
        db.rollback()
        try:
            diag = db.query(Diagnostico).filter(Diagnostico.id == diagnostico_id).first()
            if diag:
                diag.status = "ERRO"
                diag.data_finalizacao = datetime.utcnow()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ── Rotas ─────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "modelo_versao": MODEL_VERSION}


@app.post("/api/diagnosticos/")
async def criar_diagnostico(
    background_tasks: BackgroundTasks,
    nome: str = Form(...),
    idade: int = Form(...),
    sexo: str = Form(...),
    tipo_od: bool = Form(False),
    tipo_oe: bool = Form(False),
    file_od: Optional[UploadFile] = File(None),
    file_oe: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    if not tipo_od and not tipo_oe:
        raise HTTPException(status_code=400, detail="Selecione ao menos um olho para análise.")

    if tipo_od and not file_od:
        raise HTTPException(status_code=400, detail="Arquivo OD não enviado.")
    if tipo_oe and not file_oe:
        raise HTTPException(status_code=400, detail="Arquivo OE não enviado.")

    # 1. Cria paciente
    paciente = Paciente(nome=nome.strip(), idade=idade, sexo=sexo)
    db.add(paciente)
    db.commit()
    db.refresh(paciente)

    # 2. Cria diagnóstico
    diagnostico = Diagnostico(
        paciente_id=paciente.id,
        status="PROCESSANDO",
        modelo_versao=MODEL_VERSION,
    )
    db.add(diagnostico)
    db.commit()
    db.refresh(diagnostico)

    # 3. Salva imagens em disco
    def salvar_imagem(upload: UploadFile, tipo: str) -> str:
        ext = os.path.splitext(upload.filename)[-1] or ".jpg"
        nome_arquivo = f"{uuid.uuid4()}_{tipo}{ext}"
        caminho = os.path.join(IMG_DIR, nome_arquivo)
        with open(caminho, "wb") as buffer:
            shutil.copyfileobj(upload.file, buffer)
        return caminho

    if tipo_od and file_od:
        path_od = salvar_imagem(file_od, "OD")
        db.add(Imagem(diagnostico_id=diagnostico.id, tipo="OD", caminho_arquivo=path_od))

    if tipo_oe and file_oe:
        path_oe = salvar_imagem(file_oe, "OE")
        db.add(Imagem(diagnostico_id=diagnostico.id, tipo="OE", caminho_arquivo=path_oe))

    db.commit()

    # 4. Enfileira processamento
    background_tasks.add_task(processar_diagnostico_worker, diagnostico.id)

    return {
        "message": "Diagnóstico enviado para processamento",
        "diagnostico_id": diagnostico.id,
        "paciente_id": paciente.id,
    }


@app.get("/api/diagnosticos/")
def listar_diagnosticos(
    nome_filtro: Optional[str] = None,
    doenca_filtro: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Diagnostico).join(Paciente)

    if nome_filtro:
        query = query.filter(Paciente.nome.ilike(f"%{nome_filtro}%"))

    if doenca_filtro:
        query = query.join(Resultado).filter(Resultado.doenca.ilike(f"%{doenca_filtro}%"))

    diagnosticos = query.order_by(Diagnostico.data_criacao.desc()).all()

    resultado_lista = []
    for diag in diagnosticos:
        resultados_detalhados = [
            {
                "doenca": r.doenca,
                "confianca": r.confianca,
                "olho": r.olho_analisado,
            }
            for r in diag.resultados
        ]
        doencas_unicas = list({r.doenca for r in diag.resultados})

        resultado_lista.append({
            "id": diag.id,
            "paciente": diag.paciente.nome,
            "idade": diag.paciente.idade,
            "sexo": diag.paciente.sexo,
            "status": diag.status,
            "data_criacao": diag.data_criacao.isoformat() if diag.data_criacao else None,
            "data_finalizacao": diag.data_finalizacao.isoformat() if diag.data_finalizacao else None,
            "doencas_detectadas": doencas_unicas,
            "resultados": resultados_detalhados,
            "modelo_versao": diag.modelo_versao,
        })

    return resultado_lista


@app.get("/api/diagnosticos/{diagnostico_id}")
def detalhe_diagnostico(diagnostico_id: int, db: Session = Depends(get_db)):
    diag = db.query(Diagnostico).filter(Diagnostico.id == diagnostico_id).first()
    if not diag:
        raise HTTPException(status_code=404, detail="Diagnóstico não encontrado")

    imagens = [
        {"tipo": img.tipo, "caminho": img.caminho_arquivo}
        for img in diag.imagens
    ]
    resultados = [
        {"doenca": r.doenca, "confianca": r.confianca, "olho": r.olho_analisado}
        for r in diag.resultados
    ]

    return {
        "id": diag.id,
        "paciente": diag.paciente.nome,
        "idade": diag.paciente.idade,
        "sexo": diag.paciente.sexo,
        "status": diag.status,
        "data_criacao": diag.data_criacao.isoformat() if diag.data_criacao else None,
        "data_finalizacao": diag.data_finalizacao.isoformat() if diag.data_finalizacao else None,
        "imagens": imagens,
        "resultados": resultados,
        "modelo_versao": diag.modelo_versao,
    }
