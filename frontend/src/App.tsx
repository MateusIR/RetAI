import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { appWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/tauri";
import { useAuth } from "./useAuth";
import { useDialog } from "./hooks/useDialog";

import Header from "./components/Header";
import TelaAuth from "./components/TelaAuth";
import TelaLista from "./components/TelaLista";
import TelaNovo from "./components/TelaNovo";
import ModalUsuarios from "./components/ModalUsuarios";
import ModalSobre from "./components/ModalSobre";
import Dialog from "./components/ui/Dialog";

type Tab = "lista" | "novo";

export default function App() {
  const { t } = useTranslation();
  const { token, user, login, logout, isAuthenticated } = useAuth();
  const { dialog, showAlert, showConfirm } = useDialog();

  const [tab, setTab] = useState<Tab>("lista");
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalUsuarios, setModalUsuarios] = useState(false);
  const [modalSobre, setModalSobre] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [backendReady, setBackendReady] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("http://localhost:8000/health");
        if (res.ok) setBackendReady(true);
        else setTimeout(checkHealth, 1000);
      } catch {
        setTimeout(checkHealth, 1000);
      }
    };
    checkHealth();
  }, []);

  // Manipulação de segurança de janelas para Tauri
  const isProcessingRef = useRef(isProcessing);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // PRIMEIRO useEffect: Tela de Splash
  useEffect(() => {
    if (!(window as any).__TAURI__) return;

    const checkBackend = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/docs");
        if (res.ok) {
          await invoke("close_splashscreen");
        } else {
          setTimeout(checkBackend, 1000);
        }
      } catch {
        setTimeout(checkBackend, 1000);
      }
    };

    checkBackend();
  }, []); // <--- Faltava essa linha para fechar o useEffect corretamente!

  // SEGUNDO useEffect: Prevenção de fechamento acidental
  useEffect(() => {
    if (!(window as any).__TAURI__) return;
    const unlistenPromise = appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      let shouldClose = true;
      if (isProcessingRef.current) {
        shouldClose = await showConfirm(t('app.exitAppTitle'), t('app.exitAppMessage'), 'warning', t('app.exitConfirm'), t('app.continue'));
      }
      if (shouldClose) {
        const unlistenFn = await unlistenPromise;
        unlistenFn();
        await appWindow.close();
      }
    });
    return () => { unlistenPromise.then((fn) => fn()).catch(() => {}); };
  }, []); // Mantive o array de dependências vazio aqui também

  // TERCEIRO useEffect: Logout global
  useEffect(() => {
    const handler = () => showAlert(t('app.sessionExpiredTitle'), t('app.sessionExpiredMessage'), 'warning');
    window.addEventListener("sessao_expirada", handler);
    return () => window.removeEventListener("sessao_expirada", handler);
  }, [t, showAlert]);

  const handleLogout = async () => {
    if (isProcessing) {
      const confirmed = await showConfirm(t('app.logoutConfirmTitle'), t('app.logoutWarningProcessing'), 'warning', t('app.exitConfirm'), t('app.cancel'));
      if (!confirmed) return;
    }
    logout();
  };

  if (!backendReady) {
    return (
      <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center text-primary">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <h2 className="mt-4 text-xl font-semibold">Iniciando Motor de IA...</h2>
        <p className="text-surface-600 mt-2">Isso pode levar alguns segundos na primeira inicialização.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {dialog && <Dialog {...dialog} />}

      {/* HEADER GLOBAL - Visível no Auth com estado reduzido */}
      <Header
        isAuthenticated={isAuthenticated}
        user={user}
        tab={tab}
        setTab={setTab}
        setRefreshKey={setRefreshKey}
        onLogout={handleLogout}
        onOpenUsers={() => setModalUsuarios(true)}
        onOpenAbout={() => setModalSobre(true)}
      />

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-6 py-8">
        {!isAuthenticated ? (
          <TelaAuth onLogin={login} />
        ) : (
          <>
            {tab === "lista" && <TelaLista refreshKey={refreshKey} currentUser={user} setIsProcessing={setIsProcessing} showAlert={showAlert} showConfirm={showConfirm} />}
            {tab === "novo" && <TelaNovo onSuccess={() => { setTab("lista"); setRefreshKey(k => k + 1) }} onNovo={() => {}} />}
          </>
        )}
      </main>

      {/* Modais Globais Extraídos */}
      {modalUsuarios && <ModalUsuarios onClose={() => setModalUsuarios(false)} currentUser={user} showAlert={showAlert} showConfirm={showConfirm} onSelfDelete={handleLogout} />}
      {modalSobre && <ModalSobre onClose={() => setModalSobre(false)} />}
    </div>
  );
}