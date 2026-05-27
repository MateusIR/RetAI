import uuid
import os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Query
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from database import get_db
from models import Medico
from i18n import t

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "TROQUE-ISTO-POR-UMA-CHAVE-FORTE-EM-PRODUCAO")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

_token_blacklist = set()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def criar_access_token(medico_id: int, email: str) -> str:
    jti = str(uuid.uuid4())
    payload = {
        "sub": str(medico_id),
        "email": email,
        "jti": jti,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_medico_atual(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db), lang: str = Query("pt_BR")) -> Medico:
    credentials_exception = HTTPException(
        status_code=401,
        detail=t("Token inválido ou expirado", lang),
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

    if jti in _token_blacklist:
        raise HTTPException(
            status_code=401,
            detail=t("Token revogado. Faça login novamente.", lang),
            headers={"WWW-Authenticate": "Bearer"},
        )

    medico = db.query(Medico).filter(Medico.id == int(medico_id)).first()
    if not medico:
        raise credentials_exception
    return medico

def get_token_blacklist():
    return _token_blacklist