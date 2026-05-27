import React from 'react';
import { DialogState } from '../../hooks/useDialog';

export default function Dialog({ title, message, type, confirmLabel, cancelLabel, onConfirm, onCancel }: DialogState) {
  const icons = {
    info: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    danger: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  };

  const colors = {
    info: { border: 'border-accent/30', bg: 'bg-accent/10', icon: 'text-accent-glow', btn: 'btn-primary' },
    warning: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: 'text-amber-400', btn: 'bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors' },
    danger: { border: 'border-red-500/30', bg: 'bg-red-500/10', icon: 'text-red-400', btn: 'bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg flex-1 transition-colors' },
  };

  const c = colors[type];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className={`card w-full max-w-sm p-6 text-center animate-slide-up border ${c.border}`}>
        <div className={`w-16 h-16 rounded-full ${c.bg} border ${c.border} flex items-center justify-center mx-auto mb-4 ${c.icon}`}>
          {icons[type]}
        </div>
        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          {cancelLabel && onCancel && (
            <button onClick={onCancel} className="btn-ghost flex-1">{cancelLabel}</button>
          )}
          <button onClick={onConfirm} className={cancelLabel ? c.btn : `${c.btn} w-full`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}