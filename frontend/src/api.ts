const BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "retai_token";

const getToken = (): string | null => sessionStorage.getItem(TOKEN_KEY);

const getAuthHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getCurrentLang = (): string => {
  return localStorage.getItem('lang') || 'pt-BR';
};

const forcarLogoutGlobal = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem("retai_user");
  sessionStorage.removeItem("retai_expires_at");
  window.dispatchEvent(new Event("sessao_expirada"));
};

async function apiFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input as string, BASE);
  url.searchParams.set('lang', getCurrentLang());

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  if (res.status === 401) {
    forcarLogoutGlobal();
    throw new Error("Sessão expirada");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Erro ${res.status}`);
  }
  return res;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface Usuario {
  id: number;
  nome: string;
  email: string;
  crm: string;
  is_superadmin: boolean;
  solicitou_reset: boolean;
  verificado: boolean;
}
export interface ResultadoItem {
  doenca: string;
  confianca: number;
  olho: string;
}
export interface DiagnosticoListItem {
  id: number;
  paciente: string;
  cpf?: string;
  idade: number;
  sexo: string;
  status: "PROCESSANDO" | "CONCLUIDO" | "ERRO";
  data_criacao: string;
  doencas_detectadas: string[];
  modelo_versao: string;
}
export interface DiagnosticoDetalhe extends DiagnosticoListItem {
  imagens: { tipo: string; caminho: string }[];
  resultados: ResultadoItem[];
  parecer?: string;
}
export interface PaginatedResponse<T> {
  total: number;
  pagina_atual: number;
  dados: T[];
}

// ── Funções da API ────────────────────────────────────────────────────────────
export async function fetchUsuarios(): Promise<Usuario[]> {
  const res = await apiFetch(`${BASE}/api/medicos/`);
  return res.json();
}

export async function editUsuario(id: number, data: { nome: string; crm: string; email: string }) {
  await apiFetch(`${BASE}/api/medicos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteUsuario(id: number) {
  await apiFetch(`${BASE}/api/medicos/${id}`, { method: "DELETE" });
}

export async function promoverUsuario(id: number) {
  await apiFetch(`${BASE}/api/medicos/${id}/promover`, { method: "POST" });
}

export async function fetchDiagnosticos(
  nomeFiltro?: string, cpfFiltro?: string, doencas: string[] = [], doencasLogic: "AND" | "OR" = "OR", apenasMeus = true, page = 1
): Promise<PaginatedResponse<DiagnosticoListItem>> {
  const params = new URLSearchParams();
  if (nomeFiltro) params.set("nome_filtro", nomeFiltro);
  if (cpfFiltro) params.set("cpf_filtro", cpfFiltro);
  params.set("apenas_meus", String(apenasMeus));
  params.set("doencas_logic", doencasLogic);
  doencas.forEach((d) => params.append("doencas", d));
  params.set("page", String(page));

  const res = await apiFetch(`${BASE}/api/diagnosticos/?${params}`);
  return res.json();
}

export async function fetchDiagnostico(id: number): Promise<DiagnosticoDetalhe> {
  const res = await apiFetch(`${BASE}/api/diagnosticos/${id}`);
  return res.json();
}

export async function criarDiagnostico(payload: {
  nome: string; idade: number; sexo: string; cpf?: string;
  tipo_od: boolean; tipo_oe: boolean;
  file_od?: File; file_oe?: File; modelo: 'ConvNextV2' | 'EfficientNetV2';
}) {
  const form = new FormData();
  form.append("nome", payload.nome);
  form.append("idade", String(payload.idade));
  form.append("sexo", payload.sexo);
  if (payload.cpf) form.append("cpf", payload.cpf);
  form.append("tipo_od", String(payload.tipo_od));
  form.append("tipo_oe", String(payload.tipo_oe));
  if (payload.tipo_od && payload.file_od) form.append("file_od", payload.file_od);
  if (payload.tipo_oe && payload.file_oe) form.append("file_oe", payload.file_oe);
  form.append("modelo", payload.modelo);

  const res = await apiFetch(`${BASE}/api/diagnosticos/`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

export async function excluirDiagnosticos(ids: number[]) {
  await apiFetch(`${BASE}/api/diagnosticos/deletar-massa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

export async function atualizarParecer(diagnosticoId: number, parecer: string): Promise<void> {
  await apiFetch(`${BASE}/api/diagnosticos/${diagnosticoId}/parecer`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parecer }),
  });
}