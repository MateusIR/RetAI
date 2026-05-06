const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface ResultadoItem {
  doenca: string
  confianca: number
  olho: string
}

export interface DiagnosticoListItem {
  id: number
  paciente: string
  idade: number
  sexo: string
  status: 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO'
  data_criacao: string
  data_finalizacao: string | null
  doencas_detectadas: string[]
  resultados: ResultadoItem[]
  modelo_versao: string
}

export interface DiagnosticoDetalhe extends DiagnosticoListItem {
  imagens: { tipo: string; caminho: string }[]
}

export interface CriarDiagnosticoPayload {
  nome: string
  idade: number
  sexo: string
  tipo_od: boolean
  tipo_oe: boolean
  file_od?: File | null
  file_oe?: File | null
}

export async function fetchDiagnosticos(
  nomeFiltro?: string,
  doencaFiltro?: string,
): Promise<DiagnosticoListItem[]> {
  const params = new URLSearchParams()
  if (nomeFiltro) params.set('nome_filtro', nomeFiltro)
  if (doencaFiltro) params.set('doenca_filtro', doencaFiltro)
  const res = await fetch(`${BASE}/api/diagnosticos/?${params}`)
  if (!res.ok) throw new Error('Erro ao buscar diagnósticos')
  return res.json()
}

export async function fetchDiagnostico(id: number): Promise<DiagnosticoDetalhe> {
  const res = await fetch(`${BASE}/api/diagnosticos/${id}`)
  if (!res.ok) throw new Error('Erro ao buscar diagnóstico')
  return res.json()
}

export async function criarDiagnostico(payload: CriarDiagnosticoPayload): Promise<{ diagnostico_id: number }> {
  const form = new FormData()
  form.append('nome', payload.nome)
  form.append('idade', String(payload.idade))
  form.append('sexo', payload.sexo)
  form.append('tipo_od', String(payload.tipo_od))
  form.append('tipo_oe', String(payload.tipo_oe))
  if (payload.tipo_od && payload.file_od) form.append('file_od', payload.file_od)
  if (payload.tipo_oe && payload.file_oe) form.append('file_oe', payload.file_oe)

  const res = await fetch(`${BASE}/api/diagnosticos/`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? 'Erro ao criar diagnóstico')
  }
  return res.json()
}
