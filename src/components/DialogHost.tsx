import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { DialogRequest, Toast, registerDialogHost } from '../lib/dialogs';
import Modal, { fieldClass } from './Modal';

// Diálogos de confirmação/pergunta e avisos (toasts) do sistema inteiro.
export default function DialogHost() {
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(
    () =>
      registerDialogHost(
        (request) => {
          setValue('');
          setDialog(request);
        },
        (toast) => {
          setToasts((prev) => [...prev.slice(-3), toast]);
          window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), toast.tone === 'error' ? 6000 : 3500);
        }
      ),
    []
  );

  const close = (result: boolean) => {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(result);
    else dialog.resolve(result ? value.trim() : null);
    setDialog(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dialog?.kind === 'prompt' && dialog.required && !value.trim()) return;
    close(true);
  };

  const toneStyle = {
    success: { icon: CheckCircle2, className: 'border-emerald-200 bg-white text-slate-800', iconClass: 'text-emerald-600' },
    error: { icon: XCircle, className: 'border-red-200 bg-white text-slate-800', iconClass: 'text-red-600' },
    info: { icon: Info, className: 'border-blue-200 bg-white text-slate-800', iconClass: 'text-blue-600' },
  };

  return (
    <>
      {dialog && (
        <Modal title={dialog.title ?? (dialog.kind === 'confirm' ? 'Confirmar' : 'Informe')} onClose={() => close(false)} size="md">
          <form onSubmit={submit} className="p-4 sm:p-6 space-y-4">
            <div className="flex gap-3">
              {dialog.danger && (
                <div className="shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              )}
              <p className="text-slate-700 whitespace-pre-line pt-2">{dialog.message}</p>
            </div>
            {dialog.kind === 'prompt' &&
              (dialog.multiline ? (
                <textarea autoFocus rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder={dialog.placeholder} maxLength={2000} className={fieldClass} />
              ) : (
                <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={dialog.placeholder} maxLength={500} className={fieldClass} />
              ))}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <button type="button" onClick={() => close(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium">
                Voltar
              </button>
              <button
                type="submit"
                autoFocus={dialog.kind === 'confirm'}
                disabled={dialog.kind === 'prompt' && dialog.required && !value.trim()}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 ${dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-500 hover:bg-emerald-600'}`}
              >
                {dialog.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div aria-live="polite" className="fixed z-[60] bottom-20 lg:bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 flex flex-col items-stretch sm:items-end gap-2 pointer-events-none">
        {toasts.map((t) => {
          const { icon: Icon, className, iconClass } = toneStyle[t.tone];
          return (
            <div key={t.id} role="status" className={`pointer-events-auto flex items-start gap-3 w-full sm:w-96 rounded-xl border shadow-lg px-4 py-3 text-sm animate-toast-in ${className}`}>
              <Icon className={`w-5 h-5 shrink-0 ${iconClass}`} />
              <p className="flex-1">{t.message}</p>
              <button aria-label="Fechar aviso" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
