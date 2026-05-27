import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ModalSobre({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4 border-b border-surface-4 pb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-teal-accent flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
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