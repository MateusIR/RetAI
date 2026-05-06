import React, { useEffect, useState } from 'react'
import { fetchDiagnostico, DiagnosticoDetalhe } from '../api'

interface Props {
  diagnosticoId: number
  onClose: () => void
}

function BarraConfianca({ valor }: { valor: number }) {
  const cor =
    valor >= 80 ? 'bg-red-500' : valor >= 60 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-surface-4 overflow-hidden">
        <div
          className={`h-full rounded-full ${cor} transition-all duration-700`}
          style={{ width: `${valor}%` }}
        />
      </div>
      <span className="font-mono text-xs text-slate-300 w-12 text-right">{valor}%</span>
    </div>
  )
}

export default function ModalDetalhe({ diagnosticoId, onClose }: Props) {
  const [data, setData] = useState<DiagnosticoDetalhe | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDiagnostico(diagnosticoId)
      .then(setData)
      .finally(() => setLoading(false))
  }, [diagnosticoId])

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const gruposPorOlho = data?.resultados.reduce<Record<string, typeof data.resultados>>(
    (acc, r) => {
      if (!acc[r.olho]) acc[r.olho] = []
      acc[r.olho].push(r)
      return acc
    },
    {},
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-lg mx-4 animate-slide-up overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-4">
          <h2 className="font-display text-lg font-semibold text-white">
            Resultado do Diagnóstico
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-surface-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="shimmer-line h-6 rounded" style={{ width: `${70 + i * 10}%` }} />
              ))}
            </div>
          ) : data ? (
            <div className="space-y-5">
              {/* Dados do paciente */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-3 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Paciente</p>
                  <p className="text-sm font-medium text-slate-200">{data.paciente}</p>
                </div>
                <div className="bg-surface-3 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Idade / Sexo</p>
                  <p className="text-sm font-medium text-slate-200">
                    {data.idade} · {data.sexo === 'M' ? 'Masc.' : 'Fem.'}
                  </p>
                </div>
                <div className="bg-surface-3 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Status</p>
                  <p className={`text-sm font-medium ${
                    data.status === 'CONCLUIDO' ? 'text-emerald-400' :
                    data.status === 'PROCESSANDO' ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {data.status === 'CONCLUIDO' ? 'Concluído' :
                     data.status === 'PROCESSANDO' ? 'Processando...' : 'Erro'}
                  </p>
                </div>
              </div>

              {/* Resultados por olho */}
              {data.status === 'CONCLUIDO' && gruposPorOlho && Object.keys(gruposPorOlho).length > 0 ? (
                Object.entries(gruposPorOlho).map(([olho, resultados]) => (
                  <div key={olho}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
                        <svg className="w-3 h-3 text-accent-glow" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-200">
                        {olho === 'OD' ? 'Olho Direito (OD)' : 'Olho Esquerdo (OE)'}
                      </h3>
                    </div>
                    <div className="space-y-3 pl-8">
                      {resultados.map((r, i) => (
                        <div key={i}>
                          <div className="flex justify-between items-baseline mb-1.5">
                            <span className="text-sm text-slate-200">{r.doenca}</span>
                          </div>
                          <BarraConfianca valor={r.confianca} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : data.status === 'PROCESSANDO' ? (
                <div className="flex items-center gap-3 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <svg className="w-5 h-5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Análise em andamento. Feche e acompanhe na lista.
                </div>
              ) : data.status === 'ERRO' ? (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  Ocorreu um erro durante o processamento deste diagnóstico.
                </div>
              ) : null}

              {/* Rodapé de auditoria */}
              <div className="pt-3 border-t border-surface-4 flex justify-between text-xs text-slate-500 font-mono">
                <span>Modelo: {data.modelo_versao}</span>
                <span>ID #{data.id}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-4">
          <button onClick={onClose} className="btn-ghost w-full">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
