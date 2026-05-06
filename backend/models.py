from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, relationship
import datetime

Base = declarative_base()

class Paciente(Base):
    __tablename__ = "pacientes"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)
    idade = Column(Integer)
    sexo = Column(String)
    diagnosticos = relationship("Diagnostico", back_populates="paciente")

class Diagnostico(Base):
    __tablename__ = "diagnosticos"
    id = Column(Integer, primary_key=True, index=True)
    paciente_id = Column(Integer, ForeignKey("pacientes.id"))
    status = Column(String, default="PROCESSANDO")  # PROCESSANDO, CONCLUIDO, ERRO
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)
    data_finalizacao = Column(DateTime, nullable=True)
    modelo_versao = Column(String, default="mock-v0.1")  # Auditoria

    paciente = relationship("Paciente", back_populates="diagnosticos")
    imagens = relationship("Imagem", back_populates="diagnostico")
    resultados = relationship("Resultado", back_populates="diagnostico")

class Imagem(Base):
    __tablename__ = "imagens"
    id = Column(Integer, primary_key=True, index=True)
    diagnostico_id = Column(Integer, ForeignKey("diagnosticos.id"))
    tipo = Column(String)  # OD, OE
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
