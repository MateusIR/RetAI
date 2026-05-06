import React, { useState, useEffect, useCallback } from 'react'
import { fetchDiagnosticos, DiagnosticoListItem } from '../api'
import ModalDetalhe from './ModalDetalhe'

interface Props {
  refreshKey: number
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'CONCLUIDO') {
    return (
      <span className="badge-done">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
        Concluído
      </span>
    )
  }
  if (status === 'PROCESSANDO') {
    return (
      <span className="badge-processing">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
        Processando
      </span>
    )
  }
  return (
    <span className="badge-error">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
      Erro
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-surface-4">
      {[1, 2, 3, 4, 5].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="shimmer-line" style={{ width: `${60 + i * 8}%` }} />
        </td>
      ))}
    </tr>
  )
}

export default function TelaLista({ refreshKey }: Props) {
  const [diagnosticos, setDiagnosticos] = useState<DiagnosticoListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroNome, setFiltroNome] = useState('')
  const [filtroDoenca, setFiltroDoenca] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const hasProcessing = diagnosticos.some(d => d.status === 'PROCESSANDO')

  const carregar = useCallback(async () => {
    try {
      const data = await fetchDiagnosticos(filtroNome, filtroDoenca)
      setDiagnosticos(data)
      setError(null)
    } catch {
      setError('Não foi possível conectar com a API. Verifique se o backend está rodando.')
    } finally {
      setLoading(false)
    }
  }, [filtroNome, filtroDoenca])

  // Recarrega ao trocar filtros ou quando refreshKey muda
  useEffect(() => {
    setLoading(true)
    carregar()
  }, [carregar, refreshKey])

  // Polling enquanto há diagnósticos em processamento
  useEffect(() => {
    if (!hasProcessing) return
    const id = setInterval(carregar, 3000)
    return () => clearInterval(id)
  }, [hasProcessing, carregar])

  const formatarData = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="animate-fade-in">
      {/* Filtros */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1">
          <label className="label">Paciente</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="input-field pl-9"
              placeholder="Buscar por nome..."
              value={filtroNome}
              onChange={e => setFiltroNome(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="label">Doença detectada</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <input
              className="input-field pl-9"
              placeholder="Ex: Glaucoma..."
              value={filtroDoenca}
              onChange={e => setFiltroDoenca(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Indicador de atualização automática */}
      {hasProcessing && (
        <div className="flex items-center gap-2 text-xs text-amber-400 mb-4 px-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
          Atualizando automaticamente enquanto há diagnósticos em processamento...
        </div>
      )}

      {/* Erro de conexão */}
      {error && (
        <div className="card p-4 mb-4 border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Tabela */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-4 text-slate-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Paciente</th>
              <th className="text-left px-4 py-3 font-medium">Idade / Sexo</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Doenças detectadas</th>
              <th className="text-left px-4 py-3 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : diagnosticos.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="text-sm">Nenhum diagnóstico encontrado</span>
                    </div>
                  </td>
                </tr>
              )
              : diagnosticos.map(diag => (
                <tr
                  key={diag.id}
                  className="border-b border-surface-4/60 hover:bg-surface-3/50 cursor-pointer transition-colors duration-150"
                  onClick={() => setSelectedId(diag.id)}
                >
                  <td className="px-4 py-3 font-medium text-slate-200">{diag.paciente}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {diag.idade} anos · {diag.sexo === 'M' ? 'Masc.' : 'Fem.'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={diag.status} />
                  </td>
                  <td className="px-4 py-3">
                    {diag.doencas_detectadas.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {diag.doencas_detectadas.map(d => (
                          <span key={d} className="px-2 py-0.5 rounded-md text-xs bg-accent/15 text-accent-glow border border-accent/20">
                            {d}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                    {formatarData(diag.data_criacao)}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Contagem */}
      {!loading && diagnosticos.length > 0 && (
        <p className="text-xs text-slate-500 mt-3 px-1">
          {diagnosticos.length} diagnóstico{diagnosticos.length > 1 ? 's' : ''} encontrado{diagnosticos.length > 1 ? 's' : ''}
        </p>
      )}

      {/* Modal de detalhe */}
      {selectedId !== null && (
        <ModalDetalhe
          diagnosticoId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
