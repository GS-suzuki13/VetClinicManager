import { useEffect, useState } from 'react';
import { Syringe, FileText, Calendar, ScanLine } from 'lucide-react';
import { supabase, Animal, Client, Microchip } from '../lib/supabase';
import { formatDate, speciesLabel } from '../lib/format';
import { formatChipCode } from '../lib/microchip';
import Modal from './Modal';

type AnimalWithClient = Animal & { clients: Client };

interface AnimalProfileModalProps {
  animal: AnimalWithClient;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

const shortcuts = [
  { page: 'vaccinations', label: 'Vacinação', icon: Syringe, color: 'text-emerald-600' },
  { page: 'medical-records', label: 'Prontuários', icon: FileText, color: 'text-blue-600' },
  { page: 'appointments', label: 'Agendamentos', icon: Calendar, color: 'text-purple-600' },
  { page: 'microchips', label: 'Microchip', icon: ScanLine, color: 'text-slate-700' },
];

export default function AnimalProfileModal({ animal, onClose, onNavigate }: AnimalProfileModalProps) {
  // undefined = carregando; null = sem chip ativo.
  const [chip, setChip] = useState<Pick<Microchip, 'code' | 'external_registry'> | null | undefined>(undefined);

  useEffect(() => {
    supabase
      .from('microchips')
      .select('code, external_registry')
      .eq('animal_id', animal.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => setChip(data));
  }, [animal.id]);

  const info: [string, string][] = [
    ['Idade', `${animal.age} anos`],
    ['Peso', `${animal.weight} kg`],
    ['Data de nascimento', formatDate(animal.date_of_birth)],
    ['Espécie', speciesLabel[animal.species]],
  ];

  return (
    <Modal
      size="xl"
      onClose={onClose}
      title={
        <>
          {animal.name}
          <span className="block text-sm font-normal text-slate-500 mt-1">
            {speciesLabel[animal.species]} • {animal.breed} • Dono: {animal.clients.full_name}
          </span>
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-4 p-4 sm:p-6 text-sm text-slate-700">
        {info.map(([label, value]) => (
          <div key={label}>
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
        <div className="col-span-2">
          <dt className="text-slate-500">Microchip</dt>
          <dd className="font-medium">
            {chip === undefined ? (
              '...'
            ) : chip ? (
              <>
                <span className="font-mono tracking-wider">{formatChipCode(chip.code)}</span>
                {!chip.external_registry && <span className="ml-2 text-xs font-normal text-amber-600">registro externo pendente</span>}
              </>
            ) : (
              <span className="text-amber-600">Não microchipado</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-4 sm:px-6 sm:pb-6">
        {shortcuts.map(({ page, label, icon: Icon, color }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
          >
            <Icon className={`w-5 h-5 ${color}`} />
            {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
