import { useCallback, useEffect, useState } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { supabase, Animal, Client } from '../lib/supabase';
import { dbErrorMessage, speciesLabel } from '../lib/format';
import PageToolbar, { IconButton, PageLoader, tdClass, thClass } from '../components/PageToolbar';
import { canDeleteClinicalData, useClinic } from '../context/AuthContext';
import { useAnimalsModal } from '../context/AnimalsModalContext';
import { askConfirm, notify } from '../lib/dialogs';

type AnimalWithClient = Animal & { clients: Client };

export default function Animals({ onOpenRecord }: { onOpenRecord: (animalId: string) => void }) {
  const canDelete = canDeleteClinicalData(useClinic().role);
  const { openModal, savedVersion } = useAnimalsModal();
  const [animals, setAnimals] = useState<AnimalWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadAnimals = useCallback(async () => {
    const { data, error } = await supabase.from('animals').select('*, clients(*)').order('created_at', { ascending: false });
    if (error) console.error('Erro ao carregar animais:', error);
    setAnimals(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAnimals();
  }, [loadAnimals, savedVersion]);

  const handleDelete = async (id: string) => {
    if (!(await askConfirm('Tem certeza de que deseja excluir este animal? Isso também excluirá prontuários, vacinas e agendamentos associados.', { danger: true, title: 'Excluir', confirmLabel: 'Excluir' }))) {
      return;
    }
    const { error } = await supabase.from('animals').delete().eq('id', id);
    if (error) notify(dbErrorMessage(error, 'Erro ao excluir o animal.'));
    else loadAnimals();
  };

  const term = searchTerm.toLowerCase();
  const filteredAnimals = animals.filter(
    (animal) =>
      animal.name.toLowerCase().includes(term) ||
      animal.breed.toLowerCase().includes(term) ||
      animal.clients.full_name.toLowerCase().includes(term)
  );

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageToolbar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Procure por nome, raça ou dono..."
        actionLabel="Adicionar Animal"
        onAction={() => openModal()}
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={thClass}>Nome</th>
                <th className={`${thClass} hidden sm:table-cell`}>Espécie</th>
                <th className={`${thClass} hidden md:table-cell`}>Raça</th>
                <th className={`${thClass} hidden lg:table-cell`}>Idade</th>
                <th className={`${thClass} hidden md:table-cell`}>Dono</th>
                <th className={`${thClass} text-right`}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAnimals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Nenhum animal encontrado. Clique em "Adicionar Animal" para registrar seu primeiro animal.
                  </td>
                </tr>
              ) : (
                filteredAnimals.map((animal) => (
                  <tr
                    key={animal.id}
                    onClick={() => onOpenRecord(animal.id)}
                    title="Abrir ficha do animal"
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className={`${tdClass} font-medium text-slate-800`}>
                      {animal.name}
                      <span className="block md:hidden text-xs font-normal text-slate-500">
                        {speciesLabel[animal.species]} • {animal.clients.full_name}
                      </span>
                    </td>
                    <td className={`${tdClass} hidden sm:table-cell`}>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          animal.species === 'Dog' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {speciesLabel[animal.species]}
                      </span>
                    </td>
                    <td className={`${tdClass} text-slate-600 hidden md:table-cell`}>{animal.breed}</td>
                    <td className={`${tdClass} text-slate-600 hidden lg:table-cell`}>{animal.age} anos</td>
                    <td className={`${tdClass} text-slate-600 hidden md:table-cell`}>{animal.clients.full_name}</td>
                    <td className={tdClass}>
                      <div className="flex justify-end gap-1">
                        <IconButton
                          tone="blue"
                          title="Editar"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(animal);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </IconButton>
                        {canDelete && (
                          <IconButton
                            tone="red"
                            title="Excluir"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(animal.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
