import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { supabase, Vaccination, Animal, Client } from '../lib/supabase';
import VaccinationModal from '../components/VaccinationModal';
import { canDeleteClinicalData, useClinic } from '../context/AuthContext';

interface VaccinationWithAnimal extends Vaccination {
  animals: Animal & {
    clients?: Client;
  };
}

export default function Vaccinations() {
  const canDelete = canDeleteClinicalData(useClinic().role);
  const [vaccinations, setVaccinations] = useState<VaccinationWithAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedVaccination, setSelectedVaccination] =
    useState<VaccinationWithAnimal | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchVaccinations = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('animal_vaccinations')
      .select(`
        *,
        animals (
          id,
          name,
          species,
          clients (
            id,
            full_name
          )
        )
      `)
      .order('application_date', { ascending: false });

    if (!error && data) {
      setVaccinations(data as VaccinationWithAnimal[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchVaccinations();
  }, []);

  const openNewVaccinationModal = () => {
    setSelectedVaccination(null);
    setIsModalOpen(true);
  };

  const openEditVaccinationModal = (vaccination: VaccinationWithAnimal) => {
    setSelectedVaccination(vaccination);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm('Tem certeza que deseja excluir este registro de vacinação?')
    ) {
      return;
    }

    await supabase.from('animal_vaccinations').delete().eq('id', id);
    fetchVaccinations();
  };

  const filteredVaccinations = vaccinations.filter((vaccination) => {
    const animalName = vaccination.animals?.name?.toLowerCase() ?? '';
    const vaccineName = vaccination.vaccine_name.toLowerCase();
    const ownerName =
      vaccination.animals?.clients?.full_name?.toLowerCase() ?? '';

    return (
      animalName.includes(searchTerm.toLowerCase()) ||
      vaccineName.includes(searchTerm.toLowerCase()) ||
      ownerName.includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por animal, vacina ou dono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          onClick={openNewVaccinationModal}
          className="ml-4 flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Nova Vacinação
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Animal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Dono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Vacina
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                  Dose
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                  Aplicação
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                  Próxima
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredVaccinations.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Nenhuma vacinação encontrada
                  </td>
                </tr>
              )}

              {filteredVaccinations.map((vaccination) => (
                <tr
                  key={vaccination.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">
                    {vaccination.animals?.name}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600">
                    {vaccination.animals?.clients?.full_name ?? '-'}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600">
                    {vaccination.vaccine_name}
                  </td>

                  <td className="px-6 py-4 text-sm text-center text-slate-600">
                    {vaccination.dose_number ?? '-'}
                  </td>

                  <td className="px-6 py-4 text-sm text-center text-slate-600">
                    {vaccination.application_date}
                  </td>

                  <td className="px-6 py-4 text-sm text-center text-slate-600">
                    {vaccination.next_dose_date ?? '-'}
                  </td>

                  <td className="px-6 py-4 text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditVaccinationModal(vaccination)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {canDelete && (
                        <button
                          onClick={() => handleDelete(vaccination.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <VaccinationModal
          vaccination={selectedVaccination}
          onClose={() => setIsModalOpen(false)}
          onSaved={fetchVaccinations}
        />
      )}
    </div>
  );
}
