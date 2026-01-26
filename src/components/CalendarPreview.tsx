import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { supabase, Appointment, Animal, Client } from '../lib/supabase';

type AppointmentWithDetails = Appointment & {
  clients: Client;
  animals: Animal;
};

const statusStyles: Record<string, string> = {
  Scheduled: 'bg-emerald-100 text-emerald-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
};

export default function CalendarPreview({
  onOpenCalendar,
  onOpenAppointment,
}: {
  onOpenCalendar: () => void;
  onOpenAppointment: (appointment: AppointmentWithDetails) => void;
}) {

  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentDate, setCurrentDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    loadAppointmentsForDay();
  }, [currentDate]);

  const loadAppointmentsForDay = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(*), animals(*)')
        .eq('appointment_date', currentDate)
        .order('appointment_time', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) =>
      `${apt.animals.name} ${apt.clients.full_name}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [appointments, search]);

  const changeDay = (direction: 'prev' | 'next') => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
    setCurrentDate(date.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-slate-800">
            Agenda do Dia
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDay('prev')}
            className="p-1 rounded hover:bg-slate-100"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <input
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <button
            onClick={() => changeDay('next')}
            className="p-1 rounded hover:bg-slate-100"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenCalendar}
            className="ml-2 text-sm text-emerald-600 hover:underline font-medium"
          >
            Ver calendário
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por animal ou dono"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="h-32 animate-pulse bg-slate-100 rounded-lg" />
      ) : filteredAppointments.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          Sem agendamentos para esta data
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
               className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2">Hora</th>
                <th className="py-2">Animal</th>
                <th className="py-2">Dono</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredAppointments.map((apt) => (
                <tr
                  key={apt.id}
                  onClick={() => onOpenAppointment(apt)}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="py-2">
                    {apt.appointment_time.substring(0, 5)}
                  </td>
                  <td className="py-2 font-medium text-slate-800">
                    {apt.animals.name}
                  </td>
                  <td className="py-2 text-slate-600">
                    {apt.clients.full_name}
                  </td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[apt.status]}`}
                    >
                      {apt.status === 'Scheduled'
                        ? 'Agendado'
                        : apt.status === 'Completed'
                        ? 'Concluído'
                        : 'Cancelado'}
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
