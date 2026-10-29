import { ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';

interface PageToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  actionLabel: string;
  onAction: () => void;
  children?: ReactNode;
}

// Busca + filtros + botão principal. Empilha no celular, linha única a partir de `sm`.
export default function PageToolbar({ search, onSearch, placeholder, actionLabel, onAction, children }: PageToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-6">
      <div className="relative flex-1 sm:min-w-[14rem] sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="search"
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      {children}
      <button
        onClick={onAction}
        className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium whitespace-nowrap"
      >
        <Plus className="w-5 h-5" />
        {actionLabel}
      </button>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
    </div>
  );
}

export const thClass = 'px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider';
export const tdClass = 'px-4 sm:px-6 py-4 text-sm';

export function IconButton({
  onClick,
  title,
  tone,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  tone: 'blue' | 'red';
  children: ReactNode;
}) {
  const tones = { blue: 'text-blue-600 hover:bg-blue-50', red: 'text-red-600 hover:bg-red-50' };
  return (
    <button onClick={onClick} title={title} aria-label={title} className={`p-2 rounded-lg transition-colors ${tones[tone]}`}>
      {children}
    </button>
  );
}
