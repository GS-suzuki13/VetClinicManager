import { X, Syringe, FileText, Calendar } from 'lucide-react';
import { Animal, Client } from '../lib/supabase';

type AnimalWithClient = Animal & { clients: Client };

interface AnimalProfileModalProps {
  animal: AnimalWithClient;
  onClose: () => void;
  onOpenVaccines: () => void;
  onOpenMedicalRecords: () => void;
  onOpenAppointments: () => void;
}

export default function AnimalProfileModal({
  animal,
  onClose,
  onOpenVaccines,
  onOpenMedicalRecords,
  onOpenAppointments,
}: AnimalProfileModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-xl overflow-hidden">
        
        {/* HEADER */}
        <div className="flex justify-between items-start p-6 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">
              {animal.name}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {animal.species === 'Dog' ? 'Cachorro' : 'Gato'} • {animal.breed}
            </p>
            <p className="text-sm text-slate-500">
              Dono: <span className="font-medium">{animal.clients.full_name}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* INFO GRID */}
        <div className="grid grid-cols-2 gap-4 p-6 text-sm text-slate-700">
          <div>
            <span className="text-slate-500">Idade</span>
            <p className="font-medium">{animal.age} anos</p>
          </div>

          <div>
            <span className="text-slate-500">Peso</span>
            <p className="font-medium">{animal.weight} kg</p>
          </div>

          <div>
            <span className="text-slate-500">Data de nascimento</span>
            <p className="font-medium">{animal.date_of_birth}</p>
          </div>

          <div>
            <span className="text-slate-500">Espécie</span>
            <p className="font-medium">
              {animal.species === 'Dog' ? 'Cachorro' : 'Gato'}
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-between gap-4 px-6 pb-6">
          <button
            onClick={onOpenVaccines}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Syringe className="w-5 h-5 text-emerald-600" />
            Vacinação
          </button>

          <button
            onClick={onOpenMedicalRecords}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-5 h-5 text-blue-600" />
            Prontuários
          </button>

          <button
            onClick={onOpenAppointments}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Calendar className="w-5 h-5 text-purple-600" />
            Agendamentos
          </button>
        </div>
      </div>
    </div>
  );
}
