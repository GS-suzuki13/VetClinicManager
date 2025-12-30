import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { supabase, Appointment, Animal, Client } from '../lib/supabase';

type AppointmentWithDetails = Appointment & {
  clients: Client;
  animals: Animal;
};

export default function Calendar() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    loadAppointments();
  }, [currentDate]);

  const loadAppointments = async () => {
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(*), animals(*)')
        .gte('appointment_date', startOfMonth.toISOString().split('T')[0])
        .lte('appointment_date', endOfMonth.toISOString().split('T')[0])
        .eq('status', 'Scheduled')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const getAppointmentsForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return appointments.filter((apt) => apt.appointment_date === dateString);
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const renderCalendarDays = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 min-h-24"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateAppointments = getAppointmentsForDate(date);
      const isToday = new Date().toDateString() === date.toDateString();
      const isSelected = selectedDate?.toDateString() === date.toDateString();

      days.push(
        <div
          key={day}
          onClick={() => setSelectedDate(date)}
          className={`p-2 min-h-24 border border-slate-200 cursor-pointer transition-all ${
            isToday ? 'bg-emerald-50 border-emerald-300' : 'bg-white hover:bg-slate-50'
          } ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}
        >
          <div className="flex justify-between items-start mb-1">
            <span
              className={`text-sm font-medium ${
                isToday ? 'text-emerald-600' : 'text-slate-700'
              }`}
            >
              {day}
            </span>
            {dateAppointments.length > 0 && (
              <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                {dateAppointments.length}
              </span>
            )}
          </div>
          <div className="space-y-1">
            {dateAppointments.slice(0, 2).map((apt) => (
              <div
                key={apt.id}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded truncate"
              >
                {apt.appointment_time.substring(0, 5)} - {apt.animals.name}
              </div>
            ))}
            {dateAppointments.length > 2 && (
              <div className="text-xs text-slate-500">+{dateAppointments.length - 2} more</div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const selectedDateAppointments = selectedDate ? getAppointmentsForDate(selectedDate) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-slate-800">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0 border border-slate-200 rounded-lg overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="bg-slate-50 p-2 text-center text-sm font-medium text-slate-600 border-b border-slate-200"
              >
                {day}
              </div>
            ))}
            {renderCalendarDays()}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-24">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            {selectedDate
              ? selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Select a date'}
          </h3>

          {selectedDate ? (
            selectedDateAppointments.length > 0 ? (
              <div className="space-y-3">
                {selectedDateAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="border border-slate-200 rounded-lg p-4 hover:border-emerald-300 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-emerald-50 p-2 rounded-lg">
                        <Clock className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">
                          {apt.appointment_time.substring(0, 5)}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">{apt.animals.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Owner: {apt.clients.full_name}
                        </p>
                        <p className="text-xs text-slate-600 mt-2">{apt.reason_for_visit}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>No appointments scheduled for this date.</p>
              </div>
            )
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p>Click on a date to view appointments.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
