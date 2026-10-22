import { FormEvent, useEffect, useState } from 'react';
import { supabase, Vaccination, Client } from '../lib/supabase';
import { dbErrorMessage } from '../lib/format';
import Modal, { FormActions, FormError, fieldClass, labelClass } from './Modal';

type AnimalOption = {
  id: string;
  name: string;
};

interface Props {
  // `clientId`: tutor do animal, para preencher o campo Dono ao editar.
  vaccination: (Vaccination & { clientId?: string }) | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function VaccinationModal({ vaccination, onClose, onSaved }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [animals, setAnimals] = useState<AnimalOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState(() => ({
    client_id: vaccination?.clientId ?? '',
    animal_id: vaccination?.animal_id ?? '',
    vaccine_name: vaccination?.vaccine_name ?? '',
    dose_number: vaccination?.dose_number?.toString() ?? '',
    total_doses: vaccination?.total_doses?.toString() ?? '',
    application_date: vaccination?.application_date ?? '',
    next_dose_date: vaccination?.next_dose_date ?? '',
    notes: vaccination?.notes ?? '',
  }));

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
      .select('id, name')
      .eq('client_id', formData.client_id)
      .order('name')
      .then(({ data }) => setAnimals(data ?? []));
  }, [formData.client_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => (name === 'client_id' ? { ...prev, client_id: value, animal_id: '' } : { ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    // Campos opcionais não exibidos no formulário (tipo, fabricante...) são preservados na edição.
    const payload = {
      animal_id: formData.animal_id,
      vaccine_name: formData.vaccine_name,
      dose_number: formData.dose_number ? Number(formData.dose_number) : null,
      total_doses: formData.total_doses ? Number(formData.total_doses) : null,
      application_date: formData.application_date,
      next_dose_date: formData.next_dose_date || null,
      notes: formData.notes || null,
    };

    const { error } = vaccination
      ? await supabase.from('animal_vaccinations').update(payload).eq('id', vaccination.id)
      : await supabase.from('animal_vaccinations').insert(payload);

    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível salvar a vacinação.'));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal title={vaccination ? 'Editar Vacinação' : 'Registrar Vacinação'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Dono *</label>
            <select required name="client_id" value={formData.client_id} onChange={handleChange} className={fieldClass}>
              <option value="">Selecione o Dono</option>
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
              name="animal_id"
              disabled={!formData.client_id}
              value={formData.animal_id}
              onChange={handleChange}
              className={fieldClass}
            >
              <option value="">{formData.client_id ? 'Selecione o animal' : 'Selecione o dono primeiro'}</option>
              {animals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Vacina *</label>
          <input required name="vaccine_name" value={formData.vaccine_name} onChange={handleChange} className={fieldClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Dose</label>
            <input type="number" min="1" name="dose_number" value={formData.dose_number} onChange={handleChange} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Total de doses</label>
            <input type="number" min="1" name="total_doses" value={formData.total_doses} onChange={handleChange} className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Data de aplicação *</label>
            <input type="date" required name="application_date" value={formData.application_date} onChange={handleChange} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Próxima dose</label>
            <input type="date" name="next_dose_date" value={formData.next_dose_date} onChange={handleChange} className={fieldClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Observações</label>
          <textarea rows={3} name="notes" value={formData.notes} onChange={handleChange} className={fieldClass} />
        </div>

        <FormActions submitLabel="Salvar" onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}
