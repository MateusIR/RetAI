from pydantic import BaseModel
from typing import List

class MedicoCreate(BaseModel):
    nome: str
    cpf: str
    crm: str
    email: str
    senha: str

class MedicoNaoVerificadoCreate(BaseModel):
    nome: str
    email: str
    senha: str

class MedicoUpdate(BaseModel):
    nome: str
    crm: str
    email: str

class SolicitarResetLocalSchema(BaseModel):
    email: str

class AdminSelfResetSchema(BaseModel):
    nome: str
    cpf: str
    crm: str
    email: str
    nova_senha: str

class AdminResetSenhaSchema(BaseModel):
    nova_senha: str

class ParecerUpdate(BaseModel):
    parecer: str

class DeleteModel(BaseModel):
    ids: List[int]