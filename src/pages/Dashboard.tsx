import { useCallback, useEffect, useState } from 'react';
import { Users, Dog, FileText, Calendar, Hourglass, Stethoscope, CheckCircle2, Timer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatMinutes, openStatuses, todayISO } from '../lib/format';
import { useAppointmentsModal } from '../context/AppointmentsModalContext';
import { useClientsModal } from '../context/ClientsModalContext';
import { useAnimalsModal } from '../context/AnimalsModalContext';
import CalendarPreview from '../components/CalendarPreview';
import AppointmentDetailsModal, { AppointmentWithDetails } from '../components/AppointmentDetailsModal';
import { PageLoader } from '../components/PageToolbar';
import TodayTasks from '../components/TodayTasks';

interface Stats {
  totalClients: number;
  totalAnimals: number;
  totalRecords: number;
  upcomingAppointments: number;
}

// Fila do dia e tempos médios (espera = chegada → início; atendimento = início → fim).
interface Today {
  waiting: number;
  inProgress: number;
  completed: number;
  avgWait: number | null;
  avgService: number | null;
}

function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

const minutes = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;

export default function Dashboard({ onNavigate, onOpenRecord }: { onNavigate: (page: string) => void; onOpenRecord: (animalId: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [statusVersion, setStatusVersion] = useState(0);

  const clientsModal = useClientsModal();
  const animalsModal = useAnimalsModal();
  const appointmentsModal = useAppointmentsModal();
  const refreshKey = clientsModal.savedVersion + animalsModal.savedVersion + appointmentsModal.savedVersion + statusVersion;

  const loadStats = useCallback(async () => {
    const count = { count: 'exact', head: true } as const;
    const [clientsRes, animalsRes, recordsRes, appointmentsRes, todayRes] = await Promise.all([
      supabase.from('clients').select('*', count),
      supabase.from('animals').select('*', count),
      supabase.from('medical_records').select('*', count),
      supabase.from('appointments').select('*', count).in('status', openStatuses).gte('appointment_date', todayISO()),
      supabase.from('appointments').select('status, checked_in_at, started_at, finished_at').eq('appointment_date', todayISO()),
    ]);

    const rows = todayRes.data ?? [];
    setToday({
      waiting: rows.filter((r) => r.status === 'Waiting').length,
      inProgress: rows.filter((r) => r.status === 'InProgress').length,
      completed: rows.filter((r) => r.status === 'Completed').length,
      avgWait: average(rows.filter((r) => r.checked_in_at && r.started_at).map((r) => minutes(r.checked_in_at!, r.started_at!))),
      avgService: average(rows.filter((r) => r.started_at && r.finished_at).map((r) => minutes(r.started_at!, r.finished_at!))),
    });

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
            className="text-left bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
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

      <TodayTasks onNavigate={onNavigate} refreshKey={refreshKey} />

      {today && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Atendimento de hoje</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              { label: 'Em espera', value: String(today.waiting), icon: Hourglass, color: 'text-amber-600 bg-amber-50' },
              { label: 'Em atendimento', value: String(today.inProgress), icon: Stethoscope, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Atendidos', value: String(today.completed), icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
              { label: 'Espera média', value: today.avgWait != null ? formatMinutes(today.avgWait) : '-', icon: Timer, color: 'text-blue-600 bg-blue-50' },
              { label: 'Atendimento médio', value: today.avgService != null ? formatMinutes(today.avgService) : '-', icon: Timer, color: 'text-purple-600 bg-purple-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                <div className={`p-2 rounded-lg ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-lg font-bold text-slate-800">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          onOpenRecord={onOpenRecord}
        />
      )}
    </div>
  );
}
