import {
  LayoutDashboard,
  Users,
  Dog,
  FileText,
  Calendar,
  CalendarDays,
  Syringe,
  ScanLine,
  UsersRound,
  LogOut,
  Building2,
  ShoppingCart,
  Wallet,
  Package,
  Landmark,
  BedDouble,
  HeartHandshake,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import HamburgerButton from './HamburgerButton';
import { clinicRoleLabels } from '../lib/supabase';
import { isDemoUser } from '../lib/demo';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  // Recolhida (só ícones) no desktop.
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  // Gaveta aberta no celular/tablet (< lg).
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

// `managers`: só proprietário/administrador (o banco também restringe).
const menuSections = [
  {
    label: 'Atendimento',
    items: [
      { id: 'dashboard', label: 'Painel de Controle', icon: LayoutDashboard },
      { id: 'appointments', label: 'Agendamentos', icon: CalendarDays },
      { id: 'calendar', label: 'Calendário', icon: Calendar },
      { id: 'hospitalization', label: 'Internação', icon: BedDouble },
    ],
  },
  {
    label: 'Pacientes',
    items: [
      { id: 'clients', label: 'Clientes', icon: Users },
      { id: 'animals', label: 'Animais', icon: Dog },
      { id: 'medical-records', label: 'Prontuários', icon: FileText },
      { id: 'vaccinations', label: 'Vacinas', icon: Syringe },
      { id: 'microchips', label: 'Microchips', icon: ScanLine },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { id: 'sales', label: 'Vendas', icon: ShoppingCart },
      { id: 'register', label: 'Caixa', icon: Wallet },
      { id: 'catalog', label: 'Produtos e estoque', icon: Package },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { id: 'relationship', label: 'Relacionamento', icon: HeartHandshake },
      { id: 'finance', label: 'Financeiro', icon: Landmark, managers: true },
      { id: 'team', label: 'Equipe', icon: UsersRound },
    ],
  },
];

// Rótulo que some com fade/encolhimento (em vez de sumir de uma vez) ao recolher.
function Label({ hidden, children, className = '' }: { hidden: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`whitespace-nowrap overflow-hidden transition-[opacity,max-width] duration-300 ease-out ${hidden ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[12rem]'} ${className}`}
    >
      {children}
    </span>
  );
}

export default function Sidebar({ currentPage, onNavigate, collapsed: collapsedDesktop, setCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, clinics, activeClinic, setActiveClinicId, signOut } = useAuth();
  const demo = isDemoUser(user);
  const isManager = activeClinic?.role === 'owner' || activeClinic?.role === 'admin';
  // A gaveta do celular sempre mostra os rótulos.
  const collapsed = collapsedDesktop && !mobileOpen;

  return (
    <>
      <div
        className={`lg:hidden fixed inset-0 z-30 bg-slate-950/50 transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        className={`fixed left-0 top-0 h-full bg-slate-900 text-white flex flex-col z-40 transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* Cabeçalho */}
        <div className={`h-[72px] border-b border-slate-700/70 flex items-center gap-2 transition-[padding] duration-300 ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          {/* Logo some (encolhe) com o menu recolhido; o hambúrguer fica no lugar. */}
          <div className={`overflow-hidden transition-[max-width,opacity] duration-300 ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[12rem] opacity-100'}`}>
            <button onClick={() => onNavigate('dashboard')} className="flex items-center gap-3 min-w-0" title="Painel de controle" tabIndex={collapsed ? -1 : 0}>
              <div className="bg-emerald-500 p-2 rounded-lg shrink-0">
                <Dog className="w-6 h-6" />
              </div>
              <span className="text-left whitespace-nowrap">
                <span className="block text-xl font-bold font-display leading-tight">VetClinic</span>
                <span className="block text-xs text-slate-400">Gestão Veterinária</span>
              </span>
            </button>
          </div>
          <HamburgerButton
            open={!collapsedDesktop}
            onClick={() => setCollapsed(!collapsedDesktop)}
            label={collapsedDesktop ? 'Expandir menu' : 'Recolher menu'}
            className="hidden lg:flex"
          />
          <HamburgerButton open={mobileOpen} onClick={onCloseMobile} label="Fechar menu" className="lg:hidden" />
        </div>

        {/* Clínica ativa */}
        {activeClinic && (
          <div className={`border-b border-slate-700/70 transition-[padding] duration-300 ${collapsed ? 'px-3 py-3 flex justify-center' : 'p-4'}`}>
            {collapsed ? (
              <span title={activeClinic.name}>
                <Building2 className="w-5 h-5 text-slate-400" />
              </span>
            ) : clinics.length > 1 ? (
              <label className="block animate-fade-in">
                <span className="text-xs text-slate-400">Clínica</span>
                <select
                  value={activeClinic.id}
                  onChange={(e) => setActiveClinicId(e.target.value)}
                  className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="animate-fade-in min-w-0">
                <span className="text-xs text-slate-400">Clínica</span>
                <p className="text-sm font-medium truncate">{activeClinic.name}</p>
              </div>
            )}
          </div>
        )}

        {/* Menu */}
        <nav className="flex-1 p-3 overflow-y-auto overflow-x-hidden no-scrollbar">
          {menuSections.map((section) => (
            <div key={section.label} className="mb-3">
              <p
                className={`px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 overflow-hidden transition-[opacity,max-height,padding] duration-300 ${
                  collapsed ? 'opacity-0 max-h-0 pb-0' : 'opacity-100 max-h-6 pb-1'
                }`}
              >
                {section.label}
              </p>
              {collapsed && <div className="mx-3 mb-2 border-t border-slate-700/70" aria-hidden="true" />}
              <ul className="space-y-1">
                {section.items
                  .filter((item) => !('managers' in item) || isManager)
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => onNavigate(item.id)}
                          title={collapsed ? item.label : undefined}
                          aria-current={isActive ? 'page' : undefined}
                          className={`group w-full flex items-center gap-3 rounded-lg py-2.5 transition-colors duration-200 ${collapsed ? 'justify-center px-0' : 'px-4'} ${
                            isActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-950/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <Icon className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                          <Label hidden={collapsed} className="font-medium">
                            {item.label}
                          </Label>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Usuário */}
        <div className={`border-t border-slate-700/70 ${collapsed ? 'p-3' : 'p-4'}`}>
          <div className={`min-w-0 overflow-hidden transition-[opacity,max-height,margin] duration-300 ${collapsed ? 'opacity-0 max-h-0 mb-0' : 'opacity-100 max-h-16 mb-3'}`}>
            <p className="text-sm truncate" title={demo ? 'Visitante da demonstração' : user?.email}>
              {demo ? 'Visitante da demonstração' : user?.email}
            </p>
            {activeClinic && <p className="text-xs text-slate-400">{clinicRoleLabels[activeClinic.role]}</p>}
          </div>
          <button
            onClick={signOut}
            title="Sair"
            className={`w-full flex items-center gap-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors ${collapsed ? 'justify-center px-0' : 'px-4'}`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <Label hidden={collapsed} className="text-sm font-medium">
              Sair
            </Label>
          </button>
        </div>
      </aside>
    </>
  );
}
