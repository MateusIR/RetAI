const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000'

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('reta_auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const forcarLogoutGlobal = () => {
  localStorage.removeItem('reta_auth_token')
  localStorage.removeItem('reta_user')
  window.dispatchEvent(new Event('sessao_expirada'))
}

export interface Usuario { id: number; nome: string; email: string; crm: string; is_superadmin: boolean; }
export interface ResultadoItem { doenca: string; confianca: number; olho: string; }
export interface DiagnosticoListItem {
  id: number; paciente: string; idade: number; sexo: string; status: 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO';
  data_criacao: string; doencas_detectadas: string[]; modelo_versao: string;
}
export interface DiagnosticoDetalhe extends DiagnosticoListItem { imagens: { tipo: string; caminho: string }[]; resultados: ResultadoItem[]; }
export interface PaginatedResponse<T> { total: number; pagina_atual: number; dados: T[]; }

// Usuários
export async function fetchUsuarios(): Promise<Usuario[]> {
  const res = await fetch(`${BASE}/api/medicos/`, { headers: getAuthHeaders() })
  if (!res.ok) { if(res.status === 401) forcarLogoutGlobal(); throw new Error('Erro'); }
  return res.json()
}
export async function editUsuario(id: number, data: {nome: string, crm: string, email: string}) {
  const res = await fetch(`${BASE}/api/medicos/${id}`, { method: 'PUT', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json'}, body: JSON.stringify(data) })
  if (!res.ok) { if(res.status === 401) forcarLogoutGlobal(); throw new Error('Erro'); }
}
export async function deleteUsuario(id: number) {
  const res = await fetch(`${BASE}/api/medicos/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
  if (!res.ok) { if(res.status === 401) forcarLogoutGlobal(); throw new Error('Erro'); }
}
export async function promoverUsuario(id: number) {
  const res = await fetch(`${BASE}/api/medicos/${id}/promover`, { method: 'POST', headers: getAuthHeaders() })
  if (!res.ok) { if(res.status === 401) forcarLogoutGlobal(); throw new Error('Erro'); }
}

// Diagnósticos
export async function fetchDiagnosticos(
  nomeFiltro?: string, cpfFiltro?: string, doencas: string[] = [], doencasLogic: 'AND' | 'OR' = 'OR',
  apenasMeus: boolean = true, page: number = 1
): Promise<PaginatedResponse<DiagnosticoListItem>> {
  const params = new URLSearchParams()
  if (nomeFiltro) params.set('nome_filtro', nomeFiltro)
  if (cpfFiltro) params.set('cpf_filtro', cpfFiltro)
  params.set('apenas_meus', String(apenasMeus))
  params.set('doencas_logic', doencasLogic)
  doencas.forEach(d => params.append('doencas', d))
  params.set('page', String(page))

  const res = await fetch(`${BASE}/api/diagnosticos/?${params}`, { headers: getAuthHeaders() })
  if (!res.ok) { if (res.status === 401) forcarLogoutGlobal(); throw new Error('Erro') }
  return res.json()
}

export async function fetchDiagnostico(id: number): Promise<DiagnosticoDetalhe> {
  const res = await fetch(`${BASE}/api/diagnosticos/${id}`, { headers: getAuthHeaders() })
  if (!res.ok) { if (res.status === 401) forcarLogoutGlobal(); throw new Error('Erro') }
  return res.json()
}

export async function criarDiagnostico(payload: any) {
  const form = new FormData()
  form.append('nome', payload.nome); form.append('idade', String(payload.idade)); form.append('sexo', payload.sexo)
  if (payload.cpf) form.append('cpf', payload.cpf)
  form.append('tipo_od', String(payload.tipo_od)); form.append('tipo_oe', String(payload.tipo_oe))
  if (payload.tipo_od && payload.file_od) form.append('file_od', payload.file_od)
  if (payload.tipo_oe && payload.file_oe) form.append('file_oe', payload.file_oe)

  const res = await fetch(`${BASE}/api/diagnosticos/`, { method: 'POST', body: form, headers: getAuthHeaders() })
  if (!res.ok) { if (res.status === 401) forcarLogoutGlobal(); throw new Error('Erro') }
  return res.json()
}

export async function excluirDiagnosticos(ids: number[]) {
  const res = await fetch(`${BASE}/api/diagnosticos/deletar-massa`, {
    method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
  })
  if (!res.ok) { if (res.status === 401) forcarLogoutGlobal(); throw new Error('Erro ao excluir') }
}