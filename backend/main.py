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

from pydantic import BaseModel
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List

from models import Base, Medico, Paciente, Diagnostico, Imagem, Resultado
from ml_engine import analisar_imagem, MODEL_VERSION

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="RetAI API", version="0.1.0")

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


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def get_medico_atual(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # Em um app real, use decodificação JWT aqui. 
    # Para o MVP simplificado, assumiremos que o token é o email.
    medico = db.query(Medico).filter(Medico.email == token).first()
    if not medico:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    return medico

class MedicoCreate(BaseModel):
    nome: str
    cpf: str
    crm: str
    email: str
    senha: str

@app.post("/api/medicos/registrar")
def registrar_medico(medico: MedicoCreate, db: Session = Depends(get_db)):
    senha_hasheada = pwd_context.hash(medico.senha)
    novo_medico = Medico(nome=medico.nome, cpf=medico.cpf, crm=medico.crm, email=medico.email, senha_hash=senha_hasheada)
    db.add(novo_medico)
    db.commit()
    return {"message": "Médico registrado com sucesso"}

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    medico = db.query(Medico).filter(Medico.email == form_data.username).first()
    if not medico or not pwd_context.verify(form_data.password, medico.senha_hash):
        raise HTTPException(status_code=400, detail="Email ou senha incorretos")
    # Retorna o email como token para simplificar no MVP (idealmente gere um JWT)
    return {"access_token": medico.email, "token_type": "bearer"}

@app.post("/api/diagnosticos/")
async def criar_diagnostico(
    background_tasks: BackgroundTasks,
    nome: str = Form(...),
    idade: int = Form(...),
    sexo: str = Form(...),
    cpf: Optional[str] = Form(None),
    tipo_od: bool = Form(False),
    tipo_oe: bool = Form(False),
    file_od: Optional[UploadFile] = File(None),
    file_oe: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    medico_atual: Medico = Depends(get_medico_atual) # Exige login
):
    if not tipo_od and not tipo_oe:
        raise HTTPException(status_code=400, detail="Selecione ao menos um olho para análise.")

    if tipo_od and not file_od:
        raise HTTPException(status_code=400, detail="Arquivo OD não enviado.")
    if tipo_oe and not file_oe:
        raise HTTPException(status_code=400, detail="Arquivo OE não enviado.")

    # 1. Cria paciente
    paciente = Paciente(nome=nome.strip(), cpf=cpf, idade=idade, sexo=sexo)
    db.add(paciente)
    db.commit()
    db.refresh(paciente)

    diagnostico = Diagnostico(
        paciente_id=paciente.id,
        medico_id=medico_atual.id,
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
    cpf_filtro: Optional[str] = None, # Feature 2
    page: int = 1, # Feature 8
    db: Session = Depends(get_db),
    medico_atual: Medico = Depends(get_medico_atual)
):
    query = db.query(Diagnostico).join(Paciente).filter(Diagnostico.medico_id == medico_atual.id)

    if nome_filtro:
        query = query.filter(Paciente.nome.ilike(f"%{nome_filtro}%"))
    if cpf_filtro:
        query = query.filter(Paciente.cpf.ilike(f"%{cpf_filtro}%"))
    if doenca_filtro:
        query = query.join(Resultado).filter(Resultado.doenca.ilike(f"%{doenca_filtro}%"))

    # Paginação: Limite de 30 por página (Feature 8)
    limit = 30
    offset = (page - 1) * limit
    total = query.count()
    diagnosticos = query.order_by(Diagnostico.data_criacao.desc()).offset(offset).limit(limit).all()

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

    return {"total": total, "pagina_atual": page, "dados": resultado_lista}


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

class DeleteModel(BaseModel):
    ids: List[int]

@app.delete("/api/diagnosticos/")
def excluir_diagnosticos(req: DeleteModel, db: Session = Depends(get_db), medico_atual: Medico = Depends(get_medico_atual)):
    diagnosticos = db.query(Diagnostico).filter(
        Diagnostico.id.in_(req.ids), 
        Diagnostico.medico_id == medico_atual.id
    ).all()
    
    for diag in diagnosticos:
        for img in diag.imagens:
            if os.path.exists(img.caminho_arquivo):
                os.remove(img.caminho_arquivo)
        db.delete(diag)
    
    db.commit()
    return {"excluidos": len(diagnosticos)}
