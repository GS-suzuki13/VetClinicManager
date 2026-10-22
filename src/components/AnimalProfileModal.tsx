import { Syringe, FileText, Calendar } from 'lucide-react';
import { Animal, Client } from '../lib/supabase';
import { formatDate, speciesLabel } from '../lib/format';
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
];

export default function AnimalProfileModal({ animal, onClose, onNavigate }: AnimalProfileModalProps) {
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
      </dl>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pb-4 sm:px-6 sm:pb-6">
        {shortcuts.map(({ page, label, icon: Icon, color }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Icon className={`w-5 h-5 ${color}`} />
            {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
