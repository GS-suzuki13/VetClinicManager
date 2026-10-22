import { FormEvent, useEffect, useState } from 'react';
import { supabase, Appointment, Animal, Client } from '../lib/supabase';
import { dbErrorMessage, speciesLabel, statusLabel } from '../lib/format';
import { useAppointmentsModal } from '../context/AppointmentsModalContext';
import Modal, { FormActions, FormError, fieldClass, labelClass } from './Modal';

type AppointmentForm = Pick<
  Appointment,
  'client_id' | 'animal_id' | 'appointment_date' | 'appointment_time' | 'reason_for_visit' | 'status'
>;

const emptyForm: AppointmentForm = {
  client_id: '',
  animal_id: '',
  appointment_date: '',
  appointment_time: '',
  reason_for_visit: '',
  status: 'Scheduled',
};

export default function AppointmentsModal() {
  const { isOpen, editingAppointment } = useAppointmentsModal();
  if (!isOpen) return null;
  return <AppointmentFormModal key={editingAppointment?.id ?? 'new'} editing={editingAppointment} />;
}

function AppointmentFormModal({ editing }: { editing: Appointment | null }) {
  const { closeModal, notifySaved } = useAppointmentsModal();
  const [clients, setClients] = useState<Client[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AppointmentForm>(() =>
    editing
      ? {
          client_id: editing.client_id,
          animal_id: editing.animal_id,
          appointment_date: editing.appointment_date,
          appointment_time: editing.appointment_time.slice(0, 5),
          reason_for_visit: editing.reason_for_visit,
          status: editing.status,
        }
      : emptyForm
  );

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .order('full_name')
      .then(({ data }) => setClients(data ?? []));
  }, []);

  useEffect(() => {
    if (!formData.client_id) {
      setAnimals([]);
      return;
    }
    supabase
      .from('animals')
      .select('*')
      .eq('client_id', formData.client_id)
      .order('name')
      .then(({ data }) => setAnimals(data ?? []));
  }, [formData.client_id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = editing
      ? await supabase.from('appointments').update(formData).eq('id', editing.id)
      : await supabase.from('appointments').insert(formData);

    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível salvar o agendamento.'));
      return;
    }
    notifySaved();
    closeModal();
  };

  return (
    <Modal title={editing ? 'Editar Agendamento' : 'Novo Agendamento'} onClose={closeModal}>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Cliente *</label>
            <select
              required
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value, animal_id: '' })}
              className={fieldClass}
            >
              <option value="">Selecione o cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Animal *</label>
            <select
              required
              disabled={!formData.client_id}
              value={formData.animal_id}
              onChange={(e) => setFormData({ ...formData, animal_id: e.target.value })}
              className={fieldClass}
            >
              <option value="">{formData.client_id ? 'Selecione o animal' : 'Selecione o cliente primeiro'}</option>
              {animals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.name} ({speciesLabel[animal.species]})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Data *</label>
            <input
              type="date"
              required
              value={formData.appointment_date}
              onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Horário *</label>
            <input
              type="time"
              required
              value={formData.appointment_time}
              onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Motivo da visita *</label>
          <textarea
            required
            rows={3}
            value={formData.reason_for_visit}
            onChange={(e) => setFormData({ ...formData, reason_for_visit: e.target.value })}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>Status *</label>
          <select
            required
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as Appointment['status'] })}
            className={fieldClass}
          >
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <FormActions submitLabel={editing ? 'Atualizar Agendamento' : 'Agendar Consulta'} onCancel={closeModal} busy={busy} />
      </form>
    </Modal>
  );
}
