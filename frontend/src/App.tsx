import React, { useState, useEffect } from "react";
import { appWindow } from "@tauri-apps/api/window";
import { confirm as tauriConfirm } from "@tauri-apps/api/dialog";

declare global {
  interface Window {
    __TAURI__?: any;
  }
}
import TelaLista from "./components/TelaLista";
import TelaNovo from "./components/TelaNovo";
import TelaAuth from "./components/TelaAuth";
import { useAuth } from "./useAuth";
import { fetchUsuarios, deleteUsuario, promoverUsuario, editUsuario, Usuario } from "./api";

type Tab = "lista" | "novo";

export default function App() {
  const { token, user, login, logout, isAuthenticated } = useAuth();

  const [tab, setTab] = useState<Tab>("lista");
  const [refreshKey, setRefreshKey] = useState(0);

  const [menuOpen, setMenuOpen] = useState(false);
  const [modalUsuarios, setModalUsuarios] = useState(false);
  const [modalSobre, setModalSobre] = useState(false);
  
  const [userToPromote, setUserToPromote] = useState<number | null>(null);

  const [listaUsers, setListaUsers] = useState<Usuario[]>([]);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", crm: "", email: "" });

  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [novaSenhaAdmin, setNovaSenhaAdmin] = useState("");

  // NOVO: Estado global para rastrear processamento
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const handleSessaoExpirada = () => {
      alert("Sua sessão expirou. Por favor, faça login novamente.");
    };
    window.addEventListener("sessao_expirada", handleSessaoExpirada);
    return () => window.removeEventListener("sessao_expirada", handleSessaoExpirada);
  }, []);


  
  // NOVO: Interceptador de fechamento da Janela (Tauri)
  useEffect(() => {
    // Evita erro caso rode no navegador durante o desenvolvimento
    if (!window.__TAURI__) return;

    let unlisten: () => void;

    const setupCloseListener = async () => {
      unlisten = await appWindow.onCloseRequested(async (event) => {
        if (isProcessing) {
          event.preventDefault(); // Impede o fechamento imediato do app
          
          const confirmed = await tauriConfirm(
            "Há diagnósticos sendo processados em segundo plano. Fechar o aplicativo irá interromper as análises. Deseja sair mesmo assim?",
            { title: "Atenção: Processamento em andamento", type: "warning" }
          );

          if (confirmed) {
            await appWindow.close(); // Força o fechamento se o usuário aceitar
          }
        }
      });
    };

    setupCloseListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [isProcessing]);

  // ALTERADO: Interceptador de Logout
  const handleLogout = async () => {
    if (isProcessing) {
      // Se estiver rodando no Tauri, usa a caixa nativa, senão usa o window.confirm padrão
      const confirmFunc = window.__TAURI__ ? tauriConfirm : window.confirm;
      
      const confirmed = await confirmFunc(
        "Há diagnósticos em processamento. Sair da conta irá interrompê-los. Deseja sair mesmo assim?",
        window.__TAURI__ ? { title: "Aviso", type: "warning" } : undefined
      );

      if (!confirmed) return; // Aborta o logout
    }

    logout();
    setMenuOpen(false);
  };

  const loadUsers = async () => {
    const u = await fetchUsuarios();
    setListaUsers(u);
  };

  const handleActionUser = async (id: number, action: "del" | "prom") => {
    if (action === "del" && confirm("Excluir conta definitivamente?")) {
      await deleteUsuario(id);
      if (id === user?.id) handleLogout();
      else loadUsers();
    } else if (action === "prom") {
      await promoverUsuario(id);
      loadUsers();
    }
  };

  const handleSaveEdit = async (id: number) => {
    await editUsuario(id, editForm);
    setEditUserId(null);
    loadUsers();
  };

  const handleExecutarReset = async (id: number) => {
    if (novaSenhaAdmin.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/medicos/${id}/resetar-senha-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ nova_senha: novaSenhaAdmin })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Erro ao redefinir a senha");
        return;
      }
      alert("Senha redefinida com sucesso!");
      setResetUserId(null);
      setNovaSenhaAdmin("");
      loadUsers();
    } catch (e) {
      alert("Erro de conexão.");
    }
  };

  if (!isAuthenticated) return <TelaAuth onLogin={login} />;

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
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
            <button onClick={() => { setTab("lista"); setRefreshKey((k) => k + 1); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${tab === "lista" ? "bg-accent text-white shadow-sm shadow-accent/30" : "text-slate-400 hover:text-slate-200"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Diagnósticos
            </button>
            <button onClick={() => setTab("novo")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${tab === "novo" ? "bg-accent text-white shadow-sm shadow-accent/30" : "text-slate-400 hover:text-slate-200"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Realizar Diagnóstico
            </button>
          </nav>

          <div className="flex items-center gap-4 relative">
            <span className="text-xs font-mono text-slate-600 hidden sm:inline">MVP v0.1</span>
            <button onClick={handleLogout} className="group relative p-2 rounded bg-surface-2 border-surface-4 text-slate-400 hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10 transition-all duration-200" title="Sair do sistema">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 pr-2 pl-2 rounded bg-surface-2 border-surface-4 text-slate-400 hover:text-white transition-colors">
              •••
            </button>

            {menuOpen && (
              <div className="absolute top-10 right-0 w-48 bg-surface-2 border border-surface-4 rounded-xl shadow-2xl py-2 z-50">
                <button onClick={() => { setMenuOpen(false); setModalUsuarios(true); loadUsers(); }} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-surface-3 transition-colors">
                  Usuários {user?.is_superadmin && <span className="text-accent-glow ml-1 font-bold">(Admin)</span>}
                </button>
                <button onClick={() => { setMenuOpen(false); setModalSobre(true); }} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-surface-3 transition-colors">
                  Sobre a Plataforma
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {/* Passamos o setIsProcessing para a tela lista poder manipular o estado do App */}
        {tab === "lista" && <TelaLista refreshKey={refreshKey} currentUser={user} setIsProcessing={setIsProcessing} />}
        {tab === "novo" && <TelaNovo onSuccess={() => { setTab("lista"); setRefreshKey((k) => k + 1); }} onNovo={() => {}} />}
      </main>

      {modalUsuarios && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setModalUsuarios(false)}>
          <div className="card w-full max-w-3xl p-6 animate-slide-up">
            <h2 className="text-xl font-display font-bold text-white mb-4">Gerenciar Contas</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {listaUsers.map((u) => (
                <div key={u.id} className={`p-3 rounded-lg border ${u.solicitou_reset ? 'bg-orange-500/10 border-orange-500/30' : 'bg-surface-3 border-surface-4'}`}>
                  
                  {editUserId === u.id ? (
                    <div className="flex gap-2">
                      <input className="input-field py-1 text-sm flex-1" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} placeholder="Nome" />
                      <input className="input-field py-1 text-sm w-32" value={editForm.crm} onChange={(e) => setEditForm({ ...editForm, crm: e.target.value })} placeholder="CRM" />
                      <input className="input-field py-1 text-sm flex-1" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="E-mail" />
                      <button onClick={() => handleSaveEdit(u.id)} className="btn-primary py-1 px-3 text-xs">Salvar</button>
                      <button onClick={() => setEditUserId(null)} className="btn-ghost py-1 px-3 text-xs">Cancelar</button>
                    </div>
                  ) : 
                  
                  resetUserId === u.id ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-sm font-medium text-white flex-1">Nova Senha para {u.nome}:</span>
                      <input type="password" className="input-field py-1 text-sm flex-1" value={novaSenhaAdmin} onChange={(e) => setNovaSenhaAdmin(e.target.value)} placeholder="••••••••" />
                      <button onClick={() => handleExecutarReset(u.id)} className="btn-primary py-1 px-3 text-xs bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white">Salvar Senha</button>
                      <button onClick={() => { setResetUserId(null); setNovaSenhaAdmin(""); }} className="btn-ghost py-1 px-3 text-xs">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {u.nome} <span className="text-slate-400 font-mono text-xs ml-2">{u.crm}</span>
                          {u.is_superadmin && <span className="text-[10px] bg-accent/20 text-accent-glow px-2 py-0.5 rounded ml-2 border border-accent/30">ADMIN</span>}
                          {u.solicitou_reset && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded ml-2 border border-orange-500/30 animate-pulse">SOLICITOU RESET</span>}
                        </p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                      
                      <div className="flex gap-2 flex-wrap justify-end">
                        {user?.is_superadmin && (
                          <button onClick={() => setResetUserId(u.id)} className={`${u.solicitou_reset ? 'text-orange-400 bg-orange-400/10 hover:bg-orange-400/20' : 'text-amber-400 hover:bg-amber-400/10'} text-xs px-2 py-1 rounded transition-colors font-medium border border-transparent`}>
                            {u.solicitou_reset ? 'Processar Redefinição' : 'Redefinir Senha'}
                          </button>
                        )}
                        {(user?.is_superadmin || u.id === user?.id) && (
                          <button onClick={() => { setEditUserId(u.id); setEditForm({ nome: u.nome, crm: u.crm, email: u.email }); }} className="text-xs text-blue-400 hover:bg-blue-400/10 px-2 py-1 rounded transition-colors">
                            Editar
                          </button>
                        )}
                        {user?.is_superadmin && !u.is_superadmin && (
                          <button onClick={() => setUserToPromote(u.id)} className="text-xs text-emerald-400 hover:bg-emerald-400/10 px-2 py-1 rounded transition-colors">
                            Tornar Admin
                          </button>
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

      {userToPromote !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setUserToPromote(null)}>
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
                onClick={() => { handleActionUser(userToPromote, "prom"); setUserToPromote(null); }}
                className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors"
              >
                Sim, Promover
              </button>
            </div>
          </div>
        </div>
      )}

      {modalSobre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setModalSobre(false)}>
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
                <p className="text-amber-400 font-medium mb-1 flex items-center gap-2">Aviso de Responsabilidade Legal</p>
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
  );
}