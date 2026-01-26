import { useEffect, useState } from 'react';
import { Users, Dog, FileText, Calendar } from 'lucide-react';
import { Appointment, Animal, Client, supabase } from '../lib/supabase';

import { useAppointmentsModal } from '../context/AppointmentsModalContext';
import { useClientsModal } from '../context/ClientsModalContext';
import { useAnimalsModal } from '../context/AnimalsModalContext.tsx';

import CalendarPreview from '../components/CalendarPreview.tsx';

type AppointmentWithDetails = Appointment & {
  clients: Client;
  animals: Animal;
};

interface Stats {
  totalClients: number;
  totalAnimals: number;
  totalRecords: number;
  upcomingAppointments: number;
}

export default function Dashboard({
    onNavigate,
  }: {
    onNavigate: (page: string) => void;
  }) {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalAnimals: 0,
    totalRecords: 0,
    upcomingAppointments: 0,
  });

  const [loading, setLoading] = useState(true);
  
  const { openModal: openClientsModal } = useClientsModal();
  const { openModal: openAnimalsModal } = useAnimalsModal();
  const { openModal: openAppointmentsModal, isOpen: isAppointmentsModalOpen } =
  useAppointmentsModal();
  const [selectedAppointment, setSelectedAppointment] =
  useState<AppointmentWithDetails | null>(null);


useEffect(() => {
  if (!isAppointmentsModalOpen) {
    loadStats();
  }
}, [isAppointmentsModalOpen]);

  const loadStats = async () => {
    try {
      const [clientsRes, animalsRes, recordsRes, appointmentsRes] =
        await Promise.all([
          supabase.from('clients').select('*', { count: 'exact', head: true }),
          supabase.from('animals').select('*', { count: 'exact', head: true }),
          supabase
            .from('medical_records')
            .select('*', { count: 'exact', head: true }),
          supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Scheduled')
            .gte('appointment_date', new Date().toISOString().split('T')[0]),
        ]);

      setStats({
        totalClients: clientsRes.count || 0,
        totalAnimals: animalsRes.count || 0,
        totalRecords: recordsRes.count || 0,
        upcomingAppointments: appointmentsRes.count || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      title: 'Total de Clientes',
      value: stats.totalClients,
      icon: Users,
      color: 'bg-blue-500',
      bgLight: 'bg-blue-50',
    },
    {
      title: 'Total de Animais',
      value: stats.totalAnimals,
      icon: Dog,
      color: 'bg-emerald-500',
      bgLight: 'bg-emerald-50',
    },
    {
      title: 'Registros Médicos',
      value: stats.totalRecords,
      icon: FileText,
      color: 'bg-purple-500',
      bgLight: 'bg-purple-50',
    },
    {
      title: 'Consultas Futuras',
      value: stats.upcomingAppointments,
      icon: Calendar,
      color: 'bg-orange-500',
      bgLight: 'bg-orange-50',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div>
      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold text-slate-800">
                    {card.value}
                  </p>
                </div>
                <div className={`${card.bgLight} p-3 rounded-lg`}>
                  <Icon
                    className={`w-6 h-6 ${card.color.replace(
                      'bg-',
                      'text-'
                    )}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Preview Calendário*/}
      <div className="mt-8">
        <CalendarPreview
          onOpenCalendar={() => onNavigate('calendar')}
          onOpenAppointment={(appointment) => setSelectedAppointment(appointment)}
        />
      </div>

      {/* Ações rápidas */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Ações Rápidas
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => openClientsModal()}
            className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
          >
            Adicionar Cliente
          </button>

          <button
            onClick={() => openAnimalsModal()}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Adicionar Animal
          </button>

          <button
            onClick={() => openAppointmentsModal()}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
          >
            Agendar Consulta
          </button>

        </div>
      </div>
    </div>
  );
}
