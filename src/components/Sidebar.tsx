import {
  LayoutDashboard,
  Users,
  Dog,
  FileText,
  Calendar,
  CalendarDays,
  Menu,
  Syringe,
  ScanLine,
  UsersRound,
  LogOut,
  Building2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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

const menuItems = [
  { id: 'dashboard', label: 'Painel de Controle', icon: LayoutDashboard },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'animals', label: 'Animais', icon: Dog },
  { id: 'medical-records', label: 'Prontuários', icon: FileText },
  { id: 'vaccinations', label: 'Vacinas', icon: Syringe },
  { id: 'microchips', label: 'Microchips', icon: ScanLine },
  { id: 'appointments', label: 'Agendamentos', icon: CalendarDays },
  { id: 'calendar', label: 'Calendário', icon: Calendar },
  { id: 'team', label: 'Equipe', icon: UsersRound },
];

export default function Sidebar({ currentPage, onNavigate, collapsed: collapsedDesktop, setCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, clinics, activeClinic, setActiveClinicId, signOut } = useAuth();
  const demo = isDemoUser(user);
  // A gaveta do celular sempre mostra os rótulos.
  const collapsed = collapsedDesktop && !mobileOpen;

  return (
    <>
    {mobileOpen && <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={onCloseMobile} aria-hidden="true" />}
    <div
      className={`fixed left-0 top-0 h-full bg-slate-900 text-white flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-20' : 'w-64'
      } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-lg">
              <Dog className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">VetClinic</h1>
              <p className="text-xs text-slate-400">Gestão Veterinária</p>
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsedDesktop)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="hidden lg:block p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button onClick={onCloseMobile} aria-label="Fechar menu" className="lg:hidden p-2 hover:bg-slate-800 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Clínica ativa */}
      {activeClinic && (
        <div className={`border-b border-slate-700 ${collapsed ? 'p-3 flex justify-center' : 'p-4'}`}>
          {collapsed ? (
            <span title={activeClinic.name}>
              <Building2 className="w-5 h-5 text-slate-400" />
            </span>
          ) : clinics.length > 1 ? (
            <label className="block">
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
            <div>
              <span className="text-xs text-slate-400">Clínica</span>
              <p className="text-sm font-medium truncate">{activeClinic.name}</p>
            </div>
          )}
        </div>
      )}

      {/* Menu */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                  ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }
                  ${collapsed ? 'justify-center px-0' : ''}
                  `}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5" />
                  {!collapsed && <span className="font-medium">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Usuário */}
      <div className={`border-t border-slate-700 ${collapsed ? 'p-3' : 'p-4'}`}>
        {!collapsed && (
          <div className="mb-3 min-w-0">
            <p className="text-sm truncate" title={demo ? 'Visitante da demonstração' : user?.email}>
              {demo ? 'Visitante da demonstração' : user?.email}
            </p>
            {activeClinic && <p className="text-xs text-slate-400">{clinicRoleLabels[activeClinic.role]}</p>}
          </div>
        )}
        <button
          onClick={signOut}
          title="Sair"
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="text-sm font-medium">Sair</span>}
        </button>
      </div>
    </div>
    </>
  );
}
