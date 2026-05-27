import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import SeloVerificado from './ui/SeloVerificado';

interface Props {
  isAuthenticated: boolean;
  user: any;
  tab: "lista" | "novo";
  setTab: (t: "lista" | "novo") => void;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  onLogout: () => void;
  onOpenUsers: () => void;
  onOpenAbout: () => void;
}

export default function Header({ isAuthenticated, user, tab, setTab, setRefreshKey, onLogout, onOpenUsers, onOpenAbout }: Props) {
  const { t, i18n } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLang = localStorage.getItem('lang');
    if (savedLang && savedLang !== i18n.language) i18n.changeLanguage(savedLang);
  }, []);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <header className="border-b border-surface-4 bg-surface-1/80 backdrop-blur-md sticky top-0 z-40 print:hidden">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        
        {/* Logo Otimizada */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-teal-accent flex items-center justify-center shadow-lg shadow-accent/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-white leading-none">{t('app.title')}</h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">{t('app.subtitle')}</p>
          </div>
        </div>

        {/* Abas - Visível Apenas Logado */}
        {isAuthenticated && (
          <nav className="flex gap-1 bg-surface-2 p-1 rounded-xl border border-surface-4">
            <button
              onClick={() => { setTab("lista"); setRefreshKey(k => k + 1) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${tab === "lista" ? "bg-accent text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              {t('app.tabDiagnostics')}
            </button>
            <button
              onClick={() => setTab("novo")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${tab === "novo" ? "bg-accent text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t('app.tabNewDiagnosis')}
            </button>
          </nav>
        )}

        <div className="flex items-center gap-3 relative">
          {/* Seletor de Idioma */}
          <div className="flex items-center gap-1 bg-surface-2 rounded-lg border border-surface-4 p-0.5">
            <button onClick={() => changeLanguage('pt-BR')} className={`px-2 py-1 text-xs font-medium rounded ${i18n.language === 'pt-BR' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}>PT</button>
            <button onClick={() => changeLanguage('en')} className={`px-2 py-1 text-xs font-medium rounded ${i18n.language === 'en' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'}`}>EN</button>
          </div>

          {/* Menus baseados na Autenticação */}
          {!isAuthenticated ? (
            <button onClick={onOpenAbout} className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-2 py-1">
              {t('app.about')}
            </button>
          ) : (
            <>
              {user && (
                <div className="hidden sm:flex items-center gap-1.5 max-w-[160px]">
                  <span className="text-sm text-slate-300 font-medium truncate leading-none">{user.nome}</span>
                  {user.verificado ? <SeloVerificado size="sm" /> : <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded flex-shrink-0">NV</span>}
                </div>
              )}
              <button onClick={() => { setMenuOpen(false); onLogout(); }} className="p-2 rounded bg-surface-2 border-surface-4 text-slate-400 hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10 transition-all duration-200" title={t('app.logout')}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 pr-2 pl-2 rounded bg-surface-2 border-surface-4 text-slate-400 hover:text-white transition-colors">•••</button>
                {menuOpen && (
                  <div className="absolute top-10 right-0 w-48 bg-surface-2 border border-surface-4 rounded-xl shadow-2xl py-2 z-50">
                    <button onClick={() => { setMenuOpen(false); onOpenUsers(); }} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-surface-3 transition-colors">
                      {t('app.users')} {user?.is_superadmin && <span className="text-accent-glow ml-1 font-bold">[{t('app.adminBadge')}]</span>}
                    </button>
                    <button onClick={() => { setMenuOpen(false); onOpenAbout(); }} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-surface-3 transition-colors">
                      {t('app.about')}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}