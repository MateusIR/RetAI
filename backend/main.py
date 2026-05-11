import shutil
import uuid
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Set

from fastapi import FastAPI, UploadFile, File, Form, Depends, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from pydantic import BaseModel
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError

from models import Base, Medico, Paciente, Diagnostico, Imagem, Resultado
from ml_engine import analisar_imagem, MODEL_VERSION

# ── Configuração JWT ──────────────────────────────────────────────────────────
# Em produção, use: SECRET_KEY = secrets.token_hex(32) gerado uma vez e salvo em .env
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "TROQUE-ISTO-POR-UMA-CHAVE-FORTE-EM-PRODUCAO")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hora

# Blacklist em memória: armazena JTIs (JWT IDs) de tokens invalidados por logout.
# ⚠ Em produção com múltiplos workers, substitua por Redis ou tabela no banco.
_token_blacklist: Set[str] = set()

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="RetAI API", version="0.2.0")

# ⚠ Em produção, restrinja allow_origins à(s) URL(s) real(is) do frontend.
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:1420").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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
        if not diagnostico:
            return
        for img in diagnostico.imagens:
            try:
                resultados_ia = analisar_imagem(img.caminho_arquivo)
                for res in resultados_ia:
                    db.add(Resultado(
                        diagnostico_id=diagnostico.id,
                        doenca=res["doenca"],
                        confianca=res["confianca"],
                        olho_analisado=img.tipo,
                    ))
            except Exception:
                pass
        diagnostico.status = "CONCLUIDO"
        diagnostico.data_finalizacao = datetime.now(timezone.utc)
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


def criar_access_token(medico_id: int, email: str) -> str:
    """Gera um JWT assinado com expiração de ACCESS_TOKEN_EXPIRE_MINUTES."""
    jti = str(uuid.uuid4())  # ID único do token — usado para invalidação no logout
    payload = {
        "sub": str(medico_id),   # subject: ID numérico, não e-mail
        "email": email,
        "jti": jti,              # JWT ID — permite revogar tokens individuais
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_medico_atual(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Medico:
    """Valida o JWT, checa blacklist e retorna o médico autenticado."""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        medico_id: str = payload.get("sub")
        jti: str = payload.get("jti")
        if medico_id is None or jti is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Verifica se o token foi invalidado via logout
    if jti in _token_blacklist:
        raise HTTPException(
            status_code=401,
            detail="Token revogado. Faça login novamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    medico = db.query(Medico).filter(Medico.id == int(medico_id)).first()
    if not medico:
        raise credentials_exception
    return medico


# ── Schemas ───────────────────────────────────────────────────────────────────
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

# ── Rotas de Autenticação ─────────────────────────────────────────────────────
@app.post("/api/medicos/registrar")
def registrar_medico(medico: MedicoCreate, db: Session = Depends(get_db)):
    if db.query(Medico).filter(Medico.email == medico.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    if len(medico.senha) < 6:
        raise HTTPException(status_code=400, detail="Senha deve ter ao menos 6 caracteres")
    is_first = db.query(Medico).count() == 0
    novo_medico = Medico(
        nome=medico.nome,
        cpf=medico.cpf,
        crm=medico.crm,
        email=medico.email,
        senha_hash=pwd_context.hash(medico.senha),
        is_superadmin=is_first,
    )
    db.add(novo_medico)
    db.commit()
    return {"message": "Médico registrado com sucesso"}


@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    medico = db.query(Medico).filter(Medico.email == form_data.username).first()
    # Timing-safe: verifica hash mesmo se médico não existir para evitar user enumeration
    senha_ok = medico and pwd_context.verify(form_data.password, medico.senha_hash)
    if not senha_ok:
        raise HTTPException(status_code=400, detail="E-mail ou senha incorretos")
    token = criar_access_token(medico.id, medico.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # segundos
        "user": {
            "id": medico.id,
            "nome": medico.nome,
            "email": medico.email,
            "is_superadmin": medico.is_superadmin,
        },
    }


@app.post("/api/auth/logout")
def logout(token: str = Depends(oauth2_scheme)):
    """Invalida o token atual adicionando seu JTI à blacklist."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        if jti:
            _token_blacklist.add(jti)
    except JWTError:
        pass  # Token já inválido — logout silencioso
    return {"message": "Logout realizado com sucesso"}


@app.get("/api/auth/me")
def me(medico_atual: Medico = Depends(get_medico_atual)):
    """Retorna dados do usuário autenticado. Útil para validar token no frontend."""
    return {
        "id": medico_atual.id,
        "nome": medico_atual.nome,
        "email": medico_atual.email,
        "crm": medico_atual.crm,
        "is_superadmin": medico_atual.is_superadmin,
    }


# ── Rotas de Usuários ────────────────────────────────────────────────────────
@app.get("/api/medicos/")
def listar_medicos(db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual)):
    medicos = db.query(Medico).all() if current_user.is_superadmin else [current_user]
    return [{"id": m.id, "nome": m.nome, "email": m.email, "crm": m.crm, "is_superadmin": m.is_superadmin} for m in medicos]


@app.put("/api/medicos/{medico_id}")
def editar_medico(medico_id: int, req: MedicoUpdate, db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual)):
    if not current_user.is_superadmin and current_user.id != medico_id:
        raise HTTPException(status_code=403, detail="Não autorizado")
    medico = db.query(Medico).filter(Medico.id == medico_id).first()
    if not medico:
        raise HTTPException(status_code=404, detail="Médico não encontrado")
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
    if not medico:
        raise HTTPException(status_code=404, detail="Médico não encontrado")
    db.delete(medico)
    db.commit()
    return {"status": "ok"}


@app.post("/api/medicos/{medico_id}/promover")
def promover_medico(medico_id: int, db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual)):
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Apenas superadmins")
    medico = db.query(Medico).filter(Medico.id == medico_id).first()
    if not medico:
        raise HTTPException(status_code=404, detail="Médico não encontrado")
    medico.is_superadmin = True
    db.commit()
    return {"status": "ok"}


# ── Rotas de Diagnóstico ─────────────────────────────────────────────────────
@app.post("/api/diagnosticos/")
async def criar_diagnostico(
    background_tasks: BackgroundTasks,
    nome: str = Form(...), idade: int = Form(...), sexo: str = Form(...),
    cpf: Optional[str] = Form(None), tipo_od: bool = Form(False), tipo_oe: bool = Form(False),
    file_od: Optional[UploadFile] = File(None), file_oe: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db), medico_atual: Medico = Depends(get_medico_atual),
):
    if not tipo_od and not tipo_oe:
        raise HTTPException(status_code=400, detail="Selecione ao menos um olho.")
    if tipo_od and not file_od:
        raise HTTPException(status_code=400, detail="Arquivo OD não enviado.")
    if tipo_oe and not file_oe:
        raise HTTPException(status_code=400, detail="Arquivo OE não enviado.")

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

    def salvar_imagem(upload: UploadFile, tipo: str) -> str:
        ext = os.path.splitext(upload.filename)[-1] or ".jpg"
        nome_arquivo = f"{uuid.uuid4()}_{tipo}{ext}"
        caminho = os.path.join(IMG_DIR, nome_arquivo)
        with open(caminho, "wb") as buffer:
            shutil.copyfileobj(upload.file, buffer)
        return caminho

    if tipo_od and file_od:
        db.add(Imagem(diagnostico_id=diagnostico.id, tipo="OD", caminho_arquivo=salvar_imagem(file_od, "OD")))
    if tipo_oe and file_oe:
        db.add(Imagem(diagnostico_id=diagnostico.id, tipo="OE", caminho_arquivo=salvar_imagem(file_oe, "OE")))

    db.commit()
    background_tasks.add_task(processar_diagnostico_worker, diagnostico.id)
    return {"message": "Processando", "diagnostico_id": diagnostico.id, "paciente_id": paciente.id}


@app.get("/api/diagnosticos/")
def listar_diagnosticos(
    nome_filtro: Optional[str] = None, cpf_filtro: Optional[str] = None,
    doencas: List[str] = Query(default=[]), doencas_logic: str = "OR",
    apenas_meus: bool = True, page: int = 1,
    db: Session = Depends(get_db), medico_atual: Medico = Depends(get_medico_atual),
):
    query = db.query(Diagnostico).join(Paciente)

    if not medico_atual.is_superadmin or apenas_meus:
        query = query.filter(Diagnostico.medico_id == medico_atual.id)

    if nome_filtro:
        query = query.filter(Paciente.nome.ilike(f"%{nome_filtro}%"))
    if cpf_filtro:
        query = query.filter(Paciente.cpf.ilike(f"%{cpf_filtro}%"))

    if doencas:
        if doencas_logic == "OR":
            query = query.join(Resultado).filter(Resultado.doenca.in_(doencas))
        elif doencas_logic == "AND":
            for d in doencas:
                query = query.filter(Diagnostico.resultados.any(Resultado.doenca == d))

    limit = 30
    offset = (page - 1) * limit
    total = query.count()
    diagnosticos = query.order_by(Diagnostico.data_criacao.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "pagina_atual": page,
        "dados": [
            {
                "id": diag.id,
                "paciente": diag.paciente.nome,
                "idade": diag.paciente.idade,
                "sexo": diag.paciente.sexo,
                "status": diag.status,
                "data_criacao": diag.data_criacao.isoformat() if diag.data_criacao else None,
                "doencas_detectadas": list({r.doenca for r in diag.resultados}),
                "modelo_versao": diag.modelo_versao,
            }
            for diag in diagnosticos
        ],
    }


@app.get("/api/diagnosticos/{diagnostico_id}")
def detalhe_diagnostico(diagnostico_id: int, db: Session = Depends(get_db), medico_atual: Medico = Depends(get_medico_atual)):
    diag = db.query(Diagnostico).filter(Diagnostico.id == diagnostico_id).first()
    if not diag:
        raise HTTPException(status_code=404)
    if not medico_atual.is_superadmin and diag.medico_id != medico_atual.id:
        raise HTTPException(status_code=403)
    return {
        "id": diag.id,
        "paciente": diag.paciente.nome,
        "idade": diag.paciente.idade,
        "sexo": diag.paciente.sexo,
        "status": diag.status,
        "data_criacao": diag.data_criacao.isoformat() if diag.data_criacao else None,
        "modelo_versao": diag.modelo_versao,
        "imagens": [{"tipo": img.tipo, "caminho": img.caminho_arquivo} for img in diag.imagens],
        "resultados": [{"doenca": r.doenca, "confianca": r.confianca, "olho": r.olho_analisado} for r in diag.resultados],
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
                if os.path.exists(img.caminho_arquivo):
                    os.remove(img.caminho_arquivo)
            db.delete(diag)
            count += 1
    db.commit()
    return {"excluidos": count}