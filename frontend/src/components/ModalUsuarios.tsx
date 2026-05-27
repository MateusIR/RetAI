import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchUsuarios, editUsuario, deleteUsuario, promoverUsuario, Usuario } from '../api';
import SeloVerificado from './ui/SeloVerificado';

interface Props {
  onClose: () => void;
  currentUser: any;
  showAlert: (title: string, message: string, type?: 'info' | 'warning' | 'danger') => Promise<void>;
  showConfirm: (title: string, message: string, type?: 'info' | 'warning' | 'danger') => Promise<boolean>;
  onSelfDelete: () => void;
}

export default function ModalUsuarios({ onClose, currentUser, showAlert, showConfirm, onSelfDelete }: Props) {
  const { t } = useTranslation();
  const [listaUsers, setListaUsers] = useState<Usuario[]>([]);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", crm: "", email: "" });
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [novaSenhaAdmin, setNovaSenhaAdmin] = useState("");
  const [userToPromote, setUserToPromote] = useState<number | null>(null);

  const loadUsers = async () => {
    const u = await fetchUsuarios();
    setListaUsers(u);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleActionUser = async (id: number, action: "del" | "prom") => {
    if (action === "del") {
      const confirmed = await showConfirm(t('app.userManagement.confirmDeleteTitle'), t('app.userManagement.confirmDeleteMessage'), 'danger');
      if (!confirmed) return;
      await deleteUsuario(id);
      if (id === currentUser?.id) onSelfDelete();
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
      await showAlert(t('app.login.errors.shortPassword'), t('app.login.errors.shortPassword'), 'warning');
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/medicos/${id}/resetar-senha-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem('retai_token')}`
        },
        body: JSON.stringify({ nova_senha: novaSenhaAdmin })
      });
      if (!res.ok) {
        const err = await res.json();
        await showAlert(t('app.error'), err.detail || "Erro ao redefinir a senha.", 'danger');
        return;
      }
      await showAlert(t('app.error'), t('app.login.success.adminResetDone'), 'info');
      setResetUserId(null);
      setNovaSenhaAdmin("");
      loadUsers();
    } catch {
      await showAlert(t('app.error'), "Não foi possível conectar com o servidor.", 'danger');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-3xl p-6 animate-slide-up">
        <h2 className="text-xl font-display font-bold text-white mb-4">{t('app.userManagement.title')}</h2>
        
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {listaUsers.map(u => (
            <div key={u.id} className={`p-3 rounded-lg border ${u.solicitou_reset ? 'bg-orange-500/10 border-orange-500/30' : 'bg-surface-3 border-surface-4'}`}>
              {editUserId === u.id ? (
                <div className="flex gap-2">
                  <input className="input-field py-1 text-sm flex-1" value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} placeholder={t('app.name')} />
                  <input className="input-field py-1 text-sm w-32" value={editForm.crm} onChange={e => setEditForm({ ...editForm, crm: e.target.value })} placeholder="CRM" />
                  <input className="input-field py-1 text-sm flex-1" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder="E-mail" />
                  <button onClick={() => handleSaveEdit(u.id)} className="btn-primary py-1 px-3 text-xs">{t('app.userManagement.saveEdit')}</button>
                  <button onClick={() => setEditUserId(null)} className="btn-ghost py-1 px-3 text-xs">{t('app.userManagement.cancelEdit')}</button>
                </div>
              ) : resetUserId === u.id ? (
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-medium text-white flex-1">{t('app.userManagement.newPasswordFor', { name: u.nome })}</span>
                  <input type="password" className="input-field py-1 text-sm flex-1" value={novaSenhaAdmin} onChange={e => setNovaSenhaAdmin(e.target.value)} placeholder={t('app.userManagement.passwordPlaceholder')} />
                  <button onClick={() => handleExecutarReset(u.id)} className="btn-primary py-1 px-3 text-xs bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white">{t('app.userManagement.savePassword')}</button>
                  <button onClick={() => { setResetUserId(null); setNovaSenhaAdmin("") }} className="btn-ghost py-1 px-3 text-xs">{t('app.userManagement.cancelReset')}</button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-white flex items-center gap-1.5 flex-wrap">
                      {u.nome}
                      <span className="text-slate-400 font-mono text-xs">{u.crm}</span>
                      {u.verificado ? <SeloVerificado size="xs" /> : <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">{t('app.unverified')}</span>}
                      {u.is_superadmin && <span className="text-[10px] bg-accent/20 text-accent-glow px-2 py-0.5 rounded border border-accent/30">{t('app.adminBadge')}</span>}
                      {u.solicitou_reset && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30 animate-pulse">{t('app.solicitedReset')}</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {currentUser?.is_superadmin && u.solicitou_reset && (
                      <button onClick={() => setResetUserId(u.id)} className="text-orange-400 bg-orange-400/10 hover:bg-orange-400/20 text-xs px-2 py-1 rounded transition-colors font-medium border border-transparent">
                        {t('app.userManagement.resetPassword')}
                      </button>
                    )}
                    {(currentUser?.is_superadmin || u.id === currentUser?.id) && (
                      <button onClick={() => { setEditUserId(u.id); setEditForm({ nome: u.nome, crm: u.crm, email: u.email }) }} className="text-xs text-blue-400 hover:bg-blue-400/10 px-2 py-1 rounded transition-colors">
                        {t('app.userManagement.editUser')}
                      </button>
                    )}
                    {currentUser?.is_superadmin && !u.is_superadmin && (
                      u.verificado ? (
                        <button onClick={() => setUserToPromote(u.id)} className="text-xs text-emerald-400 hover:bg-emerald-400/10 px-2 py-1 rounded transition-colors">
                          {t('app.userManagement.promoteUser')}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600 px-2 py-1 rounded cursor-not-allowed" title={t('app.userManagement.notVerifiedCannotPromote')}>
                          {t('app.userManagement.promoteUser')}
                        </span>
                      )
                    )}
                    {(currentUser?.is_superadmin || u.id === currentUser?.id) && (
                      <button onClick={() => handleActionUser(u.id, "del")} className="text-xs text-red-400 hover:bg-red-400/10 px-2 py-1 rounded transition-colors">
                        {t('app.userManagement.deleteUser')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={onClose} className="btn-ghost w-full mt-4">{t('app.close')}</button>
      </div>

      {/* Modal Interno de Promover */}
      {userToPromote !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setUserToPromote(null)}>
          <div className="card w-full max-w-sm p-6 text-center animate-slide-up border border-amber-500/30">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('app.userManagement.promoteTitle')}</h2>
            <div className="text-sm text-slate-400 mb-6 space-y-3 text-left">
              <p>{t('app.userManagement.promoteMessage')}</p>
              <div className="bg-surface-3 p-3 rounded-lg border border-surface-4">
                <p className="text-xs font-semibold text-slate-300 mb-2">{t('app.userManagement.promoteDetails')}</p>
                <ul className="list-disc pl-4 text-xs text-amber-400/80 space-y-1">
                  <li>{t('app.userManagement.promoteItem1')}</li>
                  <li>{t('app.userManagement.promoteItem2')}</li>
                  <li>{t('app.userManagement.promoteItem3')}</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setUserToPromote(null)} className="btn-ghost flex-1">{t('app.userManagement.cancelPromote')}</button>
              <button onClick={() => { handleActionUser(userToPromote, "prom"); setUserToPromote(null) }} className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors">
                {t('app.userManagement.promoteConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}