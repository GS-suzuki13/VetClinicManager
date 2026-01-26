import { X, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { supabase, Appointment, Animal, Client } from '../lib/supabase';

type AppointmentWithDetails = Appointment & {
  clients: Client;
  animals: Animal;
};


const STATUS_LABELS = {
  Scheduled: 'Agendado',
  Completed: 'Concluído',
  Cancelled: 'Cancelado',
};

const STATUS_STYLES = {
  Scheduled: 'bg-emerald-100 text-emerald-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
};
        
interface Props {
  appointment: AppointmentWithDetails | null;
  onClose: () => void;
  onStatusUpdated: () => void;
}

export default function AppointmentDetailsModal({
  appointment,
  onClose,
  onStatusUpdated,
}: Props) {
  const [newStatus, setNewStatus] = useState<Appointment['status'] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!appointment) return null;

  const confirmChangeStatus = async () => {
    if (!newStatus) return;

    setLoading(true);

    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', appointment.id);

    setLoading(false);

    if (!error) {
      setConfirming(false);
      setNewStatus(null);
      onStatusUpdated();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg font-semibold">Detalhes do Agendamento</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-4 text-sm">
          <div>
            <strong>Animal:</strong> {appointment.animals?.name}
          </div>

          <div>
            <strong>Dono:</strong> {appointment.clients?.full_name}
          </div>

          <div>
            <strong>Data:</strong> {appointment.appointment_date}
          </div>

          <div>
            <strong>Hora:</strong> {appointment.appointment_time}
          </div>

          <div>
            <strong>Status:</strong>{' '}
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[appointment.status]}`}
            >
              {STATUS_LABELS[appointment.status]}
            </span>
          </div>

          <div>
            <strong>Motivo:</strong>
            <p className="text-slate-600 mt-1">
              {appointment.reason_for_visit || '—'}
            </p>
          </div>

          {/* Alterar status */}
          <div className="pt-4 border-t space-y-3">
            <label className="text-sm font-medium">Alterar status</label>

            <select
              value={newStatus ?? ''}
              onChange={(e) =>
                setNewStatus(e.target.value as Appointment['status'])
              }
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Selecione</option>
              <option value="Scheduled">Agendado</option>
              <option value="Completed">Concluído</option>
              <option value="Cancelled">Cancelado</option>
            </select>

            {newStatus && (
              <button
                onClick={() => setConfirming(true)}
                className="w-full bg-emerald-600 text-white py-2 rounded-lg"
              >
                Confirmar alteração
              </button>
            )}
          </div>
        </div>

        {/* Confirmação */}
        {confirming && (
          <div className="p-6 border-t bg-slate-50 space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={18} />
              <strong>Confirmação necessária</strong>
            </div>

            <p className="text-sm text-slate-600">
              Alterar status para{' '}
              <strong>{STATUS_LABELS[newStatus!]}</strong>?  
              Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 border rounded-lg py-2"
              >
                Cancelar
              </button>

              <button
                disabled={loading}
                onClick={confirmChangeStatus}
                className="flex-1 bg-red-600 text-white rounded-lg py-2"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
