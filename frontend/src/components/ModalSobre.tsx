import React from 'react';
import { useTranslation } from 'react-i18next';
import logoApp from '../assets/logo.png';

export default function ModalSobre({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4 border-b border-surface-4 pb-4">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="absolute inset-0 bg-accent/40 blur-lg rounded-full"></div>
            <img src={logoApp} alt="Logo" className="relative w-9 h-9 object-contain drop-shadow-md z-10" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-white leading-none">{t('app.aboutModal.title')}</h2>
            <p className="text-xs text-slate-400 mt-1">{t('app.aboutModal.version')}</p>
          </div>
        </div>
        <div className="text-sm text-slate-400 space-y-4">
          <p>{t('app.aboutModal.description')}</p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-amber-400 font-medium mb-1">{t('app.aboutModal.legalWarningTitle')}</p>
            <p className="text-xs text-amber-500/80 leading-relaxed">
              {t('app.aboutModal.legalWarningText')}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="btn-primary w-full mt-6">{t('app.aboutModal.okButton')}</button>
      </div>
    </div>
  );
}