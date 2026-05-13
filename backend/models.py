from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import declarative_base, relationship
import datetime

Base = declarative_base()

class Medico(Base):
    __tablename__ = "medicos"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)
    cpf = Column(String, unique=True, index=True)
    crm = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    senha_hash = Column(String)
    is_superadmin = Column(Boolean, default=False)
    solicitou_reset = Column(Boolean, default=False)
    
    diagnosticos = relationship("Diagnostico", back_populates="medico")

class Paciente(Base):
    __tablename__ = "pacientes"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)
    cpf = Column(String, index=True, nullable=True)
    idade = Column(Integer)
    sexo = Column(String)
    diagnosticos = relationship("Diagnostico", back_populates="paciente")

class Diagnostico(Base):
    __tablename__ = "diagnosticos"
    id = Column(Integer, primary_key=True, index=True)
    paciente_id = Column(Integer, ForeignKey("pacientes.id"))
    medico_id = Column(Integer, ForeignKey("medicos.id"), nullable=True)
    
    status = Column(String, default="PROCESSANDO")
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)
    data_finalizacao = Column(DateTime, nullable=True)
    modelo_versao = Column(String, default="mock-v0.1")
    parecer = Column(String, nullable=True)
    paciente = relationship("Paciente", back_populates="diagnosticos")
    medico = relationship("Medico", back_populates="diagnosticos")
    imagens = relationship("Imagem", back_populates="diagnostico")
    resultados = relationship("Resultado", back_populates="diagnostico")

class Imagem(Base):
    __tablename__ = "imagens"
    id = Column(Integer, primary_key=True, index=True)
    diagnostico_id = Column(Integer, ForeignKey("diagnosticos.id"))
    tipo = Column(String)
    caminho_arquivo = Column(String)
    diagnostico = relationship("Diagnostico", back_populates="imagens")

class Resultado(Base):
    __tablename__ = "resultados"
    id = Column(Integer, primary_key=True, index=True)
    diagnostico_id = Column(Integer, ForeignKey("diagnosticos.id"))
    doenca = Column(String, index=True)
    confianca = Column(Float)
    olho_analisado = Column(String)
    diagnostico = relationship("Diagnostico", back_populates="resultados")