import React, { useState, useEffect } from "react";
import { appWindow } from "@tauri-apps/api/window";
import { fetchUsuarios, deleteUsuario, promoverUsuario, editUsuario, Usuario } from "./api";
import TelaLista from "./components/TelaLista";
import TelaNovo from "./components/TelaNovo";
import TelaAuth from "./components/TelaAuth";
import { useAuth } from "./useAuth";

declare global {
  interface Window { __TAURI__?: any }
}

type Tab = "lista" | "novo";

// ── Diálogo da plataforma ────────────────────────────────────────────────────
interface DialogState {
  title: string
  message: string
  type: 'info' | 'warning' | 'danger'
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
}

function PlatformDialog({ title, message, type, confirmLabel, cancelLabel, onConfirm, onCancel }: DialogState) {
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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  }

  const colors = {
    info:    { border: 'border-accent/30',    bg: 'bg-accent/10',    icon: 'text-accent-glow',  btn: 'btn-primary' },
    warning: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: 'text-amber-400',    btn: 'bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors' },
    danger:  { border: 'border-red-500/30',   bg: 'bg-red-500/10',   icon: 'text-red-400',      btn: 'bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors' },
  }

  const c = colors[type]

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className={`card w-full max-w-sm p-6 text-center animate-slide-up border ${c.border}`}>
        <div className={`w-16 h-16 rounded-full ${c.bg} border ${c.border} flex items-center justify-center mx-auto mb-4 ${c.icon}`}>
          {icons[type]}
        </div>
        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          {cancelLabel && onCancel && (
            <button onClick={onCancel} className="btn-ghost flex-1">{cancelLabel}</button>
          )}
          <button
            onClick={onConfirm}
            className={cancelLabel ? c.btn : `${c.btn} w-full`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ícone de verificado ───────────────────────────────────────────────────────
function SeloVerificado({ size = "sm" }: { size?: "sm" | "xs" }) {
  const cls = size === "xs"
    ? "w-3.5 h-3.5"
    : "w-4 h-4"
  return (
    <svg
      className={`${cls} text-accent flex-shrink-0`}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <title>Médico Verificado</title>
      <path
        fillRule="evenodd"
        d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { token, user, login, logout, isAuthenticated } = useAuth();

  const [tab, setTab]           = useState<Tab>("lista");
  const [refreshKey, setRefreshKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalUsuarios, setModalUsuarios] = useState(false);
  const [modalSobre, setModalSobre]       = useState(false);
  const [userToPromote, setUserToPromote] = useState<number | null>(null);
  const [listaUsers, setListaUsers]       = useState<Usuario[]>([]);
  const [editUserId, setEditUserId]       = useState<number | null>(null);
  const [editForm, setEditForm]           = useState({ nome: "", crm: "", email: "" });
  const [resetUserId, setResetUserId]     = useState<number | null>(null);
  const [novaSenhaAdmin, setNovaSenhaAdmin] = useState("");
  const [isProcessing, setIsProcessing]   = useState(false);

  // Diálogo da plataforma
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const showAlert = (title: string, message: string, type: DialogState['type'] = 'info'): Promise<void> =>
    new Promise(resolve =>
      setDialog({ title, message, type, confirmLabel: 'Ok', onConfirm: () => { setDialog(null); resolve() } })
    )

  const showConfirm = (
    title: string, message: string,
    type: DialogState['type'] = 'warning',
    confirmLabel = 'Confirmar', cancelLabel = 'Cancelar'
  ): Promise<boolean> =>
    new Promise(resolve =>
      setDialog({
        title, message, type, confirmLabel, cancelLabel,
        onConfirm: () => { setDialog(null); resolve(true) },
        onCancel:  () => { setDialog(null); resolve(false) },
      })
    )

  // Sessão expirada
  useEffect(() => {
    const handler = () => showAlert("Sessão Expirada", "Sua sessão expirou. Por favor, faça login novamente.", 'warning')
    window.addEventListener("sessao_expirada", handler)
    return () => window.removeEventListener("sessao_expirada", handler)
  }, [])

  // Interceptador de fechamento Tauri
  useEffect(() => {
    if (!window.__TAURI__) return
    let unlisten: () => void

    const setup = async () => {
      unlisten = await appWindow.onCloseRequested(async (event) => {
        if (isProcessing) {
          event.preventDefault()
          const confirmed = await showConfirm(
            "Processamento em Andamento",
            "Há diagnósticos sendo processados em segundo plano. Fechar o aplicativo irá interromper as análises. Deseja sair mesmo assim?",
            'warning', 'Sair mesmo assim', 'Continuar'
          )
          if (confirmed) await appWindow.close()
        }
      })
    }

    setup()
    return () => { if (unlisten) unlisten() }
  }, [isProcessing])

  const handleLogout = async () => {
    if (isProcessing) {
      const confirmed = await showConfirm(
        "Diagnósticos em Processamento",
        "Há diagnósticos em andamento. Sair da conta irá interrompê-los. Deseja continuar?",
        'warning', 'Sair mesmo assim', 'Cancelar'
      )
      if (!confirmed) return
    }
    logout()
    setMenuOpen(false)
  }

  const loadUsers = async () => {
    const u = await fetchUsuarios()
    setListaUsers(u)
  }

  const handleActionUser = async (id: number, action: "del" | "prom") => {
    if (action === "del") {
      const confirmed = await showConfirm(
        "Excluir Conta",
        "Esta ação removerá a conta permanentemente e não pode ser desfeita. Confirmar exclusão?",
        'danger', 'Sim, Excluir', 'Cancelar'
      )
      if (!confirmed) return
      await deleteUsuario(id)
      if (id === user?.id) handleLogout()
      else loadUsers()
    } else if (action === "prom") {
      await promoverUsuario(id)
      loadUsers()
    }
  }

  const handleSaveEdit = async (id: number) => {
    await editUsuario(id, editForm)
    setEditUserId(null)
    loadUsers()
  }

  const handleExecutarReset = async (id: number) => {
    if (novaSenhaAdmin.length < 6) {
      await showAlert("Senha Inválida", "A senha deve ter pelo menos 6 caracteres.", 'warning')
      return
    }
    try {
      const res = await fetch(`http://localhost:8000/api/medicos/${id}/resetar-senha-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ nova_senha: novaSenhaAdmin })
      })
      if (!res.ok) {
        const err = await res.json()
        await showAlert("Erro", err.detail || "Erro ao redefinir a senha.", 'danger')
        return
      }
      await showAlert("Senha Redefinida", "A senha foi redefinida com sucesso!", 'info')
      setResetUserId(null)
      setNovaSenhaAdmin("")
      loadUsers()
    } catch {
      await showAlert("Erro de Conexão", "Não foi possível conectar com o servidor.", 'danger')
    }
  }

  if (!isAuthenticated) return <TelaAuth onLogin={login} />

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">

      {/* Diálogo da plataforma — renderizado no topo do z-index */}
      {dialog && <PlatformDialog {...dialog} />}

      {/* Header */}
      <header className="border-b border-surface-4 bg-surface-1/80 backdrop-blur-md sticky top-0 z-40 print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-teal-accent flex items-center justify-center shadow-lg shadow-accent/25">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-white leading-none">RetAI</h1>
              <p className="text-xs text-slate-500 leading-none mt-0.5">Diagnóstico Ocular</p>
            </div>
          </div>

          <nav className="flex gap-1 bg-surface-2 p-1 rounded-xl border border-surface-4">
            <button
              onClick={() => { setTab("lista"); setRefreshKey(k => k + 1) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${tab === "lista" ? "bg-accent text-white shadow-sm shadow-accent/30" : "text-slate-400 hover:text-slate-200"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Diagnósticos
            </button>
            <button
              onClick={() => setTab("novo")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${tab === "novo" ? "bg-accent text-white shadow-sm shadow-accent/30" : "text-slate-400 hover:text-slate-200"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Realizar Diagnóstico
            </button>
          </nav>

          <div className="flex items-center gap-3 relative">

            {/* ── Nome do médico + selo ─────────────────────────────────── */}
            {user && (
              <div className="hidden sm:flex items-center gap-1.5 max-w-[160px]">
                <span className="text-sm text-slate-300 font-medium truncate leading-none">
                  {user.nome}
                </span>
                {user.verificado
                  ? <SeloVerificado size="sm" />
                  : (
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded flex-shrink-0"
                      title="Conta não verificada"
                    >
                      NV
                    </span>
                  )
                }
              </div>
            )}

            <button
              onClick={handleLogout}
              className="p-2 rounded bg-surface-2 border-surface-4 text-slate-400 hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10 transition-all duration-200"
              title="Sair do sistema"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>

            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 pr-2 pl-2 rounded bg-surface-2 border-surface-4 text-slate-400 hover:text-white transition-colors">
              •••
            </button>

            {menuOpen && (
              <div className="absolute top-10 right-0 w-48 bg-surface-2 border border-surface-4 rounded-xl shadow-2xl py-2 z-50">
                <button onClick={() => { setMenuOpen(false); setModalUsuarios(true); loadUsers() }} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-surface-3 transition-colors">
                  Usuários {user?.is_superadmin && <span className="text-accent-glow ml-1 font-bold">[Admin]</span>}
                </button>
                <button onClick={() => { setMenuOpen(false); setModalSobre(true) }} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-surface-3 transition-colors">
                  Sobre a Plataforma
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {tab === "lista" && <TelaLista refreshKey={refreshKey} currentUser={user} setIsProcessing={setIsProcessing} showAlert={showAlert} showConfirm={showConfirm} />}
        {tab === "novo"  && <TelaNovo onSuccess={() => { setTab("lista"); setRefreshKey(k => k + 1) }} onNovo={() => {}} />}
      </main>

      {/* Modal Usuários */}
      {modalUsuarios && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setModalUsuarios(false)}>
          <div className="card w-full max-w-3xl p-6 animate-slide-up">
            <h2 className="text-xl font-display font-bold text-white mb-4">Gerenciar Contas</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {listaUsers.map(u => (
                <div key={u.id} className={`p-3 rounded-lg border ${u.solicitou_reset ? 'bg-orange-500/10 border-orange-500/30' : 'bg-surface-3 border-surface-4'}`}>

                  {editUserId === u.id ? (
                    <div className="flex gap-2">
                      <input className="input-field py-1 text-sm flex-1" value={editForm.nome}  onChange={e => setEditForm({ ...editForm, nome: e.target.value })}  placeholder="Nome" />
                      <input className="input-field py-1 text-sm w-32" value={editForm.crm}   onChange={e => setEditForm({ ...editForm, crm: e.target.value })}   placeholder="CRM" />
                      <input className="input-field py-1 text-sm flex-1" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder="E-mail" />
                      <button onClick={() => handleSaveEdit(u.id)} className="btn-primary py-1 px-3 text-xs">Salvar</button>
                      <button onClick={() => setEditUserId(null)} className="btn-ghost py-1 px-3 text-xs">Cancelar</button>
                    </div>
                  ) : resetUserId === u.id ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-sm font-medium text-white flex-1">Nova Senha para {u.nome}:</span>
                      <input type="password" className="input-field py-1 text-sm flex-1" value={novaSenhaAdmin} onChange={e => setNovaSenhaAdmin(e.target.value)} placeholder="••••••••" />
                      <button onClick={() => handleExecutarReset(u.id)} className="btn-primary py-1 px-3 text-xs bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white">Salvar Senha</button>
                      <button onClick={() => { setResetUserId(null); setNovaSenhaAdmin("") }} className="btn-ghost py-1 px-3 text-xs">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-white flex items-center gap-1.5 flex-wrap">
                          {u.nome}
                          <span className="text-slate-400 font-mono text-xs">{u.crm}</span>

                          {/* ── Selos de status ──────────────────────────── */}
                          {u.verificado
                            ? <SeloVerificado size="xs" />
                            : (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                                Não Verificado
                              </span>
                            )
                          }
                          {u.is_superadmin && (
                            <span className="text-[10px] bg-accent/20 text-accent-glow px-2 py-0.5 rounded border border-accent/30">ADMIN</span>
                          )}
                          {u.solicitou_reset && (
                            <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30 animate-pulse">SOLICITOU RESET</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {user?.is_superadmin && u.solicitou_reset && (
                          <button onClick={() => setResetUserId(u.id)} className="text-orange-400 bg-orange-400/10 hover:bg-orange-400/20 text-xs px-2 py-1 rounded transition-colors font-medium border border-transparent">
                            Processar Redefinição
                          </button>
                        )}
                        {(user?.is_superadmin || u.id === user?.id) && (
                          <button onClick={() => { setEditUserId(u.id); setEditForm({ nome: u.nome, crm: u.crm, email: u.email }) }} className="text-xs text-blue-400 hover:bg-blue-400/10 px-2 py-1 rounded transition-colors">
                            Editar
                          </button>
                        )}
                        {/* Botão promover — desabilitado para não verificados */}
                        {user?.is_superadmin && !u.is_superadmin && (
                          u.verificado ? (
                            <button
                              onClick={() => setUserToPromote(u.id)}
                              className="text-xs text-emerald-400 hover:bg-emerald-400/10 px-2 py-1 rounded transition-colors"
                            >
                              Tornar Admin
                            </button>
                          ) : (
                            <span
                              className="text-xs text-slate-600 px-2 py-1 rounded cursor-not-allowed"
                              title="Médicos não verificados não podem ser promovidos"
                            >
                              Tornar Admin
                            </span>
                          )
                        )}
                        {(user?.is_superadmin || u.id === user?.id) && (
                          <button onClick={() => handleActionUser(u.id, "del")} className="text-xs text-red-400 hover:bg-red-400/10 px-2 py-1 rounded transition-colors">
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setModalUsuarios(false)} className="btn-ghost w-full mt-4">Fechar</button>
          </div>
        </div>
      )}

      {/* Modal Promover */}
      {userToPromote !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setUserToPromote(null)}>
          <div className="card w-full max-w-sm p-6 text-center animate-slide-up border border-amber-500/30">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Conceder Acesso Admin</h2>
            <div className="text-sm text-slate-400 mb-6 space-y-3 text-left">
              <p>Tem certeza que deseja promover este usuário a <strong>Superadmin</strong>?</p>
              <div className="bg-surface-3 p-3 rounded-lg border border-surface-4">
                <p className="text-xs font-semibold text-slate-300 mb-2">Este usuário terá poder para:</p>
                <ul className="list-disc pl-4 text-xs text-amber-400/80 space-y-1">
                  <li>Visualizar todos os diagnósticos da plataforma.</li>
                  <li>Editar ou excluir qualquer conta (incluindo a sua).</li>
                  <li>Conceder privilégios de Admin a outros usuários.</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setUserToPromote(null)} className="btn-ghost flex-1">Cancelar</button>
              <button
                onClick={() => { handleActionUser(userToPromote, "prom"); setUserToPromote(null) }}
                className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors"
              >
                Sim, Promover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sobre */}
      {modalSobre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setModalSobre(false)}>
          <div className="card w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4 border-b border-surface-4 pb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-teal-accent flex items-center justify-center shadow-lg">
                <span className="font-bold text-white text-xl">R</span>
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white leading-none">RetAI</h2>
                <p className="text-xs text-slate-400 mt-1">Diagnóstico Ocular v0.1</p>
              </div>
            </div>
            <div className="text-sm text-slate-400 space-y-4">
              <p>O <strong>RetAI</strong> é uma ferramenta de triagem clínica baseada em inteligência artificial.</p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-amber-400 font-medium mb-1">Aviso de Responsabilidade Legal</p>
                <p className="text-xs text-amber-500/80 leading-relaxed">
                  Os resultados apresentados por esta plataforma são estritamente sugestivos e não substituem o laudo de um médico qualificado.
                </p>
              </div>
            </div>
            <button onClick={() => setModalSobre(false)} className="btn-primary w-full mt-6">Entendi</button>
          </div>
        </div>
      )}
    </div>
  )
}