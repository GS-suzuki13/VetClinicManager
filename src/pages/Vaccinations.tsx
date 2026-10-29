import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { supabase, Vaccination, Animal, Client, VaccineProtocol } from '../lib/supabase';
import { dbErrorMessage, formatDate, todayISO, toISODate } from '../lib/format';
import VaccinationModal from '../components/VaccinationModal';
import VaccineProtocolModal from '../components/VaccineProtocolModal';
import VaccineSchedule from '../components/VaccineSchedule';
import { DoseWithDetails, doseSelect, vaccineGroupLabel } from '../lib/vaccines';
import PageToolbar, { IconButton, PageLoader, tdClass, thClass } from '../components/PageToolbar';
import { canDeleteClinicalData, useClinic } from '../context/AuthContext';
import { askConfirm, notify } from '../lib/dialogs';

interface VaccinationWithAnimal extends Vaccination {
  animals: Pick<Animal, 'id' | 'name' | 'species'> & {
    clients?: Pick<Client, 'id' | 'full_name'>;
  };
}

type Tab = 'schedule' | 'applied' | 'protocols';
type DueWindow = 'late' | '7' | '30' | 'all';

export default function Vaccinations({ onOpenRecord }: { onOpenRecord: (animalId: string) => void }) {
  const canDelete = canDeleteClinicalData(useClinic().role);
  const [tab, setTab] = useState<Tab>('schedule');
  const [dueWindow, setDueWindow] = useState<DueWindow>('7');
  const [doses, setDoses] = useState<DoseWithDetails[]>([]);
  const [protocols, setProtocols] = useState<VaccineProtocol[]>([]);
  const [protocolModal, setProtocolModal] = useState<{ protocol: VaccineProtocol | null } | null>(null);
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

    const [d, p] = await Promise.all([
      supabase.from('vaccine_doses').select(doseSelect).eq('status', 'scheduled').order('due_date'),
      supabase.from('vaccine_protocols').select('*').order('name'),
    ]);
    if (d.error) console.error('Erro ao carregar a programação de vacinas:', d.error);
    setDoses((d.data as DoseWithDetails[]) ?? []);
    setProtocols(p.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVaccinations();
  }, [fetchVaccinations]);

  const handleDelete = async (id: string) => {
    if (!(await askConfirm('Tem certeza que deseja excluir este registro de vacinação?', { danger: true, title: 'Excluir', confirmLabel: 'Excluir' }))) return;
    const { error } = await supabase.from('animal_vaccinations').delete().eq('id', id);
    if (error) notify(dbErrorMessage(error, 'Erro ao excluir a vacinação.'));
    else fetchVaccinations();
  };

  const term = searchTerm.toLowerCase();
  const filteredVaccinations = vaccinations.filter((v) =>
    [v.animals?.name, v.vaccine_name, v.animals?.clients?.full_name].some((s) => s?.toLowerCase().includes(term))
  );

  if (loading) return <PageLoader />;

  const editing = modal?.vaccination;
  const today = todayISO();
  const limit = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toISODate(d);
  };
  const lateCount = doses.filter((d) => d.due_date < today).length;
  const visibleDoses = doses
    .filter((d) => (dueWindow === 'late' ? d.due_date < today : dueWindow === 'all' ? true : d.due_date <= limit(Number(dueWindow))))
    .filter((d) => [d.vaccine_protocols.name, d.animals?.name, d.animals?.clients?.full_name].some((x) => x?.toLowerCase().includes(term)));

  const tabs: [Tab, string][] = [
    ['schedule', `Programação${lateCount ? ` (${lateCount} atrasada${lateCount > 1 ? 's' : ''})` : ''}`],
    ['applied', 'Aplicadas'],
    ['protocols', 'Protocolos'],
  ];

  return (
    <div>
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === id ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        <>
          <PageToolbar
            search={searchTerm}
            onSearch={setSearchTerm}
            placeholder="Buscar por animal, vacina ou dono..."
            actionLabel="Nova Vacinação"
            onAction={() => setModal({ vaccination: null })}
          >
            <select
              value={dueWindow}
              onChange={(e) => setDueWindow(e.target.value as DueWindow)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="late">Atrasadas</option>
              <option value="7">Até 7 dias</option>
              <option value="30">Até 30 dias</option>
              <option value="all">Todas as programadas</option>
            </select>
          </PageToolbar>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 sm:px-6">
            <VaccineSchedule
              doses={visibleDoses}
              showAnimal
              onChanged={fetchVaccinations}
              onOpenRecord={onOpenRecord}
              emptyText="Nenhuma dose programada neste período. Aplique protocolos pela ficha do animal."
            />
          </div>
        </>
      )}

      {tab === 'protocols' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <p className="text-sm text-slate-600">Protocolos definem doses, intervalos e reforços. Aplique-os na ficha do animal para programar as datas.</p>
            <button
              onClick={() => setProtocolModal({ protocol: null })}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium whitespace-nowrap"
            >
              Novo protocolo
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={thClass}>Protocolo</th>
                    <th className={`${thClass} hidden sm:table-cell`}>Grupo</th>
                    <th className={thClass}>Esquema</th>
                    <th className={`${thClass} hidden md:table-cell`}>Depois</th>
                    <th className={`${thClass} text-right`}>Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {protocols.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        Nenhum protocolo. Crie o primeiro (ex.: V10 filhote, 3 doses a cada 21 dias).
                      </td>
                    </tr>
                  )}
                  {protocols.map((p) => (
                    <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                      <td className={`${tdClass} font-medium text-slate-800`}>
                        {p.name}
                        {p.species && <span className="ml-2 text-xs font-normal text-slate-500">{p.species === 'Dog' ? 'Cães' : 'Gatos'}</span>}
                      </td>
                      <td className={`${tdClass} text-slate-600 hidden sm:table-cell`}>{vaccineGroupLabel[p.vaccine_group]}</td>
                      <td className={`${tdClass} text-slate-600`}>
                        {p.doses} dose{p.doses > 1 ? 's' : ''}
                        {p.doses > 1 && ` a cada ${p.interval_days} dias`}
                      </td>
                      <td className={`${tdClass} text-slate-600 hidden md:table-cell`}>
                        {p.booster_days
                          ? `Reforço a cada ${p.booster_days} dias`
                          : p.next_protocol_id
                            ? `Inicia ${protocols.find((x) => x.id === p.next_protocol_id)?.name ?? 'outro protocolo'}`
                            : 'Finaliza'}
                      </td>
                      <td className={tdClass}>
                        <div className="flex justify-end">
                          <IconButton tone="blue" title="Editar" onClick={() => setProtocolModal({ protocol: p })}>
                            <Pencil className="w-4 h-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'applied' && (
        <>
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
        </>
      )}

      {protocolModal && (
        <VaccineProtocolModal
          protocol={protocolModal.protocol}
          protocols={protocols}
          onClose={() => setProtocolModal(null)}
          onSaved={fetchVaccinations}
        />
      )}

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
