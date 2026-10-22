import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const widths = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-3xl' };

// Base de todos os modais: tela cheia no celular, centralizado a partir de `sm`,
// conteúdo rolável e fechamento por Esc ou clique fora.
export default function Modal({ title, onClose, children, size = 'lg' }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white w-full ${widths[size]} max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-xl shadow-xl`}
      >
        <div className="flex justify-between items-center gap-4 px-4 py-4 sm:px-6 border-b border-slate-200">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-800 min-w-0">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 -mr-2 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export const fieldClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100';

export const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

export function FormActions({ submitLabel, onCancel, busy }: { submitLabel: string; onCancel: () => void; busy?: boolean }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={busy}
        className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 transition-colors font-medium"
      >
        {busy ? 'Salvando...' : submitLabel}
      </button>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg p-3">
      {message}
    </div>
  );
}
