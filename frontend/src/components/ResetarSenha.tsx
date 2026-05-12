import React, { useState, useEffect } from "react";

export default function ResetarSenha() {
  const [token, setToken] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Pega o token da URL da forma padrão
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
    } else {
      setError("Token de recuperação não encontrado na URL.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (novaSenha !== confirmarSenha) {
      return setError("As senhas não coincidem.");
    }
    if (novaSenha.length < 6) {
      return setError("A senha deve ter pelo menos 6 caracteres.");
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/auth/resetar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nova_senha: novaSenha }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Erro de rede ao redefinir a senha.");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0 p-4">
        <div className="card w-full max-w-md p-8 animate-slide-up text-center border-surface-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Senha Atualizada!</h2>
          <p className="text-slate-400 text-sm mb-6">Sua senha foi redefinida com sucesso. Você já pode acessar a plataforma RetAI.</p>
          <a href="/" className="btn-primary inline-block w-full py-3">Ir para o Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 p-4">
      <div className="card w-full max-w-md p-8 animate-fade-in shadow-2xl border-surface-4">
        <h2 className="text-xl font-bold text-white mb-2 text-center">Criar Nova Senha</h2>
        <p className="text-sm text-slate-400 text-center mb-6">Insira e confirme a sua nova credencial de acesso.</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nova Senha</label>
            <input
              required
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              disabled={!token}
            />
          </div>
          <div>
            <label className="label">Confirmar Senha</label>
            <input
              required
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              disabled={!token}
            />
          </div>

          <button disabled={loading || !token} type="submit" className="btn-primary w-full mt-6 py-3">
            {loading ? "Salvando..." : "Redefinir Senha"}
          </button>
        </form>
      </div>
    </div>
  );
}