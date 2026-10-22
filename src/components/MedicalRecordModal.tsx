import { FormEvent, useEffect, useState } from 'react';
import { supabase, MedicalRecord, Animal, Client } from '../lib/supabase';
import { dbErrorMessage, speciesLabel, todayISO } from '../lib/format';
import Modal, { FormActions, FormError, fieldClass, labelClass } from './Modal';

interface Props {
  record: (MedicalRecord & { animals?: Animal & { clients?: Client } }) | null;
  onClose: () => void;
  onSaved: () => void;
}

type RecordForm = Pick<
  MedicalRecord,
  | 'animal_id'
  | 'consultation_date'
  | 'symptoms'
  | 'diagnosis'
  | 'procedures'
  | 'prescribed_medication'
  | 'observations'
  | 'veterinarian_name'
>;

export default function MedicalRecordModal({ record, onClose, onSaved }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selectedClient, setSelectedClient] = useState(record?.animals?.client_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<RecordForm>(() => ({
    animal_id: record?.animal_id ?? '',
    consultation_date: record ? record.consultation_date.slice(0, 10) : todayISO(),
    symptoms: record?.symptoms ?? '',
    diagnosis: record?.diagnosis ?? '',
    procedures: record?.procedures ?? '',
    prescribed_medication: record?.prescribed_medication ?? '',
    observations: record?.observations ?? '',
    veterinarian_name: record?.veterinarian_name ?? '',
  }));

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .order('full_name')
      .then(({ data }) => setClients(data ?? []));
  }, []);

  useEffect(() => {
    if (!selectedClient) {
      setAnimals([]);
      return;
    }
    supabase
      .from('animals')
      .select('*')
      .eq('client_id', selectedClient)
      .order('name')
      .then(({ data }) => setAnimals(data ?? []));
  }, [selectedClient]);

  const set = (field: keyof RecordForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = record
      ? await supabase.from('medical_records').update(formData).eq('id', record.id)
      : await supabase.from('medical_records').insert(formData);

    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível salvar o prontuário.'));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal title={record ? 'Editar Prontuário' : 'Novo Prontuário'} onClose={onClose} size="xl">
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Dono *</label>
            <select
              required
              value={selectedClient}
              onChange={(e) => {
                setSelectedClient(e.target.value);
                setFormData((p) => ({ ...p, animal_id: '' }));
              }}
              className={fieldClass}
            >
              <option value="">Selecione o dono</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Animal *</label>
            <select required value={formData.animal_id} onChange={set('animal_id')} className={fieldClass} disabled={!selectedClient}>
              <option value="">{selectedClient ? 'Selecione o animal' : 'Selecione o dono primeiro'}</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({speciesLabel[a.species]})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Data da Consulta *</label>
            <input type="date" required value={formData.consultation_date} onChange={set('consultation_date')} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Nome do(a) Veterinário(a) *</label>
            <input type="text" required value={formData.veterinarian_name} onChange={set('veterinarian_name')} className={fieldClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Sintomas *</label>
          <textarea required rows={3} value={formData.symptoms} onChange={set('symptoms')} className={fieldClass} />
        </div>

        <div>
          <label className={labelClass}>Diagnóstico *</label>
          <textarea required rows={3} value={formData.diagnosis} onChange={set('diagnosis')} className={fieldClass} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Procedimentos</label>
            <textarea rows={2} value={formData.procedures} onChange={set('procedures')} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Prescrição Médica</label>
            <textarea rows={2} value={formData.prescribed_medication} onChange={set('prescribed_medication')} className={fieldClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Observações</label>
          <textarea rows={3} value={formData.observations} onChange={set('observations')} className={fieldClass} />
        </div>

        <FormActions submitLabel={record ? 'Atualizar' : 'Criar'} onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}
