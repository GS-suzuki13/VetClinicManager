import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, X, Search, Clock } from 'lucide-react';
import { supabase, Appointment, Animal, Client } from '../lib/supabase';

type AppointmentWithDetails = Appointment & {
  clients: Client;
  animals: Animal;
};

export default function Appointments() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
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
      console.error('Error loading appointments:', error);
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
      console.error('Error loading clients:', error);
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
      console.error('Error loading animals:', error);
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
      alert('Error saving appointment. Please check the form and try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this appointment?')) {
      return;
    }

    try {
      const { error } = await supabase.from('appointments').delete().eq('id', id);

      if (error) throw error;
      loadAppointments();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Error deleting appointment.');
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
              placeholder="Search appointments..."
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
            <option value="all">All Status</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          New Appointment
        </button>
      </div>

      <div className="space-y-4">
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
            No appointments found. Click "New Appointment" to schedule one.
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
                        {formatDate(appointment.appointment_date)} at {appointment.appointment_time}
                      </p>
                    </div>
                  </div>

                  <div className="ml-14">
                    <p className="text-sm text-slate-700 mb-2">
                      <span className="font-medium">Reason: </span>
                      {appointment.reason_for_visit}
                    </p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                      {appointment.status}
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-800">
                {editingAppointment ? 'Edit Appointment' : 'New Appointment'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client *</label>
                <select
                  required
                  value={formData.client_id}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Animal *</label>
                <select
                  required
                  value={formData.animal_id}
                  onChange={(e) => setFormData({ ...formData, animal_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  disabled={!formData.client_id}
                >
                  <option value="">Select an animal</option>
                  {animals.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animal.name} ({animal.species})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.appointment_date}
                    onChange={(e) =>
                      setFormData({ ...formData, appointment_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time *</label>
                  <input
                    type="time"
                    required
                    value={formData.appointment_time}
                    onChange={(e) =>
                      setFormData({ ...formData, appointment_time: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason for Visit *
                </label>
                <textarea
                  required
                  value={formData.reason_for_visit}
                  onChange={(e) => setFormData({ ...formData, reason_for_visit: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'Scheduled' | 'Completed' | 'Cancelled',
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
                >
                  {editingAppointment ? 'Update Appointment' : 'Schedule Appointment'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
