from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Medico
from schemas import MedicoCreate, MedicoNaoVerificadoCreate, MedicoUpdate, AdminResetSenhaSchema
from security import get_medico_atual, pwd_context
from validators import validar_cpf, validar_crm, validar_correspondencia_nome
from i18n import t

router = APIRouter(prefix="/api/medicos", tags=["Médicos"])

@router.post("/registrar")
async def registrar_medico(medico: MedicoCreate, db: Session = Depends(get_db), lang: str = Query("pt_BR")):
    if len(medico.senha) < 6:
        raise HTTPException(status_code=422, detail=t("A senha deve ter pelo menos 6 caracteres.", lang))

    validar_cpf(medico.cpf, lang)

    if db.query(Medico).filter(Medico.email == medico.email.strip().lower()).first():
        raise HTTPException(status_code=409, detail=t("Este e-mail já está cadastrado.", lang))
    if db.query(Medico).filter(Medico.cpf == medico.cpf).first():
        raise HTTPException(status_code=409, detail=t("Este CPF já está cadastrado.", lang))
    if db.query(Medico).filter(Medico.crm == medico.crm).first():
        raise HTTPException(status_code=409, detail=t("Este CRM já está cadastrado.", lang))

    crm_dados = await validar_crm(medico.crm, lang)
    nome_cfm = crm_dados.get("nome_cfm", "")

    if not nome_cfm or not validar_correspondencia_nome(medico.nome, nome_cfm):
        raise HTTPException(
            status_code=422,
            detail=t("O nome informado não confere com o titular do CRM no Conselho.", lang)
        )

    is_first = db.query(Medico).count() == 0
    novo_medico = Medico(
        nome=medico.nome,
        cpf=medico.cpf,
        crm=medico.crm,
        email=medico.email.strip().lower(),
        senha_hash=pwd_context.hash(medico.senha),
        is_superadmin=is_first,
        verificado=True
    )
    db.add(novo_medico)
    db.commit()

    return {
        "message": t("Médico registrado com sucesso.", lang),
        "crm_validado": f"{crm_dados['numero']}/{crm_dados['uf']}",
        "nome_cfm": nome_cfm,
    }

@router.post("/registrar-nao-verificado")
async def registrar_medico_nao_verificado(medico: MedicoNaoVerificadoCreate, db: Session = Depends(get_db), lang: str = Query("pt_BR")):
    if len(medico.senha) < 6:
        raise HTTPException(status_code=422, detail=t("A senha deve ter pelo menos 6 caracteres.", lang))
    if db.query(Medico).filter(Medico.email == medico.email.strip().lower()).first():
        raise HTTPException(status_code=409, detail=t("Este e-mail já está cadastrado.", lang))

    novo_medico = Medico(
        nome=medico.nome,
        email=medico.email.strip().lower(),
        senha_hash=pwd_context.hash(medico.senha),
        is_superadmin=False,
        verificado=False,
    )
    db.add(novo_medico)
    db.commit()
    return {"message": t("Conta não verificada criada com sucesso.", lang)}

@router.get("/")
def listar_medicos(db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual)):
    medicos = db.query(Medico).all() if current_user.is_superadmin else [current_user]
    return [
        {
            "id": m.id, "nome": m.nome, "email": m.email, "crm": m.crm,
            "is_superadmin": m.is_superadmin, "solicitou_reset": m.solicitou_reset, "verificado": m.verificado
        } for m in medicos
    ]

@router.put("/{medico_id}")
def editar_medico(medico_id: int, req: MedicoUpdate, db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual), lang: str = Query("pt_BR")):
    if not current_user.is_superadmin and current_user.id != medico_id:
        raise HTTPException(status_code=403, detail=t("Não autorizado.", lang))
    medico = db.query(Medico).filter(Medico.id == medico_id).first()
    if not medico:
        raise HTTPException(status_code=404, detail=t("Médico não encontrado.", lang))
    medico.nome = req.nome
    medico.crm = req.crm
    medico.email = req.email
    db.commit()
    return {"status": "ok"}

@router.delete("/{medico_id}")
def deletar_medico(medico_id: int, db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual), lang: str = Query("pt_BR")):
    if not current_user.is_superadmin and current_user.id != medico_id:
        raise HTTPException(status_code=403, detail=t("Não autorizado.", lang))
    medico = db.query(Medico).filter(Medico.id == medico_id).first()
    if not medico:
        raise HTTPException(status_code=404, detail=t("Médico não encontrado.", lang))
    db.delete(medico)
    db.commit()
    return {"status": "ok"}

@router.post("/{medico_id}/promover")
def promover_medico(medico_id: int, db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual), lang: str = Query("pt_BR")):
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail=t("Apenas superadmins podem redefinir senhas.", lang))
    medico = db.query(Medico).filter(Medico.id == medico_id).first()
    if not medico:
        raise HTTPException(status_code=404, detail=t("Médico não encontrado.", lang))
    if not medico.verificado:
        raise HTTPException(status_code=400, detail=t("Médicos não verificados não podem ser promovidos a superadmin.", lang))
    medico.is_superadmin = True
    db.commit()
    return {"status": "ok"}

@router.post("/{medico_id}/resetar-senha-admin")
def resetar_senha_admin(medico_id: int, body: AdminResetSenhaSchema, db: Session = Depends(get_db), current_user: Medico = Depends(get_medico_atual), lang: str = Query("pt_BR")):
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail=t("Apenas superadmins podem redefinir senhas.", lang))
    if len(body.nova_senha) < 6:
        raise HTTPException(status_code=400, detail=t("Senha deve ter ao menos 6 caracteres.", lang))

    medico = db.query(Medico).filter(Medico.id == medico_id).first()
    if not medico:
        raise HTTPException(status_code=404, detail=t("Médico não encontrado.", lang))

    medico.senha_hash = pwd_context.hash(body.nova_senha)
    medico.solicitou_reset = False
    db.commit()
    return {"message": t("Senha do usuário atualizada com sucesso.", lang)}