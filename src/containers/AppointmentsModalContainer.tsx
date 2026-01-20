import { useEffect, useState } from 'react';
import { supabase, Client, Animal } from '../lib/supabase';
import { useAppointmentsModal } from '../context/AppointmentsModalContext';
import AppointmentModal from '../components/AppointmentsModal';

const initialForm = {
  client_id: '',
  animal_id: '',
  appointment_date: '',
  appointment_time: '',
  reason_for_visit: '',
  status: 'Scheduled' as 'Scheduled' | 'Completed' | 'Cancelled',
};

export default function AppointmentsModalContainer() {
  const { isOpen, editingAppointment, closeModal } = useAppointmentsModal();

  const [clients, setClients] = useState<Client[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (editingAppointment) {
      setFormData({
        client_id: editingAppointment.client_id,
        animal_id: editingAppointment.animal_id,
        appointment_date: editingAppointment.appointment_date,
        appointment_time: editingAppointment.appointment_time,
        reason_for_visit: editingAppointment.reason_for_visit,
        status: editingAppointment.status,
      });
      loadAnimalsByClient(editingAppointment.client_id);
    } else {
      setFormData(initialForm);
      setAnimals([]);
    }
  }, [editingAppointment]);

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('full_name');
    setClients(data || []);
  };

  const loadAnimalsByClient = async (clientId: string) => {
    const { data } = await supabase
      .from('animals')
      .select('*')
      .eq('client_id', clientId)
      .order('name');
    setAnimals(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingAppointment) {
      await supabase
        .from('appointments')
        .update(formData)
        .eq('id', editingAppointment.id);
    } else {
      await supabase.from('appointments').insert([formData]);
    }

    closeModal();
  };

  return (
    <AppointmentModal
      open={isOpen}
      onClose={closeModal}
      onSubmit={handleSubmit}
      formData={formData}
      setFormData={setFormData}
      clients={clients}
      animals={animals}
      editing={!!editingAppointment}
      onClientChange={(clientId) => {
        setFormData({ ...formData, client_id: clientId, animal_id: '' });
        loadAnimalsByClient(clientId);
      }}
    />
  );
}
