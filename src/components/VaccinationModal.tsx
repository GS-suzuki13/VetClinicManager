import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase, Vaccination, Client } from '../lib/supabase';

type AnimalOption = {
  id: string;
  name: string;
};

interface Props {
  vaccination: Vaccination | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function VaccinationModal({
  vaccination,
  onClose,
  onSaved,
}: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [animals, setAnimals] = useState<AnimalOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    animal_id: '',
    vaccine_name: '',
    vaccine_type: '',
    dose_number: '',
    total_doses: '',
    application_date: '',
    next_dose_date: '',
    veterinarian_name: '',
    clinic_name: '',
    notes: '',
  });

  useEffect(() => {
    loadClients();

    if (vaccination) {
      setFormData({
        client_id: '',
        animal_id: vaccination.animal_id,
        vaccine_name: vaccination.vaccine_name,
        vaccine_type: vaccination.vaccine_type ?? '',
        dose_number: vaccination.dose_number?.toString() ?? '',
        total_doses: vaccination.total_doses?.toString() ?? '',
        application_date: vaccination.application_date,
        next_dose_date: vaccination.next_dose_date ?? '',
        veterinarian_name: vaccination.veterinarian_name ?? '',
        clinic_name: vaccination.clinic_name ?? '',
        notes: vaccination.notes ?? '',
      });
    }
  }, [vaccination]);

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('full_name');

    if (!error && data) {
      setClients(data);
    }
  };

  const loadAnimalsByClient = async (clientId: string) => {
    const { data, error } = await supabase
      .from('animals')
      .select('id, name')
      .eq('client_id', clientId)
      .order('name');

    if (!error && data) {
      setAnimals(data);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;

    if (name === 'client_id') {
      setFormData((prev) => ({
        ...prev,
        client_id: value,
        animal_id: '',
      }));

      setAnimals([]);
      loadAnimalsByClient(value);
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      animal_id: formData.animal_id,
      vaccine_name: formData.vaccine_name,
      vaccine_type: formData.vaccine_type || null,
      dose_number: formData.dose_number
        ? Number(formData.dose_number)
        : null,
      total_doses: formData.total_doses
        ? Number(formData.total_doses)
        : null,
      application_date: formData.application_date,
      next_dose_date: formData.next_dose_date || null,
      veterinarian_name: formData.veterinarian_name || null,
      clinic_name: formData.clinic_name || null,
      notes: formData.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (vaccination) {
      await supabase
        .from('animal_vaccinations')
        .update(payload)
        .eq('id', vaccination.id);
    } else {
      await supabase.from('animal_vaccinations').insert([payload]);
    }

    setLoading(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-800">
            {vaccination ? 'Editar Vacinação' : 'Registrar Vacinação'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Dono *
            </label>
            <select
              required
              name="client_id"
              value={formData.client_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecione o Dono</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Animal *
            </label>
            <select
              required
              name="animal_id"
              disabled={!formData.client_id}
              value={formData.animal_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
            >
              <option value="">
                {formData.client_id
                  ? 'Selecione o animal'
                  : 'Selecione o dono primeiro'}
              </option>
              {animals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Vacina *
            </label>
            <input
              required
              name="vaccine_name"
              value={formData.vaccine_name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Dose
              </label>
              <input
                type="number"
                name="dose_number"
                value={formData.dose_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Total de doses
              </label>
              <input
                type="number"
                name="total_doses"
                value={formData.total_doses}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data de aplicação *
              </label>
              <input
                type="date"
                required
                name="application_date"
                value={formData.application_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Próxima dose
              </label>
              <input
                type="date"
                name="next_dose_date"
                value={formData.next_dose_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Observações
            </label>
            <textarea
              rows={3}
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
