import { useState } from 'react';
import { supabase, Appointment, Animal, Client } from '../lib/supabase';
import { dbErrorMessage, formatDate, statusLabel, statusStyle } from '../lib/format';
import Modal, { FormError, fieldClass } from './Modal';

export type AppointmentWithDetails = Appointment & {
  clients: Client;
  animals: Animal;
};

interface Props {
  appointment: AppointmentWithDetails;
  onClose: () => void;
  onStatusUpdated: () => void;
}

export default function AppointmentDetailsModal({ appointment, onClose, onStatusUpdated }: Props) {
  const [newStatus, setNewStatus] = useState<Appointment['status'] | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeStatus = async () => {
    if (!newStatus) return;
    setBusy(true);
    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appointment.id);
    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível alterar o status.'));
      return;
    }
    onStatusUpdated();
    onClose();
  };

  const rows: [string, string][] = [
    ['Animal', appointment.animals?.name ?? '-'],
    ['Dono', appointment.clients?.full_name ?? '-'],
    ['Data', formatDate(appointment.appointment_date)],
    ['Hora', appointment.appointment_time.slice(0, 5)],
  ];

  return (
    <Modal title="Detalhes do Agendamento" onClose={onClose} size="md">
      <div className="p-4 sm:p-6 space-y-4 text-sm">
        <FormError message={error} />

        <dl className="grid grid-cols-2 gap-4">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-medium text-slate-800">{value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd>
              <span className={`inline-block mt-0.5 px-2 py-1 rounded-full text-xs font-medium ${statusStyle[appointment.status]}`}>
                {statusLabel[appointment.status]}
              </span>
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-slate-500">Motivo</dt>
            <dd className="text-slate-700 mt-1">{appointment.reason_for_visit || '—'}</dd>
          </div>
        </dl>

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <label className="block font-medium text-slate-700">Alterar status</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as Appointment['status'] | '')}
              className={fieldClass}
            >
              <option value="">Selecione</option>
              {Object.entries(statusLabel)
                .filter(([value]) => value !== appointment.status)
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
            <button
              onClick={changeStatus}
              disabled={!newStatus || busy}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-medium whitespace-nowrap"
            >
              {busy ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
