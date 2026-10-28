import { ReactNode } from 'react';
import { Menu, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isDemoUser } from '../lib/demo';

interface LayoutProps {
  title: string;
  collapsed: boolean;
  onOpenMenu: () => void;
  children: ReactNode;
}

export default function Layout({ title, collapsed, onOpenMenu, children }: LayoutProps) {
  const { user, signOut } = useAuth();

  return (
    <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
      {/* Barra superior no celular/tablet (a sidebar vira gaveta) */}
      <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 bg-slate-900 text-white px-4 py-3">
        <button onClick={onOpenMenu} aria-label="Abrir menu" className="p-2 -ml-2 hover:bg-slate-800 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-semibold truncate">{title}</span>
      </header>

      {isDemoUser(user) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 sm:px-6">
          <p className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              <strong>Modo demonstração:</strong> dados fictícios, visíveis só para você. Fique à vontade para criar, editar e excluir.
            </span>
          </p>
          <button onClick={signOut} className="font-medium text-emerald-700 hover:underline">
            Sair da demonstração
          </button>
        </div>
      )}

      <main className="p-4 sm:p-6">
        <h1 className="hidden lg:block text-2xl font-bold text-slate-800 mb-6">{title}</h1>
        {children}
      </main>
    </div>
  );
}
