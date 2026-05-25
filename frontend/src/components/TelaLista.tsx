import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchDiagnosticos, excluirDiagnosticos, DiagnosticoListItem } from '../api';
import ModalDetalhe from './ModalDetalhe';

type ShowAlert   = (title: string, message: string, type?: 'info' | 'warning' | 'danger') => Promise<void>;
type ShowConfirm = (title: string, message: string, type?: 'info' | 'warning' | 'danger', confirmLabel?: string, cancelLabel?: string) => Promise<boolean>;

interface Props {
  refreshKey: number;
  currentUser: any;
  setIsProcessing: (v: boolean) => void;
  showAlert: ShowAlert;
  showConfirm: ShowConfirm;
}

const DOENCAS: { tag: string; nome: string }[] = [
  { tag: 'diabetic_retinopathy', nome: 'Retinopatia Diabética' },
  { tag: 'macular_edema',        nome: 'Edema Macular' },
  { tag: 'scar',                 nome: 'Cicatriz Retiniana' },
  { tag: 'amd',                  nome: 'Degeneração Macular (AMD)' },
  { tag: 'drusens',              nome: 'Drusens' },
  { tag: 'myopic_fundus',        nome: 'Fundo Míope' },
  { tag: 'increased_cup_disc',   nome: 'Aumento da Relação C/D' },
  { tag: 'vascular_occlusion',   nome: 'Oclusão Vascular Retiniana' },
  { tag: 'retinal_detachment',   nome: 'Descolamento de Retina' },
];

const TAG_LEGACY_MAP: Record<string, string> = {
  'Retinopatia Diabética':              'diabetic_retinopathy',
  'Glaucoma':                           'increased_cup_disc',
  'Catarata':                           'scar',
  'DMRI':                               'amd',
  'Oclusão de Veia Retiniana':          'vascular_occlusion',
  'Degeneração Macular Relacionada à Idade': 'amd',
};

function normalizarTag(valor: string): string {
  if (DOENCAS.some(d => d.tag === valor)) return valor;
  return TAG_LEGACY_MAP[valor] ?? valor;
}

function nomeDoenca(valor: string): string {
  const tag = normalizarTag(valor);
  const item = DOENCAS.find(d => d.tag === tag);
  return item?.nome ?? valor;
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === 'CONCLUIDO')   return <span className="badge-done"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> {t('app.concluded')}</span>
  if (status === 'PROCESSANDO') return <span className="badge-processing"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" /> {t('app.processing')}</span>
  return <span className="badge-error"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> {t('app.error')}</span>
}

function SkeletonRow() {
  return (
    <tr className="border-b border-surface-4">
      {[1,2,3,4,5,6].map(i => <td key={i} className="px-4 py-3"><div className="shimmer-line" style={{ width: `${60 + i * 5}%` }} /></td>)}
    </tr>
  )
}

export default function TelaLista({ refreshKey, currentUser, setIsProcessing, showAlert, showConfirm }: Props) {
  const { t } = useTranslation();
  const [diagnosticos, setDiagnosticos] = useState<DiagnosticoListItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  const [filtroNome, setFiltroNome] = useState('')
  const [filtroCpf, setFiltroCpf]   = useState('')
  const [page, setPage]             = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 30

  const [filtroTags, setFiltroTags]     = useState<string[]>([])
  const [doencasLogic, setDoencasLogic] = useState<'OR' | 'AND'>('OR')
  const [apenasMeus, setApenasMeus]     = useState(true)

  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectedId, setSelectedId]   = useState<number | null>(null)
  const [modalDelete, setModalDelete] = useState(false)
  const [modalImprimir, setModalImprimir] = useState(false)
  const [isDeleting, setIsDeleting]   = useState(false)

  const hasProcessing = diagnosticos.some(d => d.status === 'PROCESSANDO')

  useEffect(() => { setIsProcessing(hasProcessing) }, [hasProcessing, setIsProcessing])

  const carregar = useCallback(async () => {
    try {
      const res = await fetchDiagnosticos(filtroNome, filtroCpf, filtroTags, doencasLogic, apenasMeus, page)
      const dados = Array.isArray(res) ? res : res.dados || []
      const total = Array.isArray(res) ? res.length : res.total || 0
      setDiagnosticos(dados)
      setTotalItems(total)
      setError(null)
    } catch {
      setError(t('app.noDiagnostics'))
    } finally {
      setLoading(false)
    }
  }, [filtroNome, filtroCpf, filtroTags, doencasLogic, apenasMeus, page, t])

  useEffect(() => { setLoading(true); carregar() }, [carregar, refreshKey])

  useEffect(() => {
    if (!hasProcessing) return
    const id = setInterval(carregar, 3000)
    return () => clearInterval(id)
  }, [hasProcessing, carregar])

  const toggleTag = (tag: string) => {
    setFiltroTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
    setPage(1)
  }

  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(diagnosticos.map(d => d.id))
    else setSelectedIds([])
  }

  const handleDeleteMassa = async () => {
    setIsDeleting(true)
    try {
      await excluirDiagnosticos(selectedIds)
      setSelectedIds([])
      setModalDelete(false)
      carregar()
    } catch {
      await showAlert(t('app.error'), t('app.deleteMessage'), 'danger')
    }
    setIsDeleting(false)
  }

  const handleDownloadPDFs = async () => {
    setModalImprimir(false);
    try {
      const token = sessionStorage.getItem('retai_token');
      const response = await fetch('http://localhost:8000/api/diagnosticos/exportar-pdfs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.detail || t('app.error'));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
      a.download = filenameMatch ? filenameMatch[1] : `laudos_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      await showAlert(t('app.exportPDFTitle'), t('app.exportPDFMessage', { count: selectedIds.length }), 'info');
      setSelectedIds([]);
    } catch (err: any) {
      await showAlert(t('app.error'), err.message || t('app.error'), 'danger');
    }
  };

  const formatarData = (iso: string) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="animate-fade-in">

      {currentUser?.is_superadmin && (
        <label className="flex items-center gap-2 mb-4 cursor-pointer w-max">
          <input type="checkbox" checked={apenasMeus} onChange={e => { setApenasMeus(e.target.checked); setPage(1) }} className="w-4 h-4 accent-accent rounded cursor-pointer" />
          <span className="text-sm font-medium text-slate-300">{t('list.showOnlyMine')}</span>
        </label>
      )}

      {/* Filtros básicos */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="label">{t('app.patient')}</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input className="input-field pl-9" placeholder={t('app.name') + '...'} value={filtroNome} onChange={e => { setFiltroNome(e.target.value); setPage(1) }} />
          </div>
        </div>
        <div className="flex-1">
          <label className="label">{t('app.cpf')} / ID</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" /></svg>
            <input className="input-field pl-9" placeholder={t('app.login.cpfPlaceholder')} value={filtroCpf} onChange={e => { setFiltroCpf(e.target.value); setPage(1) }} />
          </div>
        </div>
      </div>

      {/* Filtro doenças */}
      <div className="bg-surface-2 p-4 rounded-xl border border-surface-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <label className="label m-0 text-slate-300">{t('list.filterByDiseases')}</label>
          <div className="flex bg-surface-3 rounded-lg p-0.5 border border-surface-4">
            <button onClick={() => setDoencasLogic('OR')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${doencasLogic === 'OR' ? 'bg-accent text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>{t('list.any')}</button>
            <button onClick={() => setDoencasLogic('AND')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${doencasLogic === 'AND' ? 'bg-accent text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>{t('list.all')}</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {DOENCAS.map(({ tag, nome }) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filtroTags.includes(tag)
                  ? 'bg-accent/20 border-accent/50 text-accent-glow'
                  : 'bg-surface-3 border-transparent text-slate-400 hover:border-surface-4 hover:text-slate-200'
              }`}
            >
              {t(`list.disease.${tag}`)}
            </button>
          ))}
        </div>
        {filtroTags.length > 0 && (
          <button
            onClick={() => { setFiltroTags([]); setPage(1) }}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {t('list.clearFilters')}
          </button>
        )}
      </div>

      {hasProcessing && <div className="flex items-center gap-2 text-xs text-amber-400 mb-4 px-1"><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" /> {t('list.autoRefresh')}</div>}
      {error && <div className="card p-4 mb-4 border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-3"><svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div>}

      {/* Ações em massa */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 mb-4 p-3 bg-surface-2 rounded-xl border border-accent/30 animate-slide-up">
          <span className="text-sm font-medium text-slate-200">{selectedIds.length} {t('app.selectedItems')}</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setModalDelete(true)} className="btn-ghost text-red-400 hover:bg-red-500/10 hover:border-red-500/50 py-1.5 px-4">{t('app.delete')}</button>
            {currentUser?.verificado && (
              <button onClick={() => setModalImprimir(true)} className="btn-primary py-1.5 px-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                {t('app.exportPDF')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-4 text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" className="w-4 h-4 accent-accent cursor-pointer rounded" checked={selectedIds.length === diagnosticos.length && diagnosticos.length > 0} onChange={e => toggleAll(e.target.checked)} />
              </th>
              <th className="text-left px-4 py-3 font-medium">{t('app.patient')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('app.ageSex')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('app.status')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('app.detectedDiseases')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('app.date')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />) :
             diagnosticos.length === 0 ? (
               <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">{t('app.noDiagnostics')}</td></tr>
             ) : diagnosticos.map(diag => (
               <tr
                 key={diag.id}
                 className={`border-b border-surface-4/60 hover:bg-surface-3/50 cursor-pointer transition-colors duration-150 ${selectedIds.includes(diag.id) ? 'bg-accent/5' : ''}`}
                 onClick={() => setSelectedId(diag.id)}
               >
                 <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                   <input
                     type="checkbox" className="w-4 h-4 accent-accent cursor-pointer rounded"
                     checked={selectedIds.includes(diag.id)}
                     onChange={e => { if (e.target.checked) setSelectedIds([...selectedIds, diag.id]); else setSelectedIds(selectedIds.filter(id => id !== diag.id)) }}
                   />
                 </td>
                 <td className="px-4 py-3 font-medium text-slate-200">{diag.paciente}</td>
                 <td className="px-4 py-3 text-slate-400">{diag.idade} anos · {diag.sexo === 'M' ? t('app.male') : t('app.female')}</td>
                 <td className="px-4 py-3"><StatusBadge status={diag.status} /></td>
                 <td className="px-4 py-3">
                   {diag.doencas_detectadas && diag.doencas_detectadas.length > 0 ? (
                     <div className="flex flex-wrap gap-1">
                       {diag.doencas_detectadas.map(d => (
                         <span
                           key={d}
                           onClick={e => { e.stopPropagation(); toggleTag(normalizarTag(d)) }}
                           title={`${t('list.filterByDiseases')} ${nomeDoenca(d)}`}
                           className={`px-2 py-0.5 rounded-md text-[10px] border cursor-pointer transition-all ${
                             filtroTags.includes(normalizarTag(d))
                               ? 'bg-accent/30 text-accent-glow border-accent/50'
                               : 'bg-accent/15 text-accent-glow border-accent/20 hover:bg-accent/25'
                           }`}
                         >
                           {nomeDoenca(d)}
                         </span>
                       ))}
                     </div>
                   ) : <span className="text-slate-500">—</span>}
                 </td>
                 <td className="px-4 py-3 text-slate-400 font-mono text-xs">{formatarData(diag.data_criacao)}</td>
               </tr>
             ))
            }
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {!loading && totalItems > 0 && (
        <div className="flex justify-between items-center mt-4 px-1">
          <p className="text-xs text-slate-500">{t('list.showing', { count: diagnosticos.length, total: totalItems })}</p>
          <div className="flex gap-2 items-center">
            <button className="btn-ghost py-1.5 px-3 text-xs" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>{t('list.previous')}</button>
            <span className="text-xs text-slate-400 font-medium">{t('list.page', { page })}</span>
            <button className="btn-ghost py-1.5 px-3 text-xs" disabled={page * itemsPerPage >= totalItems} onClick={() => setPage(p => p + 1)}>{t('list.next')}</button>
          </div>
        </div>
      )}

      {/* Modal Imprimir */}
      {modalImprimir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setModalImprimir(false)}>
          <div className="card w-full max-w-sm p-6 text-center animate-slide-up">
            <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-4 text-accent">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('app.exportPDFTitle')}</h2>
            <p className="text-sm text-slate-400 mb-6">{t('app.exportPDFMessage', { count: selectedIds.length })}</p>
            <div className="flex gap-3">
              <button onClick={() => setModalImprimir(false)} className="btn-ghost flex-1">{t('app.cancel')}</button>
              <button onClick={handleDownloadPDFs} className="btn-primary flex-1">{t('app.exportPDF')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Delete */}
      {modalDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setModalDelete(false)}>
          <div className="card w-full max-w-sm p-6 text-center animate-slide-up">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('app.deleteTitle')}</h2>
            <p className="text-sm text-slate-400 mb-6">{t('app.deleteMessage', { count: selectedIds.length })}</p>
            <div className="flex gap-3">
              <button onClick={() => setModalDelete(false)} className="btn-ghost flex-1">{t('app.cancelDelete')}</button>
              <button onClick={handleDeleteMassa} disabled={isDeleting} className="bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors flex justify-center items-center">
                {isDeleting
                  ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  : t('app.deleteConfirm')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedId !== null && <ModalDetalhe currentUser={currentUser} diagnosticoId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}