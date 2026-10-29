import { FormEvent, useState } from 'react';
import { supabase, VaccineGroup, VaccineProtocol } from '../lib/supabase';
import { dbErrorMessage } from '../lib/format';
import { vaccineGroupLabel } from '../lib/vaccines';
import Modal, { FormActions, FormError, fieldClass, labelClass } from './Modal';

interface Props {
  protocol: VaccineProtocol | null;
  protocols: VaccineProtocol[];
  onClose: () => void;
  onSaved: () => void;
}

export default function VaccineProtocolModal({ protocol, protocols, onClose, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    name: protocol?.name ?? '',
    vaccine_group: protocol?.vaccine_group ?? ('vaccine' as VaccineGroup),
    species: protocol?.species ?? '',
    doses: String(protocol?.doses ?? 1),
    interval_days: String(protocol?.interval_days ?? 21),
    booster_days: protocol?.booster_days?.toString() ?? '365',
    next_protocol_id: protocol?.next_protocol_id ?? '',
    manufacturer: protocol?.manufacturer ?? '',
    active: protocol?.active ?? true,
  }));

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      vaccine_group: form.vaccine_group,
      species: form.species || null,
      doses: Number(form.doses),
      interval_days: Number(form.interval_days),
      // Encadear e reforçar são alternativas: o reforço recorrente tem prioridade.
      booster_days: form.booster_days ? Number(form.booster_days) : null,
      next_protocol_id: form.booster_days ? null : form.next_protocol_id || null,
      manufacturer: form.manufacturer.trim() || null,
      active: form.active,
    };
    const { error } = protocol
      ? await supabase.from('vaccine_protocols').update(payload).eq('id', protocol.id)
      : await supabase.from('vaccine_protocols').insert(payload);
    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível salvar o protocolo.'));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal title={protocol ? 'Editar protocolo' : 'Novo protocolo'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome *</label>
            <input required maxLength={120} value={form.name} onChange={set('name')} className={fieldClass} placeholder="Ex.: V10 filhote" />
          </div>
          <div>
            <label className={labelClass}>Grupo</label>
            <select value={form.vaccine_group} onChange={set('vaccine_group')} className={fieldClass}>
              {Object.entries(vaccineGroupLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Espécie</label>
            <select value={form.species} onChange={set('species')} className={fieldClass}>
              <option value="">Cães e gatos</option>
              <option value="Dog">Cães</option>
              <option value="Cat">Gatos</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Doses na série *</label>
            <input type="number" required min="1" max="20" value={form.doses} onChange={set('doses')} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Intervalo entre doses (dias) *</label>
            <input type="number" required min="1" max="3650" value={form.interval_days} onChange={set('interval_days')} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Reforço recorrente (dias)</label>
            <input type="number" min="1" max="3650" value={form.booster_days} onChange={set('booster_days')} className={fieldClass} placeholder="Vazio = sem reforço" />
            <p className="text-xs text-slate-500 mt-1">Ex.: 365 para reforço anual. Cada reforço aplicado programa o próximo.</p>
          </div>
          <div>
            <label className={labelClass}>Ao terminar, iniciar protocolo</label>
            <select value={form.next_protocol_id} onChange={set('next_protocol_id')} className={fieldClass} disabled={!!form.booster_days}>
              <option value="">Nenhum</option>
              {protocols
                .filter((p) => p.id !== protocol?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">Disponível quando não há reforço recorrente.</p>
          </div>
          <div>
            <label className={labelClass}>Fabricante</label>
            <input maxLength={120} value={form.manufacturer} onChange={set('manufacturer')} className={fieldClass} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:mt-7">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Protocolo ativo
          </label>
        </div>

        <FormActions submitLabel={protocol ? 'Atualizar' : 'Criar protocolo'} onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}
