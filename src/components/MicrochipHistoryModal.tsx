import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Edit, ScanLine, StickyNote, Trash2 } from 'lucide-react';
import { supabase, Microchip, MicrochipEvent } from '../lib/supabase';
import { dbErrorMessage, formatDate } from '../lib/format';
import { describeChipCode, formatChipCode, microchipEventLabel, microchipStatusLabel, microchipStatusStyle } from '../lib/microchip';
import { canDeleteMicrochip, useClinic } from '../context/AuthContext';
import Modal, { FormError, fieldClass } from './Modal';
import { askConfirm } from '../lib/dialogs';

interface Props {
  microchip: Microchip;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => void;
}

export default function MicrochipHistoryModal({ microchip, onClose, onEdit, onChanged }: Props) {
  const canDelete = canDeleteMicrochip(useClinic().role);
  const [events, setEvents] = useState<MicrochipEvent[]>([]);
  const [animalNames, setAnimalNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [entryType, setEntryType] = useState<'scanned' | 'note'>('scanned');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('microchip_events')
      .select('*')
      .eq('microchip_id', microchip.id)
      .order('created_at', { ascending: false });
    if (error) console.error('Erro ao carregar histórico:', error);
    const list = (data as MicrochipEvent[]) ?? [];
    setEvents(list);

    // O histórico guarda só o id do animal (sobrevive à exclusão); resolve os nomes que ainda existem.
    const ids = [...new Set(list.map((e) => e.animal_id).filter((id): id is string => !!id))];
    if (ids.length) {
      const { data: animals } = await supabase.from('animals').select('id, name').in('id', ids);
      setAnimalNames(Object.fromEntries((animals ?? []).map((a) => [a.id, a.name])));
    }
    setLoading(false);
  }, [microchip.id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const addEntry = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('microchip_events').insert({
      clinic_id: microchip.clinic_id,
      microchip_id: microchip.id,
      animal_id: microchip.animal_id,
      event_type: entryType,
      details: details.trim() || (entryType === 'scanned' ? 'Chip lido e número conferido.' : null),
    });
    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível registrar.'));
      return;
    }
    setDetails('');
    loadEvents();
  };

  const handleDelete = async () => {
    if (!(await askConfirm('Excluir este microchip e TODO o seu histórico? Para chips removidos ou com defeito, prefira alterar o status.', { danger: true, title: 'Excluir', confirmLabel: 'Excluir' }))) return;
    const { error } = await supabase.from('microchips').delete().eq('id', microchip.id);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível excluir.'));
      return;
    }
    onChanged();
    onClose();
  };

  const describeEvent = (ev: MicrochipEvent) => {
    const animal = (id: string | null) => (id ? animalNames[id] ?? 'animal excluído' : '');
    switch (ev.event_type) {
      case 'status_changed':
        return `${microchipStatusLabel[ev.old_value as Microchip['status']] ?? ev.old_value} → ${
          microchipStatusLabel[ev.new_value as Microchip['status']] ?? ev.new_value
        }`;
      case 'linked':
      case 'unlinked':
        return animal(ev.animal_id);
      case 'code_changed':
        return `${ev.old_value} → ${ev.new_value}`;
      case 'external_registry':
        return ev.new_value ?? 'Registro removido';
      default:
        return ev.details ?? '';
    }
  };

  const info = describeChipCode(microchip.code);
  const facts: [string, string][] = [
    ['Formato', [info.format, info.origin].filter(Boolean).join(' • ') || '-'],
    ['Implantação', microchip.implanted_at ? formatDate(microchip.implanted_at) : '-'],
    ['Local', microchip.implant_site ?? '-'],
    ['Responsável', microchip.implanted_by ?? '-'],
    ['Fabricante', microchip.manufacturer ?? '-'],
    ['Registro externo', [microchip.external_registry, microchip.external_registry_id].filter(Boolean).join(' • ') || 'Não registrado'],
  ];

  return (
    <Modal
      size="xl"
      onClose={onClose}
      title={
        <>
          <span className="font-mono tracking-wider">{formatChipCode(microchip.code)}</span>
          <span className={`ml-2 align-middle inline-block px-2 py-0.5 rounded-full text-xs font-medium ${microchipStatusStyle[microchip.status]}`}>
            {microchipStatusLabel[microchip.status]}
          </span>
        </>
      }
    >
      <div className="p-4 sm:p-6 space-y-6">
        <FormError message={error} />

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-medium text-slate-800 break-words">{value}</dd>
            </div>
          ))}
          {microchip.notes && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Observações</dt>
              <dd className="text-slate-700 break-words">{microchip.notes}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap gap-2">
          <button onClick={onEdit} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium">
            <Edit className="w-4 h-4 text-blue-600" /> Editar dados / status
          </button>
          {canDelete && (
            <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm font-medium">
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          )}
        </div>

        <form onSubmit={addEntry} className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
          <div className="flex gap-2">
            {(['scanned', 'note'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setEntryType(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  entryType === type ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {type === 'scanned' ? <ScanLine className="w-4 h-4" /> : <StickyNote className="w-4 h-4" />}
                {type === 'scanned' ? 'Registrar leitura' : 'Anotação'}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              required={entryType === 'note'}
              maxLength={2000}
              placeholder={entryType === 'scanned' ? 'Opcional: ex. lido na consulta de rotina, chip migrou para o ombro' : 'Escreva a anotação'}
              className={fieldClass}
            />
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-medium whitespace-nowrap"
            >
              Registrar
            </button>
          </div>
        </form>

        <section>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Histórico</h4>
          {loading ? (
            <div className="h-24 animate-pulse bg-slate-100 rounded-lg" />
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-500">Sem eventos.</p>
          ) : (
            <ol className="relative border-l-2 border-slate-200 ml-2 space-y-4">
              {events.map((ev) => (
                <li key={ev.id} className="ml-4">
                  <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white" />
                  <p className="text-sm font-medium text-slate-800">
                    {microchipEventLabel[ev.event_type]}
                    {describeEvent(ev) && <span className="font-normal text-slate-600"> — {describeEvent(ev)}</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(ev.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {ev.performed_by_email && ` • ${ev.performed_by_email}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Modal>
  );
}
