from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from jose import jwt

from database import get_db
from models import Medico, Diagnostico
from schemas import SolicitarResetLocalSchema, AdminSelfResetSchema
from security import (
    pwd_context, criar_access_token, get_medico_atual, 
    ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM, oauth2_scheme, get_token_blacklist
)
from i18n import t
import os

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db), lang: str = Query("pt_BR")):
    medico = db.query(Medico).filter(Medico.email == form_data.username).first()
    senha_ok = medico and pwd_context.verify(form_data.password, medico.senha_hash)
    if not senha_ok:
        raise HTTPException(status_code=400, detail=t("E-mail ou senha incorretos.", lang))
    token = criar_access_token(medico.id, medico.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": medico.id,
            "nome": medico.nome,
            "email": medico.email,
            "is_superadmin": medico.is_superadmin,
            "verificado": medico.verificado,
        },
    }

@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db), lang: str = Query("pt_BR")):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        medico_id = payload.get("sub")
        if jti:
            get_token_blacklist().add(jti)

        if medico_id:
            medico = db.query(Medico).filter(Medico.id == int(medico_id)).first()
            if medico and not medico.verificado:
                diagnosticos = db.query(Diagnostico).filter(Diagnostico.medico_id == medico.id).all()
                for diag in diagnosticos:
                    for img in diag.imagens:
                        if os.path.exists(img.caminho_arquivo):
                            os.remove(img.caminho_arquivo)
                    db.delete(diag)
                db.commit()
    except JWTError:
        pass
    return {"message": t("Logout realizado com sucesso.", lang)}

@router.get("/me")
def me(medico_atual: Medico = Depends(get_medico_atual)):
    return {
        "id": medico_atual.id,
        "nome": medico_atual.nome,
        "email": medico_atual.email,
        "crm": medico_atual.crm,
        "is_superadmin": medico_atual.is_superadmin,
        "verificado": medico_atual.verificado,
    }

@router.post("/solicitar-reset-local")
def solicitar_reset_local(body: SolicitarResetLocalSchema, db: Session = Depends(get_db), lang: str = Query("pt_BR")):
    email_limpo = body.email.strip().lower()
    medico = db.query(Medico).filter(func.lower(Medico.email) == email_limpo).first()
    if medico:
        try:
            medico.solicitou_reset = True
            db.commit()
        except Exception:
            db.rollback()
    return {"message": t("Se o e-mail estiver cadastrado, a solicitação foi enviada ao Administrador.", lang)}

@router.post("/admin-self-reset")
def admin_self_reset(body: AdminSelfResetSchema, db: Session = Depends(get_db), lang: str = Query("pt_BR")):
    medico = db.query(Medico).filter(
        Medico.email == body.email,
        Medico.cpf == body.cpf,
        Medico.crm == body.crm,
        Medico.is_superadmin == True
    ).first()

    if not medico or medico.nome.lower() != body.nome.lower():
        raise HTTPException(status_code=400, detail=t("Dados incorretos ou usuário não é Superadmin.", lang))

    if len(body.nova_senha) < 6:
        raise HTTPException(status_code=400, detail=t("A nova senha deve ter ao menos 6 caracteres.", lang))

    medico.senha_hash = pwd_context.hash(body.nova_senha)
    medico.solicitou_reset = False
    db.commit()
    return {"message": t("Senha de administrador redefinida com sucesso.", lang)}