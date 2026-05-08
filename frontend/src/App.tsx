import React, { useState, useEffect } from 'react' // Adicione o useEffect aqui!
import TelaLista from './components/TelaLista'
import TelaNovo from './components/TelaNovo'
import TelaAuth from './components/TelaAuth'

type Tab = 'lista' | 'novo'

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('reta_auth_token'))
  const [tab, setTab] = useState<Tab>('lista')
  const [refreshKey, setRefreshKey] = useState(0)

  // ── Escuta o evento global de logout ──────────────────────────────
  useEffect(() => {
    const handleSessaoExpirada = () => {
      setToken(null) // Chuta o usuário para a tela de login
      alert("Sua sessão expirou. Por favor, faça login novamente."); // Opcional
    }
    
    window.addEventListener('sessao_expirada', handleSessaoExpirada)
    return () => window.removeEventListener('sessao_expirada', handleSessaoExpirada)
  }, [])
  // ──────────────────────────────────────────────────────────────────

  const handleLogin = (newToken: string) => {
    localStorage.setItem('reta_auth_token', newToken)
    setToken(newToken)
  }

  const handleLogout = () => {
    localStorage.removeItem('reta_auth_token')
    setToken(null)
  }

  const irParaLista = () => {
    setRefreshKey(k => k + 1)
    setTab('lista')
  }

  // Redirecionamento bloqueado e absoluto
  if (!token) {
    return <TelaAuth onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Header */}
      <header className="border-b border-surface-4 bg-surface-1/80 backdrop-blur-md sticky top-0 z-40 print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
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

          {/* Tabs */}
          <nav className="flex gap-1 bg-surface-2 p-1 rounded-xl border border-surface-4">
            <button
              onClick={() => setTab('lista')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                ${tab === 'lista'
                  ? 'bg-accent text-white shadow-sm shadow-accent/30'
                  : 'text-slate-400 hover:text-slate-200'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Diagnósticos
            </button>
            <button
              onClick={() => setTab('novo')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                ${tab === 'novo'
                  ? 'bg-accent text-white shadow-sm shadow-accent/30'
                  : 'text-slate-400 hover:text-slate-200'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Realizar Diagnóstico
            </button>
          </nav>

          {/* Ações (Sair e Versão) */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-slate-600 hidden sm:inline">MVP v0.1</span>
            <button 
              onClick={handleLogout}
              className="text-sm font-medium text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1.5"
              title="Sair do sistema"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {tab === 'lista' && <TelaLista refreshKey={refreshKey} />}
        {tab === 'novo' && (
          <TelaNovo
            onSuccess={irParaLista}
            onNovo={() => {/* já reseta internamente */}}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-4/50 py-3 px-6 print:hidden">
        <p className="text-xs text-slate-600 text-center">
          RetAI — Uso restrito a profissionais habilitados. Resultados são sugestivos e não substituem avaliação clínica.
        </p>
      </footer>
    </div>
  )
}