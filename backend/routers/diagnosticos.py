import os
import shutil
import uuid
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models import Medico, Paciente, Diagnostico, Imagem, Resultado
from schemas import ParecerUpdate, DeleteModel
from security import get_medico_atual
from i18n import t
from ml_engine import analisar_imagem
from services.pdf_export import gerar_pdfs_diagnosticos
from pathlib import Path

router = APIRouter(prefix="/api/diagnosticos", tags=["Diagnósticos"])
USER_HOME = Path.home()
APP_DATA_DIR = USER_HOME / ".retai_data"
IMG_DIR = str(APP_DATA_DIR / "imagens_salvas")

os.makedirs(IMG_DIR, exist_ok=True)

def processar_diagnostico_worker(diagnostico_id: int):
    db = SessionLocal()
    try:
        diagnostico = db.query(Diagnostico).filter(Diagnostico.id == diagnostico_id).first()
        if not diagnostico: return
            
        modelo_escolhido = diagnostico.modelo_versao or "ConvNextV2"
        for img in diagnostico.imagens:
            try:
                resultados_ia = analisar_imagem(img.caminho_arquivo, modelo_escolhido)
                for res in resultados_ia:
                    db.add(Resultado(
                        diagnostico_id=diagnostico.id,
                        doenca=res["tag"],
                        confianca=res["confianca"],
                        olho_analisado=img.tipo,
                    ))
            except Exception as img_err:
                print(f"Erro ao processar imagem individual: {img_err}")
                pass
                
        diagnostico.status = "CONCLUIDO"
        diagnostico.data_finalizacao = datetime.now(timezone.utc)
        db.commit()
    except Exception as err:
        db.rollback()
        diag = db.query(Diagnostico).filter(Diagnostico.id == diagnostico_id).first()
        if diag:
            diag.status = "ERRO"
            db.commit()
    finally:
        db.close()

@router.post("/")
async def criar_diagnostico(
    background_tasks: BackgroundTasks,
    nome: str = Form(...), idade: int = Form(...), sexo: str = Form(...),
    cpf: Optional[str] = Form(None), tipo_od: bool = Form(False), tipo_oe: bool = Form(False),
    file_od: Optional[UploadFile] = File(None), file_oe: Optional[UploadFile] = File(None),
    modelo: str = Form("convnext"), db: Session = Depends(get_db),
    medico_atual: Medico = Depends(get_medico_atual), lang: str = Query("pt_BR"),
):
    if not tipo_od and not tipo_oe:
        raise HTTPException(status_code=400, detail=t("Selecione ao menos um olho.", lang))
    if tipo_od and not file_od:
        raise HTTPException(status_code=400, detail=t("Arquivo OD não enviado.", lang))
    if tipo_oe and not file_oe:
        raise HTTPException(status_code=400, detail=t("Arquivo OE não enviado.", lang))
    
    def salvar_imagem(upload: UploadFile, tipo: str) -> str:
        ext = os.path.splitext(upload.filename)[-1] or ".jpg"
        nome_arquivo = f"{uuid.uuid4()}_{tipo}{ext}"
        caminho = os.path.join(IMG_DIR, nome_arquivo)
        with open(caminho, "wb") as buffer:
            shutil.copyfileobj(upload.file, buffer)
        return caminho

    paciente = Paciente(nome=nome.strip(), cpf=cpf, idade=idade, sexo=sexo)
    db.add(paciente)
    db.commit()
    db.refresh(paciente)

    diagnostico = Diagnostico(
        paciente_id=paciente.id, medico_id=medico_atual.id, status="PROCESSANDO", modelo_versao=modelo
    )
    db.add(diagnostico)
    db.commit()
    db.refresh(diagnostico)

    if tipo_od and file_od:
        db.add(Imagem(diagnostico_id=diagnostico.id, tipo="OD", caminho_arquivo=salvar_imagem(file_od, "OD")))
    if tipo_oe and file_oe:
        db.add(Imagem(diagnostico_id=diagnostico.id, tipo="OE", caminho_arquivo=salvar_imagem(file_oe, "OE")))

    db.commit()
    background_tasks.add_task(processar_diagnostico_worker, diagnostico.id)
    return {"message": t("Processando", lang), "diagnostico_id": diagnostico.id, "paciente_id": paciente.id}

@router.get("/")
def listar_diagnosticos(
    nome_filtro: Optional[str] = None, cpf_filtro: Optional[str] = None,
    doencas: List[str] = Query(default=[]), doencas_logic: str = "OR",
    apenas_meus: bool = True, page: int = 1, db: Session = Depends(get_db),
    medico_atual: Medico = Depends(get_medico_atual),
):
    query = db.query(Diagnostico).join(Paciente)

    if not medico_atual.is_superadmin or apenas_meus:
        query = query.filter(Diagnostico.medico_id == medico_atual.id)

    if nome_filtro: query = query.filter(Paciente.nome.ilike(f"%{nome_filtro}%"))
    if cpf_filtro: query = query.filter(Paciente.cpf.ilike(f"%{cpf_filtro}%"))

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
        "total": total, "pagina_atual": page,
        "dados": [
            {
                "id": diag.id, "paciente": diag.paciente.nome, "idade": diag.paciente.idade,
                "sexo": diag.paciente.sexo, "status": diag.status,
                "data_criacao": diag.data_criacao.isoformat() if diag.data_criacao else None,
                "doencas_detectadas": list({r.doenca for r in diag.resultados}),
                "modelo_versao": diag.modelo_versao,
            } for diag in diagnosticos
        ],
    }

@router.get("/{diagnostico_id}")
def detalhe_diagnostico(diagnostico_id: int, db: Session = Depends(get_db), medico_atual: Medico = Depends(get_medico_atual), lang: str = Query("pt_BR")):
    diag = db.query(Diagnostico).filter(Diagnostico.id == diagnostico_id).first()
    if not diag:
        raise HTTPException(status_code=404, detail=t("Diagnóstico não encontrado.", lang))
    if not medico_atual.is_superadmin and diag.medico_id != medico_atual.id:
        raise HTTPException(status_code=403, detail=t("Acesso não autorizado.", lang))
    return {
        "id": diag.id, "paciente": diag.paciente.nome, "cpf": diag.paciente.cpf,
        "idade": diag.paciente.idade, "sexo": diag.paciente.sexo, "status": diag.status,
        "data_criacao": diag.data_criacao.isoformat() if diag.data_criacao else None,
        "modelo_versao": diag.modelo_versao,
        "imagens": [{"tipo": img.tipo, "caminho": img.caminho_arquivo} for img in diag.imagens],
        "resultados": [{"doenca": r.doenca, "confianca": r.confianca, "olho": r.olho_analisado} for r in diag.resultados],
        "parecer": diag.parecer,
    }

@router.put("/{diagnostico_id}/parecer")
def atualizar_parecer(diagnostico_id: int, body: ParecerUpdate, db: Session = Depends(get_db), medico_atual: Medico = Depends(get_medico_atual), lang: str = Query("pt_BR")):
    if not medico_atual.verificado:
        raise HTTPException(status_code=403, detail=t("Apenas médicos verificados podem preencher o parecer.", lang))
    diag = db.query(Diagnostico).filter(Diagnostico.id == diagnostico_id).first()
    if not diag:
        raise HTTPException(status_code=404, detail=t("Diagnóstico não encontrado.", lang))
    if not medico_atual.is_superadmin and diag.medico_id != medico_atual.id:
        raise HTTPException(status_code=403, detail=t("Acesso não autorizado.", lang))
    diag.parecer = body.parecer
    db.commit()
    return {"status": "ok"}

@router.post("/deletar-massa")
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

@router.post("/exportar-pdfs")
def exportar_pdfs(req: DeleteModel, db: Session = Depends(get_db), medico_atual: Medico = Depends(get_medico_atual), lang: str = Query("pt_BR")):
    if not medico_atual.verificado:
        raise HTTPException(status_code=403, detail=t("Apenas médicos verificados podem gerar PDFs.", lang))

    diagnosticos = db.query(Diagnostico).filter(Diagnostico.id.in_(req.ids)).all()
    diagnosticos_filtrados = [d for d in diagnosticos if medico_atual.is_superadmin or d.medico_id == medico_atual.id]

    buffer = gerar_pdfs_diagnosticos(diagnosticos_filtrados, lang)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=laudos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"}
    )