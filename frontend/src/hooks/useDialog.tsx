import { useState } from 'react';

export interface DialogState {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'danger';
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function useDialog() {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const showAlert = (title: string, message: string, type: DialogState['type'] = 'info'): Promise<void> =>
    new Promise(resolve =>
      setDialog({
        title, message, type, confirmLabel: 'Ok',
        onConfirm: () => { setDialog(null); resolve(); }
      })
    );

  const showConfirm = (
    title: string, message: string, type: DialogState['type'] = 'warning',
    confirmLabel = 'Confirmar', cancelLabel = 'Cancelar'
  ): Promise<boolean> =>
    new Promise(resolve =>
      setDialog({
        title, message, type, confirmLabel, cancelLabel,
        onConfirm: () => { setDialog(null); resolve(true); },
        onCancel: () => { setDialog(null); resolve(false); },
      })
    );

  return { dialog, setDialog, showAlert, showConfirm };
}