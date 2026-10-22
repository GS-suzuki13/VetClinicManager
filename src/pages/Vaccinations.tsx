import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { supabase, Vaccination, Animal, Client } from '../lib/supabase';
import { dbErrorMessage, formatDate } from '../lib/format';
import VaccinationModal from '../components/VaccinationModal';
import PageToolbar, { IconButton, PageLoader, tdClass, thClass } from '../components/PageToolbar';
import { canDeleteClinicalData, useClinic } from '../context/AuthContext';

interface VaccinationWithAnimal extends Vaccination {
  animals: Pick<Animal, 'id' | 'name' | 'species'> & {
    clients?: Pick<Client, 'id' | 'full_name'>;
  };
}

export default function Vaccinations() {
  const canDelete = canDeleteClinicalData(useClinic().role);
  const [vaccinations, setVaccinations] = useState<VaccinationWithAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState<{ vaccination: VaccinationWithAnimal | null } | null>(null);

  const fetchVaccinations = useCallback(async () => {
    const { data, error } = await supabase
      .from('animal_vaccinations')
      .select('*, animals (id, name, species, clients (id, full_name))')
      .order('application_date', { ascending: false });
    if (error) console.error('Erro ao carregar vacinações:', error);
    setVaccinations((data as VaccinationWithAnimal[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVaccinations();
  }, [fetchVaccinations]);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro de vacinação?')) return;
    const { error } = await supabase.from('animal_vaccinations').delete().eq('id', id);
    if (error) alert(dbErrorMessage(error, 'Erro ao excluir a vacinação.'));
    else fetchVaccinations();
  };

  const term = searchTerm.toLowerCase();
  const filteredVaccinations = vaccinations.filter((v) =>
    [v.animals?.name, v.vaccine_name, v.animals?.clients?.full_name].some((s) => s?.toLowerCase().includes(term))
  );

  if (loading) return <PageLoader />;

  const editing = modal?.vaccination;

  return (
    <div>
      <PageToolbar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Buscar por animal, vacina ou dono..."
        actionLabel="Nova Vacinação"
        onAction={() => setModal({ vaccination: null })}
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={thClass}>Animal</th>
                <th className={`${thClass} hidden md:table-cell`}>Dono</th>
                <th className={`${thClass} hidden sm:table-cell`}>Vacina</th>
                <th className={`${thClass} hidden lg:table-cell text-center`}>Dose</th>
                <th className={`${thClass} hidden md:table-cell text-center`}>Aplicação</th>
                <th className={`${thClass} text-center`}>Próxima</th>
                <th className={`${thClass} text-right`}>Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredVaccinations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma vacinação encontrada
                  </td>
                </tr>
              )}

              {filteredVaccinations.map((vaccination) => (
                <tr key={vaccination.id} className="hover:bg-slate-50 transition-colors">
                  <td className={`${tdClass} font-medium text-slate-800`}>
                    {vaccination.animals?.name}
                    <span className="block sm:hidden text-xs font-normal text-slate-500">{vaccination.vaccine_name}</span>
                  </td>
                  <td className={`${tdClass} text-slate-600 hidden md:table-cell`}>{vaccination.animals?.clients?.full_name ?? '-'}</td>
                  <td className={`${tdClass} text-slate-600 hidden sm:table-cell`}>{vaccination.vaccine_name}</td>
                  <td className={`${tdClass} text-center text-slate-600 hidden lg:table-cell`}>
                    {vaccination.dose_number ?? '-'}
                    {vaccination.total_doses ? `/${vaccination.total_doses}` : ''}
                  </td>
                  <td className={`${tdClass} text-center text-slate-600 hidden md:table-cell`}>{formatDate(vaccination.application_date)}</td>
                  <td className={`${tdClass} text-center text-slate-600`}>{formatDate(vaccination.next_dose_date)}</td>
                  <td className={tdClass}>
                    <div className="flex justify-end gap-1">
                      <IconButton tone="blue" title="Editar" onClick={() => setModal({ vaccination })}>
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                      {canDelete && (
                        <IconButton tone="red" title="Excluir" onClick={() => handleDelete(vaccination.id)}>
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <VaccinationModal
          vaccination={editing ? { ...editing, clientId: editing.animals?.clients?.id } : null}
          onClose={() => setModal(null)}
          onSaved={fetchVaccinations}
        />
      )}
    </div>
  );
}
