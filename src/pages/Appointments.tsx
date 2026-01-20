import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Edit, Trash2, X, Search, Clock } from 'lucide-react';
import { supabase, Appointment, Animal, Client } from '../lib/supabase';
import AppointmentModal from '../components/AppointmentsModal';

type AppointmentWithDetails = Appointment & {
  clients: Client;
  animals: Animal;
};

export default function Appointments() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [formData, setFormData] = useState({
    client_id: '',
    animal_id: '',
    appointment_date: '',
    appointment_time: '',
    reason_for_visit: '',
    status: 'Scheduled' as 'Scheduled' | 'Completed' | 'Cancelled',
  });

  useEffect(() => {
    loadAppointments();
    loadClients();
  }, []);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      openModal();

      setSearchParams({});
    }
  }, [searchParams]);


  const statusLabel = {
    Scheduled: 'Agendado',
    Completed: 'Concluído',
    Cancelled: 'Cancelado',
  } as const;

  const loadAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(*), animals(*)')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Erro ao carregar os agendamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadAnimalsByClient = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('animals')
        .select('*')
        .eq('client_id', clientId)
        .order('name', { ascending: true });

      if (error) throw error;
      setAnimals(data || []);
    } catch (error) {
      console.error('Erro ao carregar animais:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingAppointment) {
        const { error } = await supabase
          .from('appointments')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingAppointment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('appointments').insert([formData]);

        if (error) throw error;
      }

      loadAppointments();
      closeModal();
    } catch (error) {
      console.error('Error saving appointment:', error);
      alert('Ocorreu um erro ao salvar o agendamento. Verifique o formulário e tente novamente.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza de que deseja excluir este agendamento?')) {
      return;
    }

    try {
      const { error } = await supabase.from('appointments').delete().eq('id', id);

      if (error) throw error;
      loadAppointments();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Erro ao excluir o agendamento.');
    }
  };

  const openModal = (appointment?: AppointmentWithDetails) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setFormData({
        client_id: appointment.client_id,
        animal_id: appointment.animal_id,
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time,
        reason_for_visit: appointment.reason_for_visit,
        status: appointment.status,
      });
      loadAnimalsByClient(appointment.client_id);
    } else {
      setEditingAppointment(null);
      setFormData({
        client_id: '',
        animal_id: '',
        appointment_date: '',
        appointment_time: '',
        reason_for_visit: '',
        status: 'Scheduled',
      });
      setAnimals([]);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAppointment(null);
    setFormData({
      client_id: '',
      animal_id: '',
      appointment_date: '',
      appointment_time: '',
      reason_for_visit: '',
      status: 'Scheduled',
    });
    setAnimals([]);
  };

  const handleClientChange = (clientId: string) => {
    setFormData({ ...formData, client_id: clientId, animal_id: '' });
    loadAnimalsByClient(clientId);
  };

  const filteredAppointments = appointments.filter((appointment) => {
    const matchesSearch =
      appointment.clients.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.animals.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.reason_for_visit.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || appointment.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled':
        return 'bg-blue-100 text-blue-700';
      case 'Completed':
        return 'bg-green-100 text-green-700';
      case 'Cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar agendamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todos os status</option>
            <option value="Scheduled">Agendado</option>
            <option value="Completed">Concluído</option>
            <option value="Cancelled">Cancelado</option>
          </select>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Novo Agendamento
        </button>
      </div>

      <div className="space-y-4">
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
            Não foram encontrados agendamentos. Clique em "Novo agendamento" para marcar um.
          </div>
        ) : (
          filteredAppointments.map((appointment) => (
            <div
              key={appointment.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="bg-emerald-50 p-2 rounded-lg">
                      <Clock className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">
                        {appointment.animals.name} - {appointment.clients.full_name}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {formatDate(appointment.appointment_date)} às {appointment.appointment_time.substring(0, 5)}
                      </p>
                    </div>
                  </div>

                  <div className="ml-14">
                    <p className="text-sm text-slate-700 mb-2">
                      <span className="font-medium">Motivo: </span>
                      {appointment.reason_for_visit}
                    </p>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}
                      >
                        {statusLabel[appointment.status]}
                      </span>
                  </div>
                </div>

                <div className="flex md:flex-col gap-2">
                  <button
                    onClick={() => openModal(appointment)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(appointment.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AppointmentModal
        open={showModal}
        onClose={closeModal}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        clients={clients}
        animals={animals}
        editing={!!editingAppointment}
        onClientChange={handleClientChange}
      />

    </div>
  );
}
