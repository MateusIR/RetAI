import React, { useState, useRef } from 'react'
import { criarDiagnostico } from '../api'

interface Props {
  onSuccess: () => void
  onNovo: () => void
}

interface FormState {
  nome: string
  cpf: string
  idade: string
  sexo: 'M' | 'F'
  od: boolean
  oe: boolean
  fileOd: File | null
  fileOe: File | null
}

const INITIAL: FormState = {
  nome: '',
  cpf: '',
  idade: '',
  sexo: 'M',
  od: false,
  oe: false,
  fileOd: null,
  fileOe: null,
}

function FileDropZone({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) onChange(f)
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200
        ${dragging ? 'border-accent bg-accent/10' : file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-surface-4 hover:border-accent/50 hover:bg-surface-3/50'}`}
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => onChange(e.target.files?.[0] ?? null)} />
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="text-left">
            <p className="text-sm font-medium text-emerald-400">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button className="ml-auto text-slate-400 hover:text-red-400 transition-colors p-1" onClick={e => { e.stopPropagation(); onChange(null) }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      ) : (
        <div>
          <svg className="w-8 h-8 mx-auto mb-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">Clique ou arraste uma imagem</p>
        </div>
      )}
    </div>
  )
}

type Step = 'form' | 'sending' | 'done'

export default function TelaNovo({ onSuccess, onNovo }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)
  const [diagnosticoId, setDiagnosticoId] = useState<number | null>(null)

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(prev => ({ ...prev, [k]: v }))

  const formatCpf = (value: string) => value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').slice(0, 14);

  const podeEnviar = form.nome.trim() && form.idade && Number(form.idade) > 0 && ((form.od && form.fileOd) || (form.oe && form.fileOe))

  const handleSubmit = async () => {
    if (!podeEnviar) return
    setStep('sending'); setError(null)
    try {
      const res = await criarDiagnostico({
        nome: form.nome.trim(),
        cpf: form.cpf.trim() || undefined, // Envia undefined se estiver vazio
        idade: Number(form.idade),
        sexo: form.sexo,
        tipo_od: form.od,
        tipo_oe: form.oe,
        file_od: form.fileOd,
        file_oe: form.fileOe,
      })
      setDiagnosticoId(res.diagnostico_id)
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
      setStep('form')
    }
  }

  const handleNovo = () => {
    setForm(INITIAL); setStep('form'); setError(null); setDiagnosticoId(null); onNovo()
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-slide-up">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">Enviado com sucesso!</h2>
        <p className="text-slate-400 text-sm mb-1">O diagnóstico #{diagnosticoId} está em fila de processamento.</p>
        <p className="text-slate-500 text-xs mb-10">Acompanhe o status na aba Diagnósticos.</p>
        <div className="flex gap-3">
          <button onClick={onSuccess} className="btn-primary flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> Ver diagnósticos</button>
          <button onClick={handleNovo} className="btn-ghost flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Novo diagnóstico</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl animate-fade-in">
      <div className="card p-6 space-y-6">
        <section>
          <h3 className="font-display text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent-glow">1</span>
            Dados do paciente
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Nome completo</label>
                <input className="input-field" placeholder="Ex: Maria Silva" value={form.nome} onChange={e => setField('nome', e.target.value)} />
              </div>
              <div>
                <label className="label">CPF / ID (Opcional)</label>
                <input className="input-field font-mono text-sm" placeholder="000.000.000-00" maxLength={14} value={form.cpf} onChange={e => setField('cpf', formatCpf(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Idade</label>
                <input className="input-field" type="number" min={1} max={130} placeholder="Ex: 45" value={form.idade} onChange={e => setField('idade', e.target.value)} />
              </div>
              <div>
                <label className="label">Sexo</label>
                <select className="input-field" value={form.sexo} onChange={e => setField('sexo', e.target.value as 'M' | 'F')}>
                  <option value="M">Masculino</option><option value="F">Feminino</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-surface-4" />

        <section>
          <h3 className="font-display text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent-glow">2</span>
            Imagens para análise
          </h3>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-3 mb-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${form.od ? 'bg-accent border-accent' : 'border-surface-4 group-hover:border-accent/50'}`} onClick={() => setField('od', !form.od)}>
                  {form.od && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-sm font-medium text-slate-200">Olho Direito (OD)</span>
              </label>
              {form.od && <div className="animate-slide-up"><FileDropZone label="Imagem do Olho Direito (fundoscopia / OCT)" file={form.fileOd} onChange={f => setField('fileOd', f)} /></div>}
            </div>

            <div>
              <label className="flex items-center gap-3 mb-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${form.oe ? 'bg-accent border-accent' : 'border-surface-4 group-hover:border-accent/50'}`} onClick={() => setField('oe', !form.oe)}>
                  {form.oe && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-sm font-medium text-slate-200">Olho Esquerdo (OE)</span>
              </label>
              {form.oe && <div className="animate-slide-up"><FileDropZone label="Imagem do Olho Esquerdo (fundoscopia / OCT)" file={form.fileOe} onChange={f => setField('fileOe', f)} /></div>}
            </div>
          </div>
        </section>

        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">{error}</div>}

        <button className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base" disabled={!podeEnviar || step === 'sending'} onClick={handleSubmit}>
          {step === 'sending' ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Enviando...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> Gerar Diagnóstico</>
          )}
        </button>

        {!podeEnviar && (form.nome || form.idade || form.od || form.oe) && <p className="text-xs text-slate-500 text-center -mt-2">Preencha nome, idade e envie ao menos uma imagem.</p>}
      </div>
    </div>
  )
}