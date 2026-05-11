import shutil
import uuid
import os
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, Depends, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from pydantic import BaseModel
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from models import Base, Medico, Paciente, Diagnostico, Imagem, Resultado
from ml_engine import analisar_imagem, MODEL_VERSION

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="RetAI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.mount("/imagens_salvas", StaticFiles(directory=IMG_DIR), name="imagens_salvas")


# ── Worker de processamento ───────────────────────────────────────────────────
def processar_diagnostico_worker(diagnostico_id: int):
    db = SessionLocal()
    try:
        diagnostico = db.query(Diagnostico).filter(Diagnostico.id == diagnostico_id).first()
        if not diagnostico: return

        for img in diagnostico.imagens:
            try:
                resultados_ia = analisar_imagem(img.caminho_arquivo)
                for res in resultados_ia:
                    db.add(Resultado(diagnostico_id=diagnostico.id, doenca=res["doenca"], confianca=res["confianca"], olho_analisado=img.tipo))
            except Exception: pass

        diagnostico.status = "CONCLUIDO"
        diagnostico.data_finalizacao = datetime.utcnow()
        db.commit()
    except Exception:
        db.rollback()
        diag = db.query(Diagnostico).filter(Diagnostico.id == diagnostico_id).first()
        if diag:
            diag.status = "ERRO"
            db.commit()
    finally:
        db.close()

# ── Autenticação ─────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def get_medico_atual(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
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

class MedicoUpdate(BaseModel):
    nome: str
    crm: str
    email: str

@app.post("/api/medicos/registrar")
def registrar_medico(medico: MedicoCreate, db: Session = Depends(get_db)):
    is_first = db.query(Medico).count() == 0
    senha_hasheada = pwd_context.hash(medico.senha)
    novo_medico = Medico(nome=medico.nome, cpf=medico.cpf, crm=medico.crm, email=medico.email, senha_hash=senha_hasheada, is_superadmin=is_first)
    db.add(novo_medico)
    db.commit()
    return {"message": "Médico registrado com sucesso"}

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    medico = db.query(Medico).filter(Medico.email == form_data.username).first()
    if not medico or not pwd_context.verify(form_data.password, medico.senha_hash):
        raise HTTPException(status_code=400, detail="Email ou senha incorretos")
    return {
        "access_token": medico.email, "token_type": "bearer",
        "user": {"id": medico.id, "nome": medico.nome, "email": medico.email, "is_superadmin": medico.is_superadmin}
    }

# ── Rotas de Usuários ────────────────────────────────────────────────────────
@app.get("/api/medicos/")
def listar_medicos(db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual)):
    if current_user.is_superadmin:
        medicos = db.query(Medico).all()
    else:
        medicos = [current_user]
    return [{"id": m.id, "nome": m.nome, "email": m.email, "crm": m.crm, "is_superadmin": m.is_superadmin} for m in medicos]

@app.put("/api/medicos/{medico_id}")
def editar_medico(medico_id: int, req: MedicoUpdate, db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual)):
    if not current_user.is_superadmin and current_user.id != medico_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    medico = db.query(Medico).filter(Medico.id == medico_id).first()
    medico.nome = req.nome
    medico.crm = req.crm
    medico.email = req.email
    db.commit()
    return {"status": "ok"}

@app.delete("/api/medicos/{medico_id}")
def deletar_medico(medico_id: int, db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual)):
    if not current_user.is_superadmin and current_user.id != medico_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    medico = db.query(Medico).filter(Medico.id == medico_id).first()
    db.delete(medico)
    db.commit()
    return {"status": "ok"}

@app.post("/api/medicos/{medico_id}/promover")
def promover_medico(medico_id: int, db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual)):
    if not current_user.is_superadmin: raise HTTPException(status_code=403, detail="Apenas superadmins")
    medico = db.query(Medico).filter(Medico.id == medico_id).first()
    medico.is_superadmin = True
    db.commit()
    return {"status": "ok"}


# ── Rotas de Diagnóstico ─────────────────────────────────────────────────────
@app.post("/api/diagnosticos/")
async def criar_diagnostico(
    background_tasks: BackgroundTasks, nome: str = Form(...), idade: int = Form(...), sexo: str = Form(...),
    cpf: Optional[str] = Form(None), tipo_od: bool = Form(False), tipo_oe: bool = Form(False),
    file_od: Optional[UploadFile] = File(None), file_oe: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db), medico_atual: Medico = Depends(get_medico_atual)
):
    if not tipo_od and not tipo_oe: raise HTTPException(status_code=400, detail="Selecione ao menos um olho.")
    if tipo_od and not file_od: raise HTTPException(status_code=400, detail="Arquivo OD não enviado.")
    if tipo_oe and not file_oe: raise HTTPException(status_code=400, detail="Arquivo OE não enviado.")

    paciente = Paciente(nome=nome.strip(), cpf=cpf, idade=idade, sexo=sexo)
    db.add(paciente)
    db.commit()
    db.refresh(paciente)

    diagnostico = Diagnostico(paciente_id=paciente.id, medico_id=medico_atual.id, status="PROCESSANDO", modelo_versao=MODEL_VERSION)
    db.add(diagnostico)
    db.commit()
    db.refresh(diagnostico)

    def salvar_imagem(upload: UploadFile, tipo: str) -> str:
        ext = os.path.splitext(upload.filename)[-1] or ".jpg"
        nome_arquivo = f"{uuid.uuid4()}_{tipo}{ext}"
        caminho = os.path.join(IMG_DIR, nome_arquivo)
        with open(caminho, "wb") as buffer: shutil.copyfileobj(upload.file, buffer)
        return caminho

    if tipo_od and file_od: db.add(Imagem(diagnostico_id=diagnostico.id, tipo="OD", caminho_arquivo=salvar_imagem(file_od, "OD")))
    if tipo_oe and file_oe: db.add(Imagem(diagnostico_id=diagnostico.id, tipo="OE", caminho_arquivo=salvar_imagem(file_oe, "OE")))

    db.commit()
    background_tasks.add_task(processar_diagnostico_worker, diagnostico.id)
    return {"message": "Processando", "diagnostico_id": diagnostico.id, "paciente_id": paciente.id}

@app.get("/api/diagnosticos/")
def listar_diagnosticos(
    nome_filtro: Optional[str] = None, cpf_filtro: Optional[str] = None,
    doencas: List[str] = Query(default=[]), doencas_logic: str = "OR", apenas_meus: bool = True, page: int = 1,
    db: Session = Depends(get_db), medico_atual: Medico = Depends(get_medico_atual)
):
    query = db.query(Diagnostico).join(Paciente)

    # Regra 2: Isolar dados por médico, exceto se for superadmin e desmarcar 'apenas_meus'
    if not medico_atual.is_superadmin or apenas_meus:
        query = query.filter(Diagnostico.medico_id == medico_atual.id)

    if nome_filtro: query = query.filter(Paciente.nome.ilike(f"%{nome_filtro}%"))
    if cpf_filtro: query = query.filter(Paciente.cpf.ilike(f"%{cpf_filtro}%"))

    # Feature 1.1: Filtro AND/OR de Doenças
    if doencas:
        if doencas_logic == "OR":
            query = query.join(Resultado).filter(Resultado.doenca.in_(doencas))
        elif doencas_logic == "AND":
            for d in doencas: query = query.filter(Diagnostico.resultados.any(Resultado.doenca == d))

    limit = 30
    offset = (page - 1) * limit
    total = query.count()
    diagnosticos = query.order_by(Diagnostico.data_criacao.desc()).offset(offset).limit(limit).all()

    resultado_lista = []
    for diag in diagnosticos:
        doencas_unicas = list({r.doenca for r in diag.resultados})
        resultado_lista.append({
            "id": diag.id, "paciente": diag.paciente.nome, "idade": diag.paciente.idade, "sexo": diag.paciente.sexo,
            "status": diag.status, "data_criacao": diag.data_criacao.isoformat() if diag.data_criacao else None,
            "doencas_detectadas": doencas_unicas, "modelo_versao": diag.modelo_versao,
        })
    return {"total": total, "pagina_atual": page, "dados": resultado_lista}

@app.get("/api/diagnosticos/{diagnostico_id}")
def detalhe_diagnostico(diagnostico_id: int, db: Session = Depends(get_db), medico_atual: Medico = Depends(get_medico_atual)):
    diag = db.query(Diagnostico).filter(Diagnostico.id == diagnostico_id).first()
    if not diag: raise HTTPException(status_code=404)
    if not medico_atual.is_superadmin and diag.medico_id != medico_atual.id: raise HTTPException(status_code=403)

    return {
        "id": diag.id, "paciente": diag.paciente.nome, "idade": diag.paciente.idade, "sexo": diag.paciente.sexo, "status": diag.status,
        "data_criacao": diag.data_criacao.isoformat() if diag.data_criacao else None, "modelo_versao": diag.modelo_versao,
        "imagens": [{"tipo": img.tipo, "caminho": img.caminho_arquivo} for img in diag.imagens],
        "resultados": [{"doenca": r.doenca, "confianca": r.confianca, "olho": r.olho_analisado} for r in diag.resultados]
    }

class DeleteModel(BaseModel):
    ids: List[int]

@app.post("/api/diagnosticos/deletar-massa")
def excluir_diagnosticos(req: DeleteModel, db: Session = Depends(get_db), medico_atual: Medico = Depends(get_medico_atual)):
    diagnosticos = db.query(Diagnostico).filter(Diagnostico.id.in_(req.ids)).all()
    count = 0
    for diag in diagnosticos:
        if medico_atual.is_superadmin or diag.medico_id == medico_atual.id:
            for img in diag.imagens:
                if os.path.exists(img.caminho_arquivo): os.remove(img.caminho_arquivo)
            db.delete(diag)
            count += 1
    db.commit()
    return {"excluidos": count}