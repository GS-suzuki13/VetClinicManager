import { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import HamburgerButton from './HamburgerButton';
import { useAuth } from '../context/AuthContext';
import { isDemoUser } from '../lib/demo';

interface LayoutProps {
  title: string;
  collapsed: boolean;
  onOpenMenu: () => void;
  // Gaveta do celular aberta (o hambúrguer vira X).
  menuOpen?: boolean;
  search?: ReactNode;
  children: ReactNode;
}

export default function Layout({ title, collapsed, onOpenMenu, menuOpen = false, search, children }: LayoutProps) {
  const { user, signOut } = useAuth();

  return (
    <div className={`min-w-0 transition-[margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${collapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
      {/* Barra superior no celular/tablet (a sidebar vira gaveta) */}
      <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <HamburgerButton open={menuOpen} onClick={onOpenMenu} label="Abrir menu" className="-ml-2" />
        <span className="font-semibold font-display truncate">{title}</span>
      </header>

      {isDemoUser(user) && (
        <div className="flex items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-2 sm:py-2.5 text-sm text-emerald-900 sm:px-6">
          <p className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="truncate sm:whitespace-normal">
              <strong>Modo demonstração</strong>
              <span className="hidden sm:inline">: dados fictícios, visíveis só para você. Fique à vontade para criar, editar e excluir.</span>
              <span className="sm:hidden"> • dados fictícios</span>
            </span>
          </p>
          <button onClick={signOut} className="font-medium text-emerald-700 hover:underline whitespace-nowrap shrink-0">
            Sair<span className="hidden sm:inline"> da demonstração</span>
          </button>
        </div>
      )}

      <main className="p-4 sm:p-6 pb-24 lg:pb-6 max-w-[1600px]">
        <div className="flex items-center justify-between gap-4 mb-4 lg:mb-6">
          <h1 className="hidden lg:block text-2xl font-bold text-slate-800">{title}</h1>
          {search}
        </div>
        {children}
      </main>
    </div>
  );
}
