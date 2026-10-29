import { FormEvent, useEffect, useState } from 'react';
import { CircleSlash, Syringe } from 'lucide-react';
import { supabase, Animal, VaccineDose, VaccineProtocol } from '../lib/supabase';
import { dbErrorMessage, formatDate, todayISO } from '../lib/format';
import { DoseWithDetails, doseLabel } from '../lib/vaccines';
import Modal, { FormActions, FormError, fieldClass, labelClass } from './Modal';
import { askConfirm, notify } from '../lib/dialogs';

function doseStatus(dose: VaccineDose, today = todayISO()) {
  if (dose.status === 'applied') return { label: 'Aplicada', style: 'bg-green-100 text-green-700' };
  if (dose.status === 'skipped') return { label: 'Interrompida', style: 'bg-slate-100 text-slate-500' };
  if (dose.due_date < today) return { label: 'Atrasada', style: 'bg-red-100 text-red-700' };
  return { label: 'Programada', style: 'bg-blue-100 text-blue-700' };
}

interface ScheduleProps {
  doses: DoseWithDetails[];
  showAnimal?: boolean;
  onChanged: () => void;
  onOpenRecord?: (animalId: string) => void;
  emptyText: string;
}

// Lista de doses (na ficha do animal ou na programação geral da clínica).
export default function VaccineSchedule({ doses, showAnimal, onChanged, onOpenRecord, emptyText }: ScheduleProps) {
  const [applying, setApplying] = useState<DoseWithDetails | null>(null);

  const stopSeries = async (dose: DoseWithDetails) => {
    if (!(await askConfirm(`Interromper o protocolo ${dose.vaccine_protocols.name}? As doses pendentes serão canceladas.`, { danger: true, confirmLabel: 'Interromper' }))) return;
    const { error } = await supabase.rpc('stop_vaccine_protocol', { p_series_id: dose.series_id });
    if (error) notify(dbErrorMessage(error, 'Não foi possível interromper o protocolo.'));
    else onChanged();
  };

  if (doses.length === 0) return <p className="text-center text-slate-500 py-8 text-sm">{emptyText}</p>;

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {doses.map((dose) => {
          const status = doseStatus(dose);
          return (
            <li key={dose.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="w-24 shrink-0">
                <p className={`font-semibold ${status.label === 'Atrasada' ? 'text-red-600' : 'text-slate-800'}`}>{formatDate(dose.due_date)}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.style}`}>{status.label}</span>
              </div>
              <div className="flex-1 min-w-[10rem]">
                <p className="font-medium text-slate-800">{dose.vaccine_protocols.name}</p>
                <p className="text-slate-500">
                  {doseLabel(dose)}
                  {showAnimal && dose.animals && (
                    <>
                      {' • '}
                      {onOpenRecord ? (
                        <button onClick={() => onOpenRecord(dose.animals!.id)} className="text-emerald-700 hover:underline">
                          {dose.animals.name}
                        </button>
                      ) : (
                        dose.animals.name
                      )}
                      {dose.animals.clients && <> ({dose.animals.clients.full_name})</>}
                    </>
                  )}
                </p>
              </div>
              {dose.status === 'scheduled' && (
                <div className="flex gap-2">
                  <button onClick={() => setApplying(dose)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600">
                    <Syringe className="w-4 h-4" />
                    Aplicar
                  </button>
                  {!showAnimal && (
                    <button onClick={() => stopSeries(dose)} title="Interromper protocolo" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <CircleSlash className="w-4 h-4" />
                      Interromper
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {applying && <ApplyDoseModal dose={applying} onClose={() => setApplying(null)} onSaved={onChanged} />}
    </>
  );
}

function ApplyDoseModal({ dose, onClose, onSaved }: { dose: DoseWithDetails; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ date: todayISO(), vet: '', notes: '' });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('apply_vaccine_dose', {
      p_dose_id: dose.id,
      p_application_date: form.date,
      p_veterinarian_name: form.vet,
      p_notes: form.notes,
    });
    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível registrar a aplicação.'));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal title={`Aplicar ${dose.vaccine_protocols.name} • ${doseLabel(dose)}`} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Data de aplicação *</label>
            <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Veterinário(a)</label>
            <input value={form.vet} onChange={(e) => setForm({ ...form, vet: e.target.value })} className={fieldClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Observações (lote, reações...)</label>
          <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={fieldClass} />
        </div>
        <p className="text-xs text-slate-500">A vacina entra no histórico do animal e a próxima dose (ou o reforço) é programada automaticamente.</p>
        <FormActions submitLabel="Registrar aplicação" onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}

export function ApplyProtocolModal({ animal, onClose, onSaved }: { animal: Pick<Animal, 'id' | 'name' | 'species'>; onClose: () => void; onSaved: () => void }) {
  const [protocols, setProtocols] = useState<VaccineProtocol[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ protocol_id: '', start: todayISO() });

  useEffect(() => {
    supabase
      .from('vaccine_protocols')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setProtocols((data ?? []).filter((p) => !p.species || p.species === animal.species)));
  }, [animal.species]);

  const selected = protocols.find((p) => p.id === form.protocol_id);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('apply_vaccine_protocol', { p_animal_id: animal.id, p_protocol_id: form.protocol_id, p_start: form.start });
    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível aplicar o protocolo.'));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal title={`Aplicar protocolo • ${animal.name}`} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />
        <div>
          <label className={labelClass}>Protocolo *</label>
          <select required value={form.protocol_id} onChange={(e) => setForm({ ...form, protocol_id: e.target.value })} className={fieldClass}>
            <option value="">{protocols.length ? 'Selecione' : 'Nenhum protocolo cadastrado (menu Vacinas > Protocolos)'}</option>
            {protocols.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Data da 1ª dose *</label>
          <input type="date" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={fieldClass} />
        </div>
        {selected && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
            {selected.doses} dose(s) a cada {selected.interval_days} dias
            {selected.booster_days ? `, depois reforço a cada ${selected.booster_days} dias` : ''}. Todas as datas são programadas agora e aparecem
            nos lembretes.
          </p>
        )}
        <FormActions submitLabel="Programar doses" onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}
