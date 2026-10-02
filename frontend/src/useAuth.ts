/**
 * useAuth — gerenciamento de sessão JWT no frontend.
 *
 * Estratégia de armazenamento:
 *   - sessionStorage: token some ao fechar a aba (sem "lembrar de mim").
 *     Troque por localStorage se quiser persistência entre abas/sessões,
 *     mas saiba que aumenta a superfície de ataque a XSS.
 *   - Em produção, prefira cookies HttpOnly + SameSite=Strict via backend.
 */

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = "http://localhost:8000";
const TOKEN_KEY = "retai_token";
const USER_KEY = "retai_user";
const EXPIRES_KEY = "retai_expires_at";

// Margem de segurança: considera expirado 60s antes do prazo real
const EXPIRY_MARGIN_MS = 60_000;

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<any | null>(() => {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(async (callApi = true) => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

    // Invalida o token no servidor (adiciona à blacklist)
    if (callApi && token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // falha silenciosa — o token expira naturalmente de qualquer forma
      }
    }

    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(EXPIRES_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  // Agenda logout automático quando o token expirar
  const scheduleAutoLogout = useCallback((expiresAt: number) => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    const msUntilExpiry = expiresAt - Date.now() - EXPIRY_MARGIN_MS;
    if (msUntilExpiry <= 0) {
      logout(false);
      return;
    }
    logoutTimerRef.current = setTimeout(() => logout(false), msUntilExpiry);
  }, [logout]);

  const login = useCallback((newToken: string, newUser: any, expiresAt: number) => {
    sessionStorage.setItem(TOKEN_KEY, newToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(newUser));
    sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));
    setToken(newToken);
    setUser(newUser);
    scheduleAutoLogout(expiresAt);
  }, [scheduleAutoLogout]);

  // Ao montar: verifica se token salvo ainda é válido e reagenda logout
  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    const expiresAt = Number(sessionStorage.getItem(EXPIRES_KEY) || "0");
    if (saved && expiresAt) {
      if (Date.now() >= expiresAt - EXPIRY_MARGIN_MS) {
        logout(false); // já expirou — limpa sem chamar API
      } else {
        scheduleAutoLogout(expiresAt);
      }
    }
    return () => { if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Helper: retorna headers de autenticação prontos para fetch */
  const authHeaders = useCallback((): HeadersInit => ({
    Authorization: `Bearer ${token ?? ""}`,
  }), [token]);

  return { token, user, login, logout, authHeaders, isAuthenticated: !!token };
}