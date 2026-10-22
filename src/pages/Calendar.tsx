import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toISODate } from '../lib/format';
import { useAppointmentsModal } from '../context/AppointmentsModalContext';
import { PageLoader } from '../components/PageToolbar';
import AppointmentDetailsModal, { AppointmentWithDetails } from '../components/AppointmentDetailsModal';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Calendar() {
  const { savedVersion } = useAppointmentsModal();
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [details, setDetails] = useState<AppointmentWithDetails | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadAppointments = useCallback(async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, clients(*), animals(*)')
      .gte('appointment_date', toISODate(new Date(year, month, 1)))
      .lte('appointment_date', toISODate(new Date(year, month + 1, 0)))
      .eq('status', 'Scheduled')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });
    if (error) console.error('Erro ao carregar agendamentos:', error);
    setAppointments(data ?? []);
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments, savedVersion]);

  const appointmentsOn = (date: Date) => {
    const iso = toISODate(date);
    return appointments.filter((apt) => apt.appointment_date === iso);
  };

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(year, month + delta, 1));
    setSelectedDate(null);
  };

  const renderCalendarDays = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDayOfWeek = new Date(year, month, 1).getDay();
    const todayString = new Date().toDateString();
    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-14 sm:min-h-24 border border-slate-100" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateAppointments = appointmentsOn(date);
      const isToday = todayString === date.toDateString();
      const isSelected = selectedDate?.toDateString() === date.toDateString();

      days.push(
        <button
          type="button"
          key={day}
          onClick={() => setSelectedDate(date)}
          className={`p-1 sm:p-2 min-h-14 sm:min-h-24 text-left align-top border border-slate-200 transition-all ${
            isToday ? 'bg-emerald-50 border-emerald-300' : 'bg-white hover:bg-slate-50'
          } ${isSelected ? 'ring-2 ring-inset ring-emerald-500' : ''}`}
        >
          <div className="flex justify-between items-start mb-1">
            <span className={`text-xs sm:text-sm font-medium ${isToday ? 'text-emerald-600' : 'text-slate-700'}`}>{day}</span>
            {dateAppointments.length > 0 && (
              <span className="text-[10px] sm:text-xs bg-emerald-500 text-white px-1.5 sm:px-2 py-0.5 rounded-full">
                {dateAppointments.length}
              </span>
            )}
          </div>
          <div className="hidden sm:block space-y-1">
            {dateAppointments.slice(0, 2).map((apt) => (
              <div key={apt.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded truncate">
                {apt.appointment_time.slice(0, 5)} - {apt.animals.name}
              </div>
            ))}
            {dateAppointments.length > 2 && <div className="text-xs text-slate-500">+{dateAppointments.length - 2} mais</div>}
          </div>
        </button>
      );
    }

    return days;
  };

  const selectedDateAppointments = selectedDate ? appointmentsOn(selectedDate) : [];

  if (loading) return <PageLoader />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-800 first-letter:uppercase">
              {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-2">
              <button onClick={() => changeMonth(-1)} aria-label="Mês anterior" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => changeMonth(1)} aria-label="Próximo mês" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border border-slate-200 rounded-lg overflow-hidden">
            {WEEKDAYS.map((day) => (
              <div key={day} className="bg-slate-50 p-2 text-center text-xs sm:text-sm font-medium text-slate-600 border-b border-slate-200">
                {day}
              </div>
            ))}
            {renderCalendarDays()}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 lg:sticky lg:top-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 first-letter:uppercase">
            {selectedDate
              ? selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
              : 'Selecione uma data'}
          </h3>

          {!selectedDate ? (
            <p className="text-center py-8 text-slate-500">Clique em uma data para ver os agendamentos.</p>
          ) : selectedDateAppointments.length === 0 ? (
            <p className="text-center py-8 text-slate-500">Nenhum agendamento nesta data.</p>
          ) : (
            <div className="space-y-3">
              {selectedDateAppointments.map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => setDetails(apt)}
                  className="w-full text-left border border-slate-200 rounded-lg p-4 hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-emerald-50 p-2 rounded-lg">
                      <Clock className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{apt.appointment_time.slice(0, 5)}</p>
                      <p className="text-sm text-slate-600 mt-1">{apt.animals.name}</p>
                      <p className="text-xs text-slate-500 mt-1">Dono: {apt.clients.full_name}</p>
                      <p className="text-xs text-slate-600 mt-2 break-words">{apt.reason_for_visit}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {details && <AppointmentDetailsModal appointment={details} onClose={() => setDetails(null)} onStatusUpdated={loadAppointments} />}
    </div>
  );
}
