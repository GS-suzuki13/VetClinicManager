import { useEffect, useState } from 'react';
import { Users, Dog, FileText, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Stats {
  totalClients: number;
  totalAnimals: number;
  totalRecords: number;
  upcomingAppointments: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalAnimals: 0,
    totalRecords: 0,
    upcomingAppointments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [clientsRes, animalsRes, recordsRes, appointmentsRes] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('animals').select('id', { count: 'exact', head: true }),
        supabase.from('medical_records').select('id', { count: 'exact', head: true }),
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
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
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      title: 'Total Clients',
      value: stats.totalClients,
      icon: Users,
      color: 'bg-blue-500',
      bgLight: 'bg-blue-50',
    },
    {
      title: 'Total Animals',
      value: stats.totalAnimals,
      icon: Dog,
      color: 'bg-emerald-500',
      bgLight: 'bg-emerald-50',
    },
    {
      title: 'Medical Records',
      value: stats.totalRecords,
      icon: FileText,
      color: 'bg-purple-500',
      bgLight: 'bg-purple-50',
    },
    {
      title: 'Upcoming Appointments',
      value: stats.upcomingAppointments,
      icon: Calendar,
      color: 'bg-orange-500',
      bgLight: 'bg-orange-50',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-slate-600">Welcome to the Veterinary Clinic Management System</p>
      </div>

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
                  <p className="text-sm font-medium text-slate-600 mb-1">{card.title}</p>
                  <p className="text-3xl font-bold text-slate-800">{card.value}</p>
                </div>
                <div className={`${card.bgLight} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${card.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium">
            Add New Client
          </button>
          <button className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">
            Register Animal
          </button>
          <button className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium">
            Schedule Appointment
          </button>
        </div>
      </div>
    </div>
  );
}
