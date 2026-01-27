import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase, MedicalRecord, Client, Animal } from '../lib/supabase';

interface Props {
  record: MedicalRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function MedicalRecordModal({
  record,
  onClose,
  onSaved,
}: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    animal_id: '',
    consultation_date: '',
    veterinarian_name: '',
    symptoms: '',
    diagnosis: '',
    procedures: '',
    prescribed_medication: '',
    observations: '',
  });

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (formData.client_id) {
      loadAnimals(formData.client_id);
    } else {
      setAnimals([]);
    }
  }, [formData.client_id]);

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('full_name');
    setClients(data || []);
  };

  const loadAnimals = async (clientId: string) => {
    const { data } = await supabase
      .from('animals')
      .select('*')
      .eq('client_id', clientId)
      .order('name');
    setAnimals(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (record) {
      await supabase
        .from('medical_records')
        .update({ ...formData })
        .eq('id', record.id);
    } else {
      await supabase.from('medical_records').insert([formData]);
    }

    setLoading(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-xl font-semibold">
            {record ? 'Editar Prontuário' : 'Novo Prontuário'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Dono */}
          <div>
            <label className="block text-sm font-medium mb-1">Dono *</label>
            <select
              required
              value={formData.client_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  client_id: e.target.value,
                  animal_id: '',
                })
              }
              className="w-full px-3 py-2 border rounded-lg focus:ring-emerald-500"
            >
              <option value="">Selecione o dono</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Animal */}
          <div>
            <label className="block text-sm font-medium mb-1">Animal *</label>
            <select
              required
              value={formData.animal_id}
              onChange={(e) =>
                setFormData({ ...formData, animal_id: e.target.value })
              }
              disabled={!formData.client_id}
              className="w-full px-3 py-2 border rounded-lg focus:ring-emerald-500 disabled:bg-slate-100"
            >
              <option value="">Selecione o animal</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Restante */}
          <input
            type="date"
            required
            value={formData.consultation_date}
            onChange={(e) =>
              setFormData({ ...formData, consultation_date: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg"
          />

          <textarea
            placeholder="Diagnóstico"
            required
            value={formData.diagnosis}
            onChange={(e) =>
              setFormData({ ...formData, diagnosis: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg"
          />

          <div className="flex gap-3 pt-4">
            <button
              disabled={loading}
              className="flex-1 bg-emerald-500 text-white py-2 rounded-lg hover:bg-emerald-600"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
