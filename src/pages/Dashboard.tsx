import { useCallback, useEffect, useState } from 'react';
import { Users, Dog, FileText, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { todayISO } from '../lib/format';
import { useAppointmentsModal } from '../context/AppointmentsModalContext';
import { useClientsModal } from '../context/ClientsModalContext';
import { useAnimalsModal } from '../context/AnimalsModalContext';
import CalendarPreview from '../components/CalendarPreview';
import AppointmentDetailsModal, { AppointmentWithDetails } from '../components/AppointmentDetailsModal';
import { PageLoader } from '../components/PageToolbar';

interface Stats {
  totalClients: number;
  totalAnimals: number;
  totalRecords: number;
  upcomingAppointments: number;
}

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [statusVersion, setStatusVersion] = useState(0);

  const clientsModal = useClientsModal();
  const animalsModal = useAnimalsModal();
  const appointmentsModal = useAppointmentsModal();
  const refreshKey = clientsModal.savedVersion + animalsModal.savedVersion + appointmentsModal.savedVersion + statusVersion;

  const loadStats = useCallback(async () => {
    const count = { count: 'exact', head: true } as const;
    const [clientsRes, animalsRes, recordsRes, appointmentsRes] = await Promise.all([
      supabase.from('clients').select('*', count),
      supabase.from('animals').select('*', count),
      supabase.from('medical_records').select('*', count),
      supabase.from('appointments').select('*', count).eq('status', 'Scheduled').gte('appointment_date', todayISO()),
    ]);

    setStats({
      totalClients: clientsRes.count ?? 0,
      totalAnimals: animalsRes.count ?? 0,
      totalRecords: recordsRes.count ?? 0,
      upcomingAppointments: appointmentsRes.count ?? 0,
    });
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

  if (!stats) return <PageLoader />;

  const cards = [
    { title: 'Total de Clientes', value: stats.totalClients, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50', page: 'clients' },
    { title: 'Total de Animais', value: stats.totalAnimals, icon: Dog, color: 'text-emerald-500', bg: 'bg-emerald-50', page: 'animals' },
    { title: 'Registros Médicos', value: stats.totalRecords, icon: FileText, color: 'text-purple-500', bg: 'bg-purple-50', page: 'medical-records' },
    { title: 'Consultas Futuras', value: stats.upcomingAppointments, icon: Calendar, color: 'text-orange-500', bg: 'bg-orange-50', page: 'appointments' },
  ];

  const quickActions = [
    { label: 'Adicionar Cliente', onClick: () => clientsModal.openModal(), className: 'bg-emerald-500 hover:bg-emerald-600' },
    { label: 'Adicionar Animal', onClick: () => animalsModal.openModal(), className: 'bg-blue-500 hover:bg-blue-600' },
    { label: 'Agendar Consulta', onClick: () => appointmentsModal.openModal(), className: 'bg-orange-500 hover:bg-orange-600' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {cards.map(({ title, value, icon: Icon, color, bg, page }) => (
          <button
            key={title}
            onClick={() => onNavigate(page)}
            className="text-left bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">{title}</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800">{value}</p>
              </div>
              <div className={`${bg} p-2 sm:p-3 rounded-lg shrink-0`}>
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${color}`} />
              </div>
            </div>
          </button>
        ))}
      </div>

      <CalendarPreview
        refreshKey={refreshKey}
        onOpenCalendar={() => onNavigate('calendar')}
        onOpenAppointment={setSelectedAppointment}
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {quickActions.map(({ label, onClick, className }) => (
            <button key={label} onClick={onClick} className={`px-6 py-3 text-white rounded-lg transition-colors font-medium ${className}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusUpdated={() => setStatusVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
