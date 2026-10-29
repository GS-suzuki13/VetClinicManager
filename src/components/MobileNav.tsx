import { CalendarDays, Dog, LayoutDashboard, Menu, ShoppingCart } from 'lucide-react';

// Barra inferior no celular/tablet: as telas mais usadas a um toque, com o
// polegar (o menu completo continua na gaveta).
const items = [
  { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
  { id: 'appointments', label: 'Agenda', icon: CalendarDays },
  { id: 'animals', label: 'Animais', icon: Dog },
  { id: 'sales', label: 'Vendas', icon: ShoppingCart },
];

export default function MobileNav({ currentPage, onNavigate, onOpenMenu }: { currentPage: string; onNavigate: (page: string) => void; onOpenMenu: () => void }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)]" aria-label="Navegação rápida">
      <ul className="grid grid-cols-5">
        {items.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          return (
            <li key={id}>
              <button
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative w-full flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${active ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <span className={`absolute top-0 h-0.5 w-8 rounded-full bg-emerald-500 transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`} />
                <Icon className={`w-5 h-5 transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
                {label}
              </button>
            </li>
          );
        })}
        <li>
          <button onClick={onOpenMenu} className="w-full flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500 hover:text-slate-800">
            <Menu className="w-5 h-5" />
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}
