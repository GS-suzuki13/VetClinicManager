import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase, Animal, Client, Microchip, MicrochipStatus } from '../lib/supabase';
import { dbErrorMessage, todayISO } from '../lib/format';
import {
  DEFAULT_IMPLANT_SITE,
  EXTERNAL_REGISTRIES,
  describeChipCode,
  microchipStatusLabel,
  normalizeChipCode,
} from '../lib/microchip';
import Modal, { FormActions, FormError, fieldClass, labelClass } from './Modal';

type AnimalOption = Pick<Animal, 'id' | 'name'> & { clients: Pick<Client, 'full_name'> | null };

interface Props {
  microchip: Microchip | null;
  // Valores iniciais para um cadastro novo (ex.: código lido no leitor, animal do perfil).
  initialCode?: string;
  initialAnimalId?: string;
  onClose: () => void;
  onSaved: (chip: Microchip) => void;
}

export default function MicrochipModal({ microchip, initialCode, initialAnimalId, onClose, onSaved }: Props) {
  const [animals, setAnimals] = useState<AnimalOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmScan, setConfirmScan] = useState(true);
  const [form, setForm] = useState(() => ({
    code: microchip?.code ?? initialCode ?? '',
    animal_id: microchip?.animal_id ?? initialAnimalId ?? '',
    status: microchip?.status ?? ('active' as MicrochipStatus),
    implanted_at: microchip ? microchip.implanted_at ?? '' : todayISO(),
    implant_site: microchip ? microchip.implant_site ?? '' : DEFAULT_IMPLANT_SITE,
    implanted_by: microchip?.implanted_by ?? '',
    manufacturer: microchip?.manufacturer ?? '',
    external_registry: microchip?.external_registry ?? '',
    external_registry_id: microchip?.external_registry_id ?? '',
    public_lookup: microchip?.public_lookup ?? false,
    notes: microchip?.notes ?? '',
  }));

  useEffect(() => {
    supabase
      .from('animals')
      .select('id, name, clients(full_name)')
      .order('name')
      .then(({ data }) => setAnimals((data as unknown as AnimalOption[]) ?? []));
  }, []);

  const info = describeChipCode(form.code);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!info.valid) {
      setError(info.warning ?? 'Código de microchip inválido.');
      return;
    }
    setBusy(true);
    setError(null);

    const payload = {
      code: normalizeChipCode(form.code),
      animal_id: form.animal_id || null,
      status: form.status,
      implanted_at: form.implanted_at || null,
      implant_site: form.implant_site.trim() || null,
      implanted_by: form.implanted_by.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      external_registry: form.external_registry || null,
      external_registry_id: form.external_registry_id.trim() || null,
      public_lookup: form.public_lookup,
      notes: form.notes.trim() || null,
    };

    const { data, error } = microchip
      ? await supabase.from('microchips').update(payload).eq('id', microchip.id).select().single()
      : await supabase.from('microchips').insert(payload).select().single();

    if (error || !data) {
      setBusy(false);
      setError(
        error?.code === '23505'
          ? 'Este código já está cadastrado nesta clínica, ou o animal já possui um chip ativo.'
          : dbErrorMessage(error, 'Não foi possível salvar o microchip.')
      );
      return;
    }

    // Boa prática: ler o chip após a implantação para confirmar o número.
    if (!microchip && confirmScan) {
      await supabase.from('microchip_events').insert({
        clinic_id: data.clinic_id,
        microchip_id: data.id,
        animal_id: data.animal_id,
        event_type: 'scanned',
        details: 'Leitura de confirmação após implantação/cadastro.',
      });
    }

    setBusy(false);
    // Fecha antes de notificar: quem chamou pode abrir outro modal em onSaved.
    onClose();
    onSaved(data);
  };

  return (
    <Modal title={microchip ? 'Editar Microchip' : 'Registrar Microchip'} onClose={onClose} size="xl">
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />

        <div>
          <label className={labelClass}>Número do microchip *</label>
          <input
            required
            autoFocus={!microchip && !initialCode}
            inputMode="text"
            autoComplete="off"
            value={form.code}
            onChange={set('code')}
            placeholder="Leia com o leitor ou digite os 15 dígitos"
            className={`${fieldClass} font-mono tracking-wider`}
          />
          {form.code && (
            <p className={`mt-1 flex items-start gap-1.5 text-xs ${info.valid ? (info.warning ? 'text-amber-700' : 'text-emerald-700') : 'text-red-600'}`}>
              {info.valid && !info.warning ? <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />}
              <span>
                {info.valid ? [info.format, info.origin].filter(Boolean).join(' • ') : 'Código inválido.'}
                {info.warning && ` ${info.warning}`}
              </span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Animal</label>
            <select value={form.animal_id} onChange={set('animal_id')} className={fieldClass}>
              <option value="">Sem vínculo (animal ainda não cadastrado)</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.clients ? ` — ${a.clients.full_name}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Status *</label>
            <select value={form.status} onChange={set('status')} className={fieldClass}>
              {Object.entries(microchipStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Data de implantação</label>
            <input type="date" value={form.implanted_at} onChange={set('implanted_at')} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Veterinário(a) responsável</label>
            <input value={form.implanted_by} onChange={set('implanted_by')} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Fabricante</label>
            <input value={form.manufacturer} onChange={set('manufacturer')} placeholder={info.origin?.startsWith('Fabricante') ? info.origin : ''} className={fieldClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Local de implantação</label>
          <input value={form.implant_site} onChange={set('implant_site')} className={fieldClass} />
        </div>

        <fieldset className="rounded-lg border border-slate-200 p-4 space-y-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Registro externo</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={form.external_registry} onChange={set('external_registry')} className={fieldClass} aria-label="Base de registro">
              <option value="">Não registrado</option>
              {EXTERNAL_REGISTRIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              value={form.external_registry_id}
              onChange={set('external_registry_id')}
              disabled={!form.external_registry}
              placeholder="Nº do registro / protocolo"
              className={fieldClass}
              aria-label="Número do registro"
            />
          </div>
          <p className="text-xs text-slate-500">
            O chip só guarda o número: para o animal ser identificado por terceiros, o tutor deve registrá-lo em uma base como o
            SinPatinhas (cadastro nacional gratuito pelo Gov.br).
          </p>
        </fieldset>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={form.public_lookup}
            onChange={(e) => setForm((prev) => ({ ...prev, public_lookup: e.target.checked }))}
            className="mt-1 h-4 w-4 accent-emerald-600"
          />
          <span className="text-sm">
            <span className="font-medium text-slate-800">Permitir localização por outras clínicas</span>
            <span className="block text-slate-500">
              Se o animal se perder, outra clínica do VetClinic que ler este chip verá apenas o nome desta clínica, para entrar em
              contato. Nenhum dado do tutor ou do animal é compartilhado. Requer consentimento do tutor.
            </span>
          </span>
        </label>

        <div>
          <label className={labelClass}>Observações</label>
          <textarea rows={2} value={form.notes} onChange={set('notes')} className={fieldClass} />
        </div>

        {!microchip && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={confirmScan} onChange={(e) => setConfirmScan(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
            Chip lido após a implantação e número conferido
          </label>
        )}

        <FormActions submitLabel={microchip ? 'Salvar alterações' : 'Registrar microchip'} onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}
