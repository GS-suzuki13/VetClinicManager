import { ReactNode } from 'react';
import { Menu } from 'lucide-react';

interface LayoutProps {
  title: string;
  collapsed: boolean;
  onOpenMenu: () => void;
  children: ReactNode;
}

export default function Layout({ title, collapsed, onOpenMenu, children }: LayoutProps) {
  return (
    <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
      {/* Barra superior no celular/tablet (a sidebar vira gaveta) */}
      <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 bg-slate-900 text-white px-4 py-3">
        <button onClick={onOpenMenu} aria-label="Abrir menu" className="p-2 -ml-2 hover:bg-slate-800 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-semibold truncate">{title}</span>
      </header>

      <main className="p-4 sm:p-6">
        <h1 className="hidden lg:block text-2xl font-bold text-slate-800 mb-6">{title}</h1>
        {children}
      </main>
    </div>
  );
}
