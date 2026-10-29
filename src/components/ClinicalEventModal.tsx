import { FormEvent, useState } from 'react';
import { Printer } from 'lucide-react';
import { supabase, Animal, Client, ClinicalEvent, ClinicalEventType, Vaccination } from '../lib/supabase';
import { appendText, dbErrorMessage, formatDate, speciesLabel, toISODate } from '../lib/format';
import { formatAge, kindMeta, vitalRanges } from '../lib/clinicalTimeline';
import { printClinicalDocument } from '../lib/print';
import { useClinic } from '../context/AuthContext';
import Modal, { FormActions, FormError, fieldClass, labelClass } from './Modal';
import DictationButton from './DictationButton';

export type AnimalWithClient = Animal & { clients: Client };

interface Props {
  type: ClinicalEventType;
  event: ClinicalEvent | null;
  animal: AnimalWithClient;
  // Usadas nos modelos de documento (ex.: atestado de vacinação).
  vaccinations: Vaccination[];
  onClose: () => void;
  onSaved: () => void;
}

const titleLabels: Partial<Record<ClinicalEventType, string>> = {
  pathology: 'Patologia / diagnóstico',
  exam: 'Exame',
  prescription: 'Título',
  document: 'Título do documento',
  note: 'Resumo',
  alert: 'Alerta (ex.: alérgico a dipirona, agressivo ao manejo)',
};

const contentLabels: Partial<Record<ClinicalEventType, string>> = {
  weight: 'Anotação',
  vitals: 'Observações (mucosas, hidratação, TPC...)',
  pathology: 'Observações',
  exam: 'Resultado / observações',
  prescription: 'Prescrição',
  document: 'Conteúdo',
  note: 'Descrição',
  alert: 'Detalhes',
};

const printable: ClinicalEventType[] = ['prescription', 'document'];

function documentTemplates(animal: AnimalWithClient, vaccinations: Vaccination[], clinicName: string) {
  const patient = `${animal.name} (${speciesLabel[animal.species]}, ${animal.breed}, ${formatAge(animal.date_of_birth)}, ${animal.weight} kg)`;
  const owner = `${animal.clients.full_name}, CPF ${animal.clients.cpf}`;
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const vaccineList = vaccinations.length
    ? vaccinations.map((v) => `- ${v.vaccine_name}: aplicada em ${formatDate(v.application_date)}${v.next_dose_date ? `, próxima dose em ${formatDate(v.next_dose_date)}` : ''}`).join('\n')
    : '- Nenhuma vacina registrada.';

  return [
    {
      name: 'Atestado de saúde',
      body: `Atesto, para os devidos fins, que examinei o animal ${patient}, de responsabilidade de ${owner}, e que ele se encontra clinicamente saudável, sem sinais de doenças infectocontagiosas ou parasitárias na data do exame.\n\n${clinicName}, ${today}.`,
    },
    {
      name: 'Atestado de vacinação',
      body: `Atesto que o animal ${patient}, de responsabilidade de ${owner}, recebeu as seguintes vacinas nesta clínica:\n\n${vaccineList}\n\n${clinicName}, ${today}.`,
    },
    {
      name: 'Termo de autorização para procedimento',
      body: `Eu, ${owner}, responsável pelo animal ${patient}, autorizo a equipe de ${clinicName} a realizar o procedimento: ________________________________.\n\nDeclaro ter sido informado(a) sobre os riscos, benefícios e alternativas, inclusive anestésicos, e que tive a oportunidade de esclarecer minhas dúvidas.\n\n${clinicName}, ${today}.\n\n\n________________________________\n${animal.clients.full_name}`,
    },
  ];
}

const toNumber = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')));

export default function ClinicalEventModal({ type, event, animal, vaccinations, onClose, onSaved }: Props) {
  const clinic = useClinic();
  const meta = kindMeta[type];
  const occurred = event ? new Date(event.occurred_at) : new Date();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    date: toISODate(occurred),
    time: occurred.toTimeString().slice(0, 5),
    title: event?.title ?? (type === 'prescription' ? 'Receita' : ''),
    content: event?.content ?? '',
    weight_kg: event?.weight_kg?.toString().replace('.', ',') ?? '',
    temperature_c: event?.temperature_c?.toString().replace('.', ',') ?? '',
    heart_rate: event?.heart_rate?.toString() ?? '',
    respiratory_rate: event?.respiratory_rate?.toString() ?? '',
    body_condition_score: event?.body_condition_score?.toString() ?? '',
    pain_score: event?.pain_score?.toString() ?? '',
  }));

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const templates = type === 'document' ? documentTemplates(animal, vaccinations, clinic.name) : [];
  const ranges = vitalRanges[animal.species];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      animal_id: animal.id,
      event_type: type,
      occurred_at: new Date(`${form.date}T${form.time || '00:00'}`).toISOString(),
      title: type === 'weight' || type === 'vitals' ? null : form.title.trim(),
      content: form.content.trim() || null,
      weight_kg: type === 'weight' ? toNumber(form.weight_kg) : null,
      temperature_c: type === 'vitals' ? toNumber(form.temperature_c) : null,
      heart_rate: type === 'vitals' ? toNumber(form.heart_rate) : null,
      respiratory_rate: type === 'vitals' ? toNumber(form.respiratory_rate) : null,
      body_condition_score: type === 'vitals' ? toNumber(form.body_condition_score) : null,
      pain_score: type === 'vitals' ? toNumber(form.pain_score) : null,
    };

    if (type === 'vitals' && [payload.temperature_c, payload.heart_rate, payload.respiratory_rate, payload.body_condition_score, payload.pain_score].every((v) => v == null)) {
      setBusy(false);
      setError('Preencha ao menos um sinal vital.');
      return;
    }

    const { error } = event
      ? await supabase.from('clinical_events').update(payload).eq('id', event.id)
      : await supabase.from('clinical_events').insert(payload);

    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível salvar o registro.'));
      return;
    }
    onSaved();
    onClose();
  };

  const handlePrint = () =>
    printClinicalDocument({
      clinicName: clinic.name,
      title: form.title || meta.label,
      body: form.content,
      patient: `${animal.name} (${speciesLabel[animal.species]}, ${animal.breed})`,
      owner: animal.clients.full_name,
      date: new Date(`${form.date}T12:00`).toLocaleDateString('pt-BR'),
    });

  const Icon = meta.icon;

  return (
    <Modal
      onClose={onClose}
      size={printable.includes(type) ? 'xl' : 'lg'}
      title={
        <span className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${meta.text}`} />
          {event ? `Editar ${meta.label.toLowerCase()}` : `${meta.label}`}
          <span className="text-sm font-normal text-slate-500">• {animal.name}</span>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Data *</label>
            <input type="date" required value={form.date} onChange={set('date')} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Hora *</label>
            <input type="time" required value={form.time} onChange={set('time')} className={fieldClass} />
          </div>
        </div>

        {type === 'weight' && (
          <div>
            <label className={labelClass}>Peso (kg) *</label>
            <input
              required
              inputMode="decimal"
              pattern="[0-9]+([.,][0-9]{1,3})?"
              title="Ex.: 12,5"
              value={form.weight_kg}
              onChange={set('weight_kg')}
              className={fieldClass}
              placeholder={`Último: ${animal.weight} kg`}
            />
          </div>
        )}

        {type === 'vitals' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Temperatura (°C)</label>
              <input inputMode="decimal" pattern="[0-9]{2}([.,][0-9])?" title="Ex.: 38,5" value={form.temperature_c} onChange={set('temperature_c')} className={fieldClass} />
              <p className="text-xs text-slate-500 mt-1">Ref.: {ranges.temperature_c.join(' a ').replace(/\./g, ',')}</p>
            </div>
            <div>
              <label className={labelClass}>Freq. cardíaca (bpm)</label>
              <input type="number" min="1" max="500" value={form.heart_rate} onChange={set('heart_rate')} className={fieldClass} />
              <p className="text-xs text-slate-500 mt-1">Ref.: {ranges.heart_rate.join(' a ')}</p>
            </div>
            <div>
              <label className={labelClass}>Freq. respiratória (mpm)</label>
              <input type="number" min="1" max="300" value={form.respiratory_rate} onChange={set('respiratory_rate')} className={fieldClass} />
              <p className="text-xs text-slate-500 mt-1">Ref.: {ranges.respiratory_rate.join(' a ')}</p>
            </div>
            <div>
              <label className={labelClass}>Escore corporal (1–9)</label>
              <select value={form.body_condition_score} onChange={set('body_condition_score')} className={fieldClass}>
                <option value="">-</option>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {n <= 3 ? ' (abaixo do ideal)' : n <= 5 ? ' (ideal)' : ' (acima do ideal)'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Escala de dor (0–10)</label>
              <select value={form.pain_score} onChange={set('pain_score')} className={fieldClass}>
                <option value="">-</option>
                {Array.from({ length: 11 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                    {n === 0 ? ' (sem dor)' : n >= 7 ? ' (intensa)' : n >= 4 ? ' (moderada)' : ' (leve)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {titleLabels[type] && (
          <div>
            <label className={labelClass}>{titleLabels[type]} *</label>
            <input required maxLength={200} value={form.title} onChange={set('title')} className={fieldClass} />
          </div>
        )}

        {templates.length > 0 && (
          <div>
            <label className={labelClass}>Modelo</label>
            <select
              className={fieldClass}
              defaultValue=""
              onChange={(e) => {
                const t = templates.find((x) => x.name === e.target.value);
                if (t) setForm((prev) => ({ ...prev, title: t.name, content: t.body }));
              }}
            >
              <option value="">Escolha um modelo para preencher com os dados do paciente...</option>
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className={`${labelClass} mb-0`}>
              {contentLabels[type]}
              {printable.includes(type) && ' *'}
            </label>
            <DictationButton onText={(text) => setForm((prev) => ({ ...prev, content: appendText(prev.content, text) }))} />
          </div>
          <textarea
            required={printable.includes(type)}
            rows={printable.includes(type) ? 12 : 3}
            maxLength={20000}
            value={form.content}
            onChange={set('content')}
            className={fieldClass}
            placeholder={type === 'prescription' ? 'Uso oral:\n1. Medicamento 10 mg — 1 comprimido a cada 12 horas por 7 dias.' : undefined}
          />
        </div>

        {printable.includes(type) && (
          <button
            type="button"
            onClick={handlePrint}
            disabled={!form.content.trim()}
            className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50 disabled:no-underline"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        )}

        <FormActions submitLabel={event ? 'Atualizar' : 'Salvar'} onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}
