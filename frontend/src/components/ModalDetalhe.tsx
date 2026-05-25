import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchDiagnostico, atualizarParecer, DiagnosticoDetalhe } from '../api'
import { gerarHTMLdoLaudo } from '../utils/pdfExport'

interface Props {
  diagnosticoId: number
  onClose: () => void
  currentUser: any
}

interface DialogProps {
  title: string
  message: string
  type?: 'info' | 'warning' | 'danger'
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
}

function PlatformDialog({ title, message, type = 'info', confirmLabel = 'Ok', cancelLabel, onConfirm, onCancel }: DialogProps) {
  const icons = {
    info: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    danger: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  const colors = {
    info:    { ring: 'border-accent/30',      bg: 'bg-accent/10',      icon: 'text-accent-glow',  btn: 'btn-primary' },
    warning: { ring: 'border-amber-500/30',   bg: 'bg-amber-500/10',   icon: 'text-amber-400',    btn: 'bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors' },
    danger:  { ring: 'border-red-500/30',     bg: 'bg-red-500/10',     icon: 'text-red-400',      btn: 'bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors' },
  }

  const c = colors[type]

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className={`card w-full max-w-sm p-6 text-center animate-slide-up border ${c.ring}`}>
        <div className={`w-16 h-16 rounded-full ${c.bg} border ${c.ring} flex items-center justify-center mx-auto mb-4 ${c.icon}`}>
          {icons[type]}
        </div>
        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3">
          {cancelLabel && onCancel && (
            <button onClick={onCancel} className="btn-ghost flex-1">{cancelLabel}</button>
          )}
          <button onClick={onConfirm} className={cancelLabel ? c.btn : `${c.btn} w-full`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export function usePlatformDialog() {
  const [dialog, setDialog] = useState<(DialogProps & { resolve: (v: boolean) => void }) | null>(null)

  const showAlert = (title: string, message: string, type: DialogProps['type'] = 'info'): Promise<void> =>
    new Promise(resolve =>
      setDialog({
        title,
        message,
        type,
        confirmLabel: 'Ok',
        onConfirm: () => {
          setDialog(null)
          resolve(true as any)
        },
        resolve: resolve as any
      })
    )

  const showConfirm = (
    title: string,
    message: string,
    type: DialogProps['type'] = 'warning',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar'
  ): Promise<boolean> =>
    new Promise(resolve =>
      setDialog({
        title,
        message,
        type,
        confirmLabel,
        cancelLabel,
        onConfirm: () => {
          setDialog(null)
          resolve(true)
        },
        onCancel: () => {
          setDialog(null)
          resolve(false)
        },
        resolve,
      })
    )

  const DialogRenderer = dialog ? (
    <PlatformDialog {...dialog} />
  ) : null

  return { showAlert, showConfirm, DialogRenderer }
}

function BarraConfianca({ valor }: { valor: number }) {
  const { t } = useTranslation()
  const cor = valor >= 80 ? 'bg-red-500' : valor >= 60 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-surface-4 overflow-hidden">
        <div
          className={`h-full rounded-full ${cor} transition-all duration-700`}
          style={{ width: `${valor}%` }}
        />
      </div>
      <span className="font-mono text-xs text-slate-300 w-12 text-right">{t('diagnosis.confidenceBar', { valor })}</span>
    </div>
  )
}

function ImagemLightbox({
  src,
  label,
  onClose
}: {
  src: string
  label: string
  onClose: () => void
}) {
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

      <p className="mt-4 text-xs text-slate-600">
        {useTranslation().t('app.clickOrEsc')}
      </p>
    </div>
  )
}

export default function ModalDetalhe({ diagnosticoId, onClose, currentUser }: Props) {
  const { t } = useTranslation()
  const [data, setData] = useState<DiagnosticoDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [mostrarImagens, setMostrarImagens] = useState(false)
  const [imagemExpandida, setImagemExpandida] = useState<{ src: string; label: string } | null>(null)
  const [parecer, setParecer] = useState('')

  const podeEditarParecer = currentUser?.verificado === true
  const podeGerarPDF      = currentUser?.verificado === true

  useEffect(() => {
    fetchDiagnostico(diagnosticoId)
      .then((d) => {
        setData(d)
        setParecer(d.parecer || '')
      })
      .finally(() => setLoading(false))
  }, [diagnosticoId])

  useEffect(() => {
    if (!data || !podeEditarParecer) return

    const timer = setTimeout(() => {
      atualizarParecer(data.id, parecer).catch(console.error)
    }, 800)

    return () => clearTimeout(timer)
  }, [parecer, data, podeEditarParecer])

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

  const formatarCPF = (cpf?: string) => {
    if (!cpf) return null
    const digits = cpf.replace(/\D/g, '')
    if (digits.length === 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return cpf
  }

  const gerarPDFLaudo = () => {
    if (!data) return
    const html = gerarHTMLdoLaudo(data, parecer)
    const novaJanela = window.open('', '_blank', 'width=900,height=700')
    if (novaJanela) {
      novaJanela.document.write(html)
      novaJanela.document.close()
    }
  }

  return (
    <>
      {imagemExpandida && (
        <ImagemLightbox
          src={imagemExpandida.src}
          label={imagemExpandida.label}
          onClose={() => setImagemExpandida(null)}
        />
      )}

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in print:bg-transparent print:backdrop-blur-none"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div className="card w-full max-w-lg mx-4 animate-slide-up overflow-hidden max-h-[90vh] flex flex-col modal-print-area print:max-h-none print:shadow-none print:border-none">

          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-4 print:border-b-black">
            <h2 className="font-display text-lg font-semibold text-white print:text-black">
              {t('app.diagnosisDetail')}
            </h2>

            <div className="flex gap-2 print:hidden">
              {podeGerarPDF ? (
                <button
                  onClick={gerarPDFLaudo}
                  className="btn-ghost text-xs px-3 py-1.5 h-auto flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  {t('app.printButton')}
                </button>
              ) : (
                <span
                  className="text-xs px-3 py-1.5 h-auto flex items-center gap-2 text-slate-600 cursor-not-allowed"
                  title={t('app.verifiedOnlyPDF')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  {t('app.printButton')}
                </span>
              )}

              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-surface-4"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Corpo */}
          <div className="overflow-y-auto flex-1 p-6 print:overflow-visible">
            {loading ? (
              <div className="space-y-4 print:hidden">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="shimmer-line h-6 rounded"
                    style={{ width: `${70 + i * 10}%` }}
                  />
                ))}
              </div>
            ) : data ? (
              <div className="space-y-5">

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface-3 rounded-lg p-3 print:bg-gray-100 print:text-black">
                    <p className="text-xs text-slate-500 mb-0.5 print:text-gray-600">{t('app.patient')}</p>
                    <p className="text-sm font-medium text-slate-200 print:text-black">
                      {data.paciente}
                    </p>
                  </div>

                  <div className="bg-surface-3 rounded-lg p-3 print:bg-gray-100 print:text-black">
                    <p className="text-xs text-slate-500 mb-0.5 print:text-gray-600">{t('app.ageSex')}</p>
                    <p className="text-sm font-medium text-slate-200 print:text-black">
                      {data.idade} · {data.sexo === 'M' ? t('app.male') : t('app.female')}
                    </p>
                  </div>

                  <div className="bg-surface-3 rounded-lg p-3 print:bg-gray-100 print:text-black">
                    <p className="text-xs text-slate-500 mb-0.5 print:text-gray-600">{t('app.status')}</p>
                    <p className={`text-sm font-medium ${
                      data.status === 'CONCLUIDO'
                        ? 'text-emerald-400 print:text-emerald-700'
                        : data.status === 'PROCESSANDO'
                        ? 'text-amber-400 print:text-amber-700'
                        : 'text-red-400 print:text-red-700'
                    }`}>
                      {data.status === 'CONCLUIDO'
                        ? t('app.concluded')
                        : data.status === 'PROCESSANDO'
                        ? t('app.processing')
                        : t('app.error')}
                    </p>
                  </div>
                </div>

                {data.status === 'CONCLUIDO' && data.imagens && data.imagens.length > 0 && (
                  <div className="flex items-center gap-2 mb-2 print:hidden">
                    <input
                      type="checkbox"
                      id="toggle-imagens"
                      className="w-4 h-4 accent-accent cursor-pointer"
                      checked={mostrarImagens}
                      onChange={e => setMostrarImagens(e.target.checked)}
                    />
                    <label
                      htmlFor="toggle-imagens"
                      className="text-sm font-medium text-slate-300 cursor-pointer select-none"
                    >
                      {t('app.toggleImages')}
                    </label>
                  </div>
                )}

                {(mostrarImagens || document.documentElement.classList.contains('printing')) && data.imagens && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {data.imagens.map((img, i) => {
                      const src = `http://localhost:8000/imagens_salvas/${img.caminho.split(/[/\\]/).pop()}`
                      const label = img.tipo === 'OD' ? t('app.od') : t('app.oe')

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
                          <div className="bg-surface-3 p-2 text-center text-xs font-semibold text-slate-300 print:bg-gray-100 print:text-black">
                            {label}
                          </div>
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
                          <svg className="w-3 h-3 text-accent-glow print:text-black" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-200 print:text-black">
                          {olho === 'OD' ? t('app.od') : t('app.oe')}
                        </h3>
                      </div>
                      <div className="space-y-3 pl-8">
                        {resultados.map((r, i) => (
                          <div key={i}>
                            <div className="flex justify-between items-baseline mb-1.5">
                              <span className="text-sm text-slate-200 print:text-black">
                                {r.doenca}
                              </span>
                            </div>
                            <div className="print:hidden">
                              <BarraConfianca valor={r.confianca} />
                            </div>
                            <div className="hidden print:block text-sm font-bold">
                              {t('diagnosis.confidenceBar', { valor: r.confianca })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : data.status === 'PROCESSANDO' ? (
                  <div className="flex items-center gap-3 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 print:hidden">
                    <svg className="w-5 h-5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('diagnosis.analysisInProgress')}
                  </div>
                ) : data.status === 'ERRO' ? (
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-4 print:hidden">
                    {t('diagnosis.errorOccurred')}
                  </div>
                ) : null}

                {data.status === 'CONCLUIDO' && (
                  <div className="pt-4 border-t border-surface-4 print:border-black">
                    <label className="text-xs text-slate-500 block mb-1 print:text-gray-600">
                      {t('app.report')}
                    </label>
                    {podeEditarParecer ? (
                      <textarea
                        className="w-full bg-surface-3 border border-surface-4 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 resize-none print:bg-white print:text-black print:border-black"
                        rows={3}
                        placeholder={t('app.reportPlaceholder')}
                        value={parecer}
                        onChange={e => setParecer(e.target.value)}
                      />
                    ) : (
                      <div className="relative group">
                        <textarea
                          className="w-full bg-surface-3/40 border border-surface-4/50 rounded-lg p-3 text-sm text-slate-600 placeholder-slate-700 resize-none cursor-not-allowed"
                          rows={3}
                          placeholder={t('app.reportPlaceholder')}
                          disabled
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <span className="bg-surface-1 border border-amber-500/40 text-amber-400 text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            {t('app.reportTooltip')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-surface-4 flex justify-between items-end text-xs text-slate-500 font-mono print:border-black print:text-gray-600 mt-6">
                  <div className="flex flex-col gap-1">
                    <span>{t('app.model')}: {data.modelo_versao}</span>
                    {data.cpf && <span>CPF: {formatarCPF(data.cpf)}</span>}
                  </div>
                  <span>{t('app.idDiagnosis')}: #{data.id}</span>
                </div>

              </div>
            ) : null}
          </div>

          <div className="px-6 py-4 border-t border-surface-4 print:hidden">
            <button onClick={onClose} className="btn-ghost w-full">
              {t('app.closeModal')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}