import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parseISODate, statusLabel, statusStyle, toISODate, todayISO } from '../lib/format';
import type { AppointmentWithDetails } from './AppointmentDetailsModal';

interface Props {
  onOpenCalendar: () => void;
  onOpenAppointment: (appointment: AppointmentWithDetails) => void;
  // Muda quando agendamentos são criados/alterados; força recarregar.
  refreshKey: number;
}

export default function CalendarPreview({ onOpenCalendar, onOpenAppointment, refreshKey }: Props) {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentDate, setCurrentDate] = useState(todayISO);

  const loadAppointmentsForDay = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('appointments')
      .select('*, clients(*), animals(*)')
      .eq('appointment_date', currentDate)
      .order('appointment_time', { ascending: true });
    if (error) console.error('Erro ao carregar agendamentos:', error);
    setAppointments(data ?? []);
    setLoading(false);
  }, [currentDate]);

  useEffect(() => {
    loadAppointmentsForDay();
  }, [loadAppointmentsForDay, refreshKey]);

  const term = search.toLowerCase();
  const filteredAppointments = appointments.filter((apt) =>
    `${apt.animals.name} ${apt.clients.full_name}`.toLowerCase().includes(term)
  );

  const changeDay = (delta: number) => {
    const date = parseISODate(currentDate);
    date.setDate(date.getDate() + delta);
    setCurrentDate(toISODate(date));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-slate-800">Agenda do Dia</h3>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => changeDay(-1)} aria-label="Dia anterior" className="p-1 rounded hover:bg-slate-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button onClick={() => changeDay(1)} aria-label="Próximo dia" className="p-1 rounded hover:bg-slate-100">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={onOpenCalendar} className="ml-auto sm:ml-2 text-sm text-emerald-600 hover:underline font-medium whitespace-nowrap">
            Ver calendário
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Buscar por animal ou dono"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {loading ? (
        <div className="h-32 animate-pulse bg-slate-100 rounded-lg" />
      ) : filteredAppointments.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">Sem agendamentos para esta data</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2 pr-2">Hora</th>
                <th className="py-2 pr-2">Animal</th>
                <th className="py-2 pr-2 hidden sm:table-cell">Dono</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((apt) => (
                <tr
                  key={apt.id}
                  onClick={() => onOpenAppointment(apt)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="py-2 pr-2">{apt.appointment_time.slice(0, 5)}</td>
                  <td className="py-2 pr-2 font-medium text-slate-800">{apt.animals.name}</td>
                  <td className="py-2 pr-2 text-slate-600 hidden sm:table-cell">{apt.clients.full_name}</td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle[apt.status]}`}>
                      {statusLabel[apt.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
