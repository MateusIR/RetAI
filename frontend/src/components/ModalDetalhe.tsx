import React, { useEffect, useState } from 'react'
import { fetchDiagnostico, DiagnosticoDetalhe } from '../api'

interface Props { diagnosticoId: number; onClose: () => void }

function BarraConfianca({ valor }: { valor: number }) {
  const cor = valor >= 80 ? 'bg-red-500' : valor >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-surface-4 overflow-hidden">
        <div className={`h-full rounded-full ${cor} transition-all duration-700`} style={{ width: `${valor}%` }} />
      </div>
      <span className="font-mono text-xs text-slate-300 w-12 text-right">{valor}%</span>
    </div>
  )
}

function ImagemLightbox({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full mx-4 flex flex-col items-center gap-3"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={src}
          alt={label}
          className="w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/10"
        />
        <p className="text-sm font-semibold text-slate-300 tracking-wide">{label}</p>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-surface-3 border border-surface-4 flex items-center justify-center text-slate-400 hover:text-white hover:bg-surface-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="mt-4 text-xs text-slate-600">Clique fora ou pressione Esc para fechar</p>
    </div>
  )
}

export default function ModalDetalhe({ diagnosticoId, onClose }: Props) {
  const [data, setData] = useState<DiagnosticoDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [mostrarImagens, setMostrarImagens] = useState(false)
  const [imagemExpandida, setImagemExpandida] = useState<{ src: string; label: string } | null>(null)

  useEffect(() => { fetchDiagnostico(diagnosticoId).then(setData).finally(() => setLoading(false)) }, [diagnosticoId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const gruposPorOlho = data?.resultados.reduce<Record<string, typeof data.resultados>>((acc, r) => {
    if (!acc[r.olho]) acc[r.olho] = []
    acc[r.olho].push(r)
    return acc
  }, {})

  return (
    <>
      {imagemExpandida && (
        <ImagemLightbox
          src={imagemExpandida.src}
          label={imagemExpandida.label}
          onClose={() => setImagemExpandida(null)}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in print:bg-transparent print:backdrop-blur-none" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="card w-full max-w-lg mx-4 animate-slide-up overflow-hidden max-h-[90vh] flex flex-col modal-print-area print:max-h-none print:shadow-none print:border-none">
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-4 print:border-b-black">
            <h2 className="font-display text-lg font-semibold text-white print:text-black">Resultado do Diagnóstico</h2>
            <div className="flex gap-2 print:hidden">
              <button onClick={() => window.print()} className="btn-ghost text-xs px-3 py-1.5 h-auto flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg> PDF
              </button>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-surface-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-6 print:overflow-visible">
            {loading ? (
              <div className="space-y-4 print:hidden">{[1, 2, 3].map(i => <div key={i} className="shimmer-line h-6 rounded" style={{ width: `${70 + i * 10}%` }} />)}</div>
            ) : data ? (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface-3 rounded-lg p-3 print:bg-gray-100 print:text-black">
                    <p className="text-xs text-slate-500 mb-0.5 print:text-gray-600">Paciente</p>
                    <p className="text-sm font-medium text-slate-200 print:text-black">{data.paciente}</p>
                    {/* Adicionando o CPF com destaque logo abaixo do nome */}
                    {data.cpf && (
                      <p className="text-xs text-slate-400 mt-1 font-mono print:text-gray-700">
                        CPF: {data.cpf}
                      </p>
                    )}
                  </div>
                  <div className="bg-surface-3 rounded-lg p-3 print:bg-gray-100 print:text-black">
                    <p className="text-xs text-slate-500 mb-0.5 print:text-gray-600">Idade / Sexo</p>
                    <p className="text-sm font-medium text-slate-200 print:text-black">{data.idade} · {data.sexo === 'M' ? 'Masc.' : 'Fem.'}</p>
                  </div>
                  <div className="bg-surface-3 rounded-lg p-3 print:bg-gray-100 print:text-black">
                    <p className="text-xs text-slate-500 mb-0.5 print:text-gray-600">Status</p>
                    <p className={`text-sm font-medium ${data.status === 'CONCLUIDO' ? 'text-emerald-400 print:text-emerald-700' : data.status === 'PROCESSANDO' ? 'text-amber-400 print:text-amber-700' : 'text-red-400 print:text-red-700'}`}>
                      {data.status === 'CONCLUIDO' ? 'Concluído' : data.status === 'PROCESSANDO' ? 'Processando...' : 'Erro'}
                    </p>
                  </div>
                </div>

                {data.status === 'CONCLUIDO' && data.imagens && data.imagens.length > 0 && (
                  <div className="flex items-center gap-2 mb-2 print:hidden">
                    <input type="checkbox" id="toggle-imagens" className="w-4 h-4 accent-accent cursor-pointer" checked={mostrarImagens} onChange={e => setMostrarImagens(e.target.checked)} />
                    <label htmlFor="toggle-imagens" className="text-sm font-medium text-slate-300 cursor-pointer select-none">Exibir imagens capturadas do olho</label>
                  </div>
                )}

                {(mostrarImagens || document.documentElement.classList.contains('printing')) && data.imagens && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {data.imagens.map((img, i) => {
                      const src = `http://localhost:8000/imagens_salvas/${img.caminho.split(/[/\\]/).pop()}`
                      const label = `Olho ${img.tipo === 'OD' ? 'Direito (OD)' : 'Esquerdo (OE)'}`
                      return (
                        <div
                          key={i}
                          className="rounded-lg overflow-hidden border border-surface-4 bg-black/50 print:border-gray-300 cursor-zoom-in group relative"
                          onClick={() => setImagemExpandida({ src, label })}
                        >
                          <img
                            src={src}
                            alt={label}
                            className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center print:hidden">
                            <svg className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16zM11 8v6M8 11h6" />
                            </svg>
                          </div>
                          <div className="bg-surface-3 p-2 text-center text-xs font-semibold text-slate-300 print:bg-gray-100 print:text-black">{label}</div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {data.status === 'CONCLUIDO' && gruposPorOlho && Object.keys(gruposPorOlho).length > 0 ? (
                  Object.entries(gruposPorOlho).map(([olho, resultados]) => (
                    <div key={olho}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center print:border-black print:bg-gray-200">
                          <svg className="w-3 h-3 text-accent-glow print:text-black" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-200 print:text-black">{olho === 'OD' ? 'Olho Direito (OD)' : 'Olho Esquerdo (OE)'}</h3>
                      </div>
                      <div className="space-y-3 pl-8">
                        {resultados.map((r, i) => (
                          <div key={i}>
                            <div className="flex justify-between items-baseline mb-1.5"><span className="text-sm text-slate-200 print:text-black">{r.doenca}</span></div>
                            <div className="print:hidden"><BarraConfianca valor={r.confianca} /></div>
                            <div className="hidden print:block text-sm font-bold">Confiança: {r.confianca}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : data.status === 'PROCESSANDO' ? (
                  <div className="flex items-center gap-3 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 print:hidden">
                    <svg className="w-5 h-5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Análise em andamento. Feche e acompanhe na lista.
                  </div>
                ) : data.status === 'ERRO' ? (
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-4 print:hidden">Ocorreu um erro durante o processamento deste diagnóstico.</div>
                ) : null}

                <div className="pt-3 border-t border-surface-4 flex justify-between items-end text-xs text-slate-500 font-mono print:border-black print:text-gray-600 mt-6">
                  <div className="flex flex-col gap-1">
                    <span>Modelo: {data.modelo_versao}</span>
                    {data.cpf && <span>CPF / ID: {data.cpf}</span>}
                  </div>
                  <span>ID #{data.id}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-6 py-4 border-t border-surface-4 print:hidden">
            <button onClick={onClose} className="btn-ghost w-full">Fechar</button>
          </div>
        </div>
      </div>
    </>
  )
}