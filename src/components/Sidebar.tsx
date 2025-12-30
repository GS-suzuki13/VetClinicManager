import { LayoutDashboard, Users, Dog, FileText, Calendar, CalendarDays } from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'animals', label: 'Animals', icon: Dog },
  { id: 'medical-records', label: 'Medical Records', icon: FileText },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <Dog className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">VetClinic</h1>
            <p className="text-xs text-slate-400">Management System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 text-center">
          <p>© 2024 VetClinic</p>
          <p className="mt-1">All rights reserved</p>
        </div>
      </div>
    </div>
  );
}
