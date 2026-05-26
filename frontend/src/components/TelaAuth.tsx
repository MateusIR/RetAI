import React, { useState } from "react";
import { useTranslation } from "react-i18next";
// No topo do componente, após o useTranslation()

type AuthMode = "login" | "register" | "register_unverified" | "forgot" | "admin_self_reset";

interface Props {
  onLogin: (token: string, user: any, expiresAt: number) => void;
}

const UFS_VALIDAS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", 
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

export default function TelaAuth({ onLogin }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "pt-BR" ? "pt_BR" : i18n.language;

  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [showUnverifiedWarning, setShowUnverifiedWarning] = useState(false);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");

  const [crmNumero, setCrmNumero] = useState("");
  const [crmUf, setCrmUf] = useState("");

  const formatCpf = (value: string) =>
    value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .slice(0, 14);

  const evaluateStrength = (pw: string) => {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 6) s += 1;
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) s += 1;
    if (/[^A-Za-z0-9]/.test(pw)) s += 1;
    return s;
  };

  const strength = evaluateStrength(senha);
  const strengthText =
    strength === 0 ? "" : strength === 1 ? t("app.login.passwordStrength.weak") : strength === 2 ? t("app.login.passwordStrength.medium") : t("app.login.passwordStrength.strong");
  const strengthColor =
    strength === 1 ? "bg-red-500" : strength === 2 ? "bg-amber-500" : "bg-emerald-500";

  const changeMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setSuccessMsg("");
    setSenha("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return setError(t("app.login.errors.invalidEmail"));
    }

    const crmCompleto = `${crmNumero}-${crmUf}`;

    if (mode === "register" || mode === "admin_self_reset") {
      if (cpf.length < 14) return setError(t("app.login.errors.invalidCpf"));
      if (crmNumero.length < 4 || !crmUf) return setError(t("app.login.errors.invalidCrm"));
    }
    
    if (mode === "register" || mode === "register_unverified" || mode === "admin_self_reset") {
      if (senha.length < 6) return setError(t("app.login.errors.shortPassword"));
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const formData = new URLSearchParams();
        formData.append("username", email.trim());
        formData.append("password", senha);

        const res = await fetch(`http://localhost:8000/api/auth/login?lang=${lang}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || t("app.login.errors.generic"));
        }

        const data = await res.json();
        onLogin(data.access_token, data.user, Date.now() + data.expires_in * 1000);
      } else if (mode === "register") {
        const res = await fetch(`http://localhost:8000/api/medicos/registrar?lang=${lang}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, cpf, crm: crmCompleto, email: email.trim(), senha }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || t("app.login.errors.generic"));
        }

        setSuccessMsg(t("app.login.success.registered"));
        changeMode("login");
      } else if (mode === "register_unverified") {
        const res = await fetch(`http://localhost:8000/api/medicos/registrar-nao-verificado?lang=${lang}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, email: email.trim(), senha }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || t("app.login.errors.generic"));
        }

        setSuccessMsg(t("app.login.success.unverifiedRegistered"));
        changeMode("login");
      } else if (mode === "forgot") {
        const res = await fetch(`http://localhost:8000/api/auth/solicitar-reset-local?lang=${lang}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim() }),
          });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || t("app.login.errors.generic"));

        setSuccessMsg(t("app.login.success.resetRequested"));
      } else if (mode === "admin_self_reset") {
        const res = await fetch(`http://localhost:8000/api/auth/admin-self-reset?lang=${lang}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, cpf, crm: crmCompleto, email: email.trim(), nova_senha: senha }),
          });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || t("app.login.errors.generic"));

        setSuccessMsg(t("app.login.success.adminResetDone"));
        changeMode("login");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 p-4">
      {/* Aviso Modal de Não Verificado */}
      {showUnverifiedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card w-full max-w-sm p-6 text-center animate-slide-up border border-amber-500/30">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">{t("app.login.unverifiedWarning.title")}</h2>
            <div className="text-sm text-slate-400 mb-6 text-left space-y-2">
              <p>{t("app.login.unverifiedWarning.description")}</p>
              <ul className="list-disc pl-4 text-amber-400/80 space-y-1">
                <li>{t("app.login.unverifiedWarning.item1")}</li>
                <li>{t("app.login.unverifiedWarning.item2")}</li>
                <li>{t("app.login.unverifiedWarning.item3")}</li>
                <li><strong>{t("app.login.unverifiedWarning.item4")}</strong></li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowUnverifiedWarning(false)} className="btn-ghost flex-1">{t("app.cancel")}</button>
              <button 
                onClick={() => { setShowUnverifiedWarning(false); changeMode("register_unverified"); }} 
                className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors"
              >
                {t("app.login.unverifiedRegisterButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card w-full max-w-md p-8 animate-fade-in shadow-2xl border-surface-4">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-xl bg-gradient-to-br from-accent to-teal-accent flex items-center justify-center shadow-lg shadow-accent/25 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-white">{t("app.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "login" && t("app.login.title")}
            {mode === "register" && t("app.login.registerTitle")}
            {mode === "register_unverified" && t("app.login.unverifiedTitle")}
            {mode === "forgot" && t("app.login.forgotTitle")}
            {mode === "admin_self_reset" && t("app.login.adminResetTitle")}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg mb-6 text-center animate-fade-in">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm p-3 rounded-lg mb-6 text-center animate-fade-in">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {(mode === "register" || mode === "admin_self_reset" || mode === "register_unverified") && (
            <div className="animate-slide-up space-y-4">
              {mode === "admin_self_reset" && (
                <div className="bg-surface-3 p-3 rounded border border-surface-4 text-xs text-slate-400 text-center mb-4">
                  {t("app.login.adminResetTitle")}
                </div>
              )}
              {mode === "register_unverified" && (
                <div className="bg-amber-500/10 p-3 rounded border border-amber-500/30 text-xs text-amber-400/90 text-center mb-4">
                  {t("app.login.unverifiedTitle")}
                </div>
              )}
              
              <div>
                <label className="label">{t("app.login.namePlaceholder")}</label>
                <input required type="text" className="input-field" placeholder={t("app.login.namePlaceholder")} maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>

              {(mode === "register" || mode === "admin_self_reset") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t("app.cpf")}</label>
                      <input required type="text" className="input-field font-mono text-sm" placeholder={t("app.login.cpfPlaceholder")} maxLength={14} value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} />
                    </div>

                    <div>
                      <label className="label">CRM e UF</label>
                      <div className="flex gap-2">
                        <input required type="text" className="input-field font-mono text-sm flex-1" placeholder={t("app.login.crmPlaceholder")} maxLength={10} value={crmNumero} onChange={(e) => setCrmNumero(e.target.value.replace(/\D/g, ""))} />
                        <select required className="input-field font-mono text-sm w-20 px-2 cursor-pointer" value={crmUf} onChange={(e) => setCrmUf(e.target.value)}>
                          <option value="" disabled>{t("app.login.ufPlaceholder")}</option>
                          {UFS_VALIDAS.map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
                        </select>
                      </div>
                    </div>
                  </div>
              )}
            </div>
          )}

          <div>
            <label className="label">{t("app.login.emailLabel")}</label>
            <input required type="email" className="input-field" placeholder={t("app.login.emailPlaceholder")} maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {mode !== "forgot" && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center">
                <label className="label mb-0">{mode === "admin_self_reset" ? t("app.login.newPasswordLabel") : t("app.login.passwordLabel")}</label>
                {mode === "login" && (
                  <button type="button" onClick={() => changeMode("forgot")} className="text-xs text-accent hover:text-teal-accent">{t("app.login.forgotPassword")}</button>
                )}
              </div>
              <div className="relative mt-1">
                <input required type={showPassword ? "text" : "password"} className="input-field pr-10 [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden" placeholder={t("app.login.passwordPlaceholder")} maxLength={72} value={senha} onChange={(e) => setSenha(e.target.value)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              {(mode === "register" || mode === "register_unverified" || mode === "admin_self_reset") && senha.length > 0 && (
                <div className="mt-2 flex items-center gap-2 animate-fade-in">
                  <div className="flex-1 flex gap-1 h-1.5">
                    <div className={`flex-1 rounded-full ${strength >= 1 ? strengthColor : "bg-surface-4"}`}></div>
                    <div className={`flex-1 rounded-full ${strength >= 2 ? strengthColor : "bg-surface-4"}`}></div>
                    <div className={`flex-1 rounded-full ${strength >= 3 ? strengthColor : "bg-surface-4"}`}></div>
                  </div>
                  <span className={`text-[10px] uppercase font-bold w-12 text-right ${strengthColor.replace("bg-", "text-")}`}>{strengthText}</span>
                </div>
              )}
            </div>
          )}

          <button disabled={loading} type="submit" className="btn-primary w-full mt-6 py-3 relative overflow-hidden group">
            {loading ? t("app.sending") : mode === "login" ? t("app.login.loginButton") : mode === "register" || mode === "register_unverified" ? t("app.login.registerButton") : mode === "forgot" ? t("app.login.forgotButton") : t("app.login.adminResetButton")}
          </button>

          {mode === "register" && (
            <div className="mt-4 text-center">
              <button type="button" onClick={() => setShowUnverifiedWarning(true)} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2">
                {t("app.login.unverifiedLink")}
              </button>
            </div>
          )}
        </form>

        <div className="mt-6 text-center border-t border-surface-4 pt-4 flex flex-col gap-2">
          {mode === "forgot" && (
            <button type="button" onClick={() => changeMode("admin_self_reset")} className="text-xs text-amber-500 hover:text-amber-400 font-medium block w-full text-center">
              {t("app.login.adminRecoveryLink")}
            </button>
          )}
          <p className="text-sm text-slate-500">
            {mode === "login" ? t("app.login.noAccount") : mode === "forgot" ? t("app.login.hasAccount") : t("app.login.hasAccount")}
            <button type="button" onClick={() => changeMode(mode === "login" ? "register" : "login")} className="ml-2 text-accent font-medium hover:text-teal-accent">
              {mode === "login" ? t("app.login.registerLink") : t("app.login.loginLink")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}