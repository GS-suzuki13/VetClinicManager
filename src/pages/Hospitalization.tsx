import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BedDouble, Check, Clock, FileHeart, Plus, X } from 'lucide-react';
import { supabase, Animal, Client, HospitalBox, HospitalPrescription, HospitalTask, Hospitalization as Hosp, Triage } from '../lib/supabase';
import { dbErrorMessage } from '../lib/format';
import { formatDateTime } from '../lib/money';
import { PageLoader } from '../components/PageToolbar';
import Modal, { FormActions, FormError, fieldClass, labelClass } from '../components/Modal';
import { Badge, Card, PrimaryButton, StatTile, Tabs } from '../components/ui';
import { askPrompt, notify } from '../lib/dialogs';

type HospRow = Hosp & { animals: Pick<Animal, 'id' | 'name' | 'species' | 'breed'> & { clients: Pick<Client, 'full_name' | 'phone_number'> | null } };
type TaskRow = HospitalTask & { hospitalizations: { animals: Pick<Animal, 'name'>; box_id: string | null } | null };

// Classificação de risco (Manchester adaptado).
const triageInfo: Record<Triage, { label: string; bar: string; badge: string }> = {
  red: { label: 'Emergência', bar: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
  orange: { label: 'Muito urgente', bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
  yellow: { label: 'Urgente', bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800' },
  green: { label: 'Pouco urgente', bar: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
  blue: { label: 'Não urgente', bar: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
};
const boxKind: Record<HospitalBox['kind'], string> = { kennel: 'Canil', cattery: 'Gatil', isolation: 'Isolamento', icu: 'UTI', other: 'Outro' };
const outcomeLabel = { discharged: 'Alta', deceased: 'Óbito', transferred: 'Transferido' } as const;

const hoursSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3600000));
const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function Hospitalization({ onOpenRecord }: { onOpenRecord: (animalId: string) => void }) {
  const [tab, setTab] = useState<'board' | 'map' | 'history'>('board');
  const [active, setActive] = useState<HospRow[]>([]);
  const [ended, setEnded] = useState<HospRow[]>([]);
  const [boxes, setBoxes] = useState<HospitalBox[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: 'admit' } | { type: 'detail'; id: string } | { type: 'boxes' } | null>(null);

  const load = useCallback(async () => {
    const until = new Date(Date.now() + 24 * 3600000).toISOString();
    const select = '*, animals(id, name, species, breed, clients(full_name, phone_number))';
    const [a, e, b, t] = await Promise.all([
      supabase.from('hospitalizations').select(select).eq('status', 'active').order('admitted_at'),
      supabase.from('hospitalizations').select(select).neq('status', 'active').order('ended_at', { ascending: false }).limit(50),
      supabase.from('hospital_boxes').select('*').order('name'),
      supabase.from('hospital_tasks').select('*, hospitalizations(box_id, animals(name))').eq('status', 'pending').lte('scheduled_at', until).order('scheduled_at'),
    ]);
    setActive((a.data as HospRow[]) ?? []);
    setEnded((e.data as HospRow[]) ?? []);
    setBoxes(b.data ?? []);
    setTasks((t.data as TaskRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const setTask = async (task: HospitalTask, status: 'done' | 'skipped') => {
    const { error } = await supabase.from('hospital_tasks').update({ status }).eq('id', task.id);
    if (error) notify(dbErrorMessage(error, 'Não foi possível atualizar a tarefa.'));
    load();
  };

  if (loading) return <PageLoader />;

  const now = Date.now();
  const overdue = tasks.filter((t) => new Date(t.scheduled_at).getTime() < now - 15 * 60000);
  const next2h = tasks.filter((t) => {
    const at = new Date(t.scheduled_at).getTime();
    return at >= now - 15 * 60000 && at <= now + 2 * 3600000;
  });
  const boxName = (id: string | null) => boxes.find((b) => b.id === id)?.name ?? 'Sem box';
  const free = boxes.filter((b) => b.active && !active.some((h) => h.box_id === b.id)).length;

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatTile label="Internados" value={active.length} hint={`${free} box(es) livre(s)`} />
        <StatTile label="Emergência / muito urgente" value={active.filter((h) => h.triage === 'red' || h.triage === 'orange').length} tone="red" />
        <StatTile label="Tarefas atrasadas" value={overdue.length} tone={overdue.length ? 'red' : 'slate'} />
        <StatTile label="Próximas 2 horas" value={next2h.length} tone="blue" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
        <div className="flex-1">
          <Tabs
            tabs={[
              ['board', 'Pacientes internados'],
              ['map', `Mapa de execução${overdue.length ? ` (${overdue.length} atrasada${overdue.length > 1 ? 's' : ''})` : ''}`],
              ['history', 'Altas e óbitos'],
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div className="flex gap-2 sm:-mt-6">
          <button onClick={() => setModal({ type: 'boxes' })} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium">
            Boxes
          </button>
          <PrimaryButton onClick={() => setModal({ type: 'admit' })}>
            <Plus className="w-4 h-4" />
            Internar
          </PrimaryButton>
        </div>
      </div>

      {tab === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {active.length === 0 && <p className="text-slate-500 text-sm col-span-full text-center py-12">Nenhum paciente internado.</p>}
          {active
            .slice()
            .sort((a, b) => Object.keys(triageInfo).indexOf(a.triage) - Object.keys(triageInfo).indexOf(b.triage))
            .map((h) => {
              const mine = tasks.filter((t) => t.hospitalization_id === h.id);
              const late = mine.filter((t) => new Date(t.scheduled_at).getTime() < now - 15 * 60000).length;
              return (
                <button key={h.id} onClick={() => setModal({ type: 'detail', id: h.id })} className="text-left bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex">
                  <span className={`w-1.5 shrink-0 ${triageInfo[h.triage].bar}`} />
                  <div className="p-4 flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{h.animals.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {h.animals.clients?.full_name} • {boxName(h.box_id)}
                        </p>
                      </div>
                      <Badge className={triageInfo[h.triage].badge}>{triageInfo[h.triage].label}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{h.reason}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {hoursSince(h.admitted_at)}h internado
                      </span>
                      {mine[0] && <span>Próxima: {time(mine[0].scheduled_at)}</span>}
                      {late > 0 && <span className="text-red-600 font-medium">{late} atrasada(s)</span>}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      )}

      {tab === 'map' && (
        <Card title="Próximas 24 horas">
          {tasks.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">Nenhuma tarefa pendente. Prescrições geram as tarefas automaticamente.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((t) => {
                const at = new Date(t.scheduled_at).getTime();
                const isLate = at < now - 15 * 60000;
                return (
                  <li key={t.id} className={`flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 text-sm ${isLate ? 'bg-red-50/60' : ''}`}>
                    <span className={`w-28 shrink-0 font-semibold ${isLate ? 'text-red-600' : 'text-slate-800'}`}>{formatDateTime(t.scheduled_at).slice(0, 17)}</span>
                    <span className="flex-1 min-w-[10rem]">
                      <span className="font-medium text-slate-800">{t.hospitalizations?.animals.name}</span>
                      <span className="text-slate-500"> • {boxName(t.hospitalizations?.box_id ?? null)}</span>
                      <span className="block text-slate-600">{t.description}</span>
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setTask(t, 'done')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600">
                        <Check className="w-4 h-4" /> Feito
                      </button>
                      <button onClick={() => setTask(t, 'skipped')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-600 text-xs font-medium hover:bg-slate-100">
                        <X className="w-4 h-4" /> Não feito
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <ul className="divide-y divide-slate-100">
            {ended.length === 0 && <li className="p-6 text-sm text-slate-500 text-center">Nenhuma internação encerrada.</li>}
            {ended.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 text-sm">
                <div>
                  <button onClick={() => onOpenRecord(h.animals.id)} className="font-medium text-emerald-700 hover:underline">
                    {h.animals.name}
                  </button>
                  <span className="text-slate-500"> • {h.reason}</span>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(h.admitted_at)} → {formatDateTime(h.ended_at)}
                    {h.outcome_notes && ` • ${h.outcome_notes}`}
                  </p>
                </div>
                <Badge className={h.status === 'deceased' ? 'bg-slate-800 text-white' : h.status === 'discharged' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                  {outcomeLabel[h.status as keyof typeof outcomeLabel]}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {modal?.type === 'admit' && <AdmitModal boxes={boxes} active={active} onClose={() => setModal(null)} onSaved={load} />}
      {modal?.type === 'boxes' && <BoxesModal boxes={boxes} active={active} onClose={() => setModal(null)} onSaved={load} />}
      {modal?.type === 'detail' && (
        <DetailModal
          hosp={active.find((h) => h.id === modal.id)!}
          boxes={boxes}
          onClose={() => setModal(null)}
          onChanged={load}
          onOpenRecord={(id) => {
            setModal(null);
            onOpenRecord(id);
          }}
        />
      )}
    </div>
  );
}

export function AdmitModal(props: { boxes?: HospitalBox[]; active?: Pick<Hosp, 'box_id'>[]; animal?: Pick<Animal, 'id' | 'name' | 'client_id'>; onClose: () => void; onSaved: () => void }) {
  const { animal, onClose, onSaved } = props;
  // Aberto pela ficha do animal: carrega boxes e ocupação.
  const [boxes, setBoxes] = useState<HospitalBox[]>(props.boxes ?? []);
  const [active, setActive] = useState<Pick<Hosp, 'box_id'>[]>(props.active ?? []);
  useEffect(() => {
    if (props.boxes) return;
    supabase.from('hospital_boxes').select('*').order('name').then(({ data }) => setBoxes(data ?? []));
    supabase.from('hospitalizations').select('box_id').eq('status', 'active').then(({ data }) => setActive(data ?? []));
  }, [props.boxes]);
  const [clients, setClients] = useState<Client[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [form, setForm] = useState({ client_id: animal?.client_id ?? '', animal_id: animal?.id ?? '', box_id: '', triage: 'yellow' as Triage, reason: '', diet: '', responsible: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!animal) supabase.from('clients').select('*').order('full_name').then(({ data }) => setClients(data ?? []));
  }, [animal]);
  useEffect(() => {
    if (!form.client_id || animal) return;
    supabase.from('animals').select('*').eq('client_id', form.client_id).is('deceased_on', null).order('name').then(({ data }) => setAnimals(data ?? []));
  }, [form.client_id, animal]);

  const freeBoxes = boxes.filter((b) => b.active && !active.some((h) => h.box_id === b.id));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('hospitalizations').insert({
      animal_id: form.animal_id,
      box_id: form.box_id || null,
      triage: form.triage,
      reason: form.reason.trim(),
      diet: form.diet.trim() || null,
      responsible: form.responsible.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(error.code === '23505' ? 'Este animal já está internado ou o box está ocupado.' : dbErrorMessage(error, 'Não foi possível internar.'));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal title={animal ? `Internar ${animal.name}` : 'Internar paciente'} onClose={onClose}>
      <form onSubmit={submit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!animal && (
            <>
              <div>
                <label className={labelClass}>Tutor *</label>
                <select required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value, animal_id: '' })} className={fieldClass}>
                  <option value="">Selecione</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Animal *</label>
                <select required value={form.animal_id} onChange={(e) => setForm({ ...form, animal_id: e.target.value })} className={fieldClass} disabled={!form.client_id}>
                  <option value="">Selecione</option>
                  {animals.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className={labelClass}>Classificação de risco</label>
            <select value={form.triage} onChange={(e) => setForm({ ...form, triage: e.target.value as Triage })} className={fieldClass}>
              {(Object.keys(triageInfo) as Triage[]).map((t) => (
                <option key={t} value={t}>
                  {triageInfo[t].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Box</label>
            <select value={form.box_id} onChange={(e) => setForm({ ...form, box_id: e.target.value })} className={fieldClass}>
              <option value="">{freeBoxes.length ? 'Sem box' : 'Nenhum box livre'}</option>
              {freeBoxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({boxKind[b.kind]})
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Motivo da internação *</label>
            <textarea required rows={2} maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Dieta / jejum</label>
            <input maxLength={500} value={form.diet} onChange={(e) => setForm({ ...form, diet: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Veterinário responsável</label>
            <input maxLength={120} value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} className={fieldClass} />
          </div>
        </div>
        <FormActions submitLabel="Internar" onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}

function BoxesModal({ boxes, active, onClose, onSaved }: { boxes: HospitalBox[]; active: Pick<Hosp, 'box_id'>[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', kind: 'kennel' as HospitalBox['kind'] });
  const [error, setError] = useState<string | null>(null);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('hospital_boxes').insert({ name: form.name.trim(), kind: form.kind });
    setError(error ? dbErrorMessage(error, 'Não foi possível criar o box.') : null);
    setForm({ ...form, name: '' });
    onSaved();
  };
  const toggle = async (b: HospitalBox) => {
    await supabase.from('hospital_boxes').update({ active: !b.active }).eq('id', b.id);
    onSaved();
  };
  return (
    <Modal title="Boxes de internação" onClose={onClose} size="md">
      <div className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {boxes.length === 0 && <li className="p-4 text-sm text-slate-500 text-center">Cadastre os boxes (canil, gatil, isolamento, UTI).</li>}
          {boxes.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className={b.active ? 'text-slate-800' : 'text-slate-400 line-through'}>
                <BedDouble className="w-4 h-4 inline mr-2 text-slate-400" />
                {b.name} <span className="text-xs text-slate-500">• {boxKind[b.kind]}</span>
                {active.some((h) => h.box_id === b.id) && <span className="ml-2 text-xs text-orange-600">ocupado</span>}
              </span>
              <button onClick={() => toggle(b)} className="text-xs text-slate-500 hover:underline">
                {b.active ? 'Desativar' : 'Ativar'}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
          <input required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome (ex.: Canil 3)" className={fieldClass} />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as HospitalBox['kind'] })} className={fieldClass}>
            {(Object.keys(boxKind) as HospitalBox['kind'][]).map((k) => (
              <option key={k} value={k}>
                {boxKind[k]}
              </option>
            ))}
          </select>
          <PrimaryButton type="submit">Adicionar</PrimaryButton>
        </form>
      </div>
    </Modal>
  );
}

function DetailModal({ hosp, boxes, onClose, onChanged, onOpenRecord }: { hosp: HospRow; boxes: HospitalBox[]; onClose: () => void; onChanged: () => void; onOpenRecord: (animalId: string) => void }) {
  const [prescriptions, setPrescriptions] = useState<HospitalPrescription[]>([]);
  const [tasks, setTasks] = useState<HospitalTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ description: '', dose: '', route: 'VO', interval_hours: '8', days: '3', starts_at: '' });
  const [triage, setTriage] = useState<Triage>(hosp.triage);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 12 * 3600000).toISOString();
    const [p, t] = await Promise.all([
      supabase.from('hospital_prescriptions').select('*').eq('hospitalization_id', hosp.id).order('created_at'),
      supabase.from('hospital_tasks').select('*').eq('hospitalization_id', hosp.id).gte('scheduled_at', since).order('scheduled_at').limit(60),
    ]);
    setPrescriptions(p.data ?? []);
    setTasks(t.data ?? []);
  }, [hosp.id]);

  useEffect(() => {
    load();
  }, [load]);

  const addPrescription = async (e: FormEvent) => {
    e.preventDefault();
    const start = form.starts_at ? new Date(form.starts_at) : new Date();
    const days = Number(form.days);
    const { error } = await supabase.from('hospital_prescriptions').insert({
      hospitalization_id: hosp.id,
      description: form.description.trim(),
      dose: form.dose.trim() || null,
      route: form.route.trim() || null,
      interval_hours: Number(form.interval_hours),
      starts_at: start.toISOString(),
      ends_at: days > 0 ? new Date(start.getTime() + days * 86400000).toISOString() : null,
    });
    setError(error ? dbErrorMessage(error, 'Não foi possível prescrever.') : null);
    if (!error) setForm({ ...form, description: '', dose: '' });
    load();
    onChanged();
  };

  const stop = async (p: HospitalPrescription) => {
    await supabase.from('hospital_prescriptions').update({ active: false }).eq('id', p.id);
    load();
    onChanged();
  };

  const mark = async (t: HospitalTask, status: HospitalTask['status']) => {
    await supabase.from('hospital_tasks').update({ status }).eq('id', t.id);
    load();
    onChanged();
  };

  const updateTriage = async (value: Triage) => {
    setTriage(value);
    await supabase.from('hospitalizations').update({ triage: value }).eq('id', hosp.id);
    onChanged();
  };

  const finish = async (outcome: 'discharged' | 'deceased' | 'transferred') => {
    const notes = (await askPrompt(`${outcomeLabel[outcome]} de ${hosp.animals.name}. Observações (opcional): orientações, causa ou destino.`, { multiline: true, title: outcomeLabel[outcome], confirmLabel: `Confirmar ${outcomeLabel[outcome].toLowerCase()}`, danger: outcome === 'deceased' }));
    if (notes === null) return;
    const { error } = await supabase.rpc('finish_hospitalization', { p_id: hosp.id, p_outcome: outcome, p_notes: notes });
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível encerrar.'));
      return;
    }
    onChanged();
    onClose();
  };

  return (
    <Modal title={`Internação • ${hosp.animals.name}`} onClose={onClose} size="xl">
      <div className="p-4 sm:p-6 space-y-5">
        <FormError message={error} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-sm text-slate-600 space-y-1">
            <p>
              <strong className="text-slate-800">{hosp.animals.clients?.full_name}</strong> • {hosp.animals.clients?.phone_number}
            </p>
            <p>
              {boxes.find((b) => b.id === hosp.box_id)?.name ?? 'Sem box'} • internado em {formatDateTime(hosp.admitted_at)} ({hoursSince(hosp.admitted_at)}h)
            </p>
            <p>Motivo: {hosp.reason}</p>
            {hosp.diet && <p>Dieta: {hosp.diet}</p>}
            {hosp.responsible && <p>Responsável: {hosp.responsible}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <select value={triage} onChange={(e) => updateTriage(e.target.value as Triage)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border-0 ${triageInfo[triage].badge}`}>
              {(Object.keys(triageInfo) as Triage[]).map((t) => (
                <option key={t} value={t}>
                  {triageInfo[t].label}
                </option>
              ))}
            </select>
            <button onClick={() => onOpenRecord(hosp.animals.id)} className="flex items-center gap-1 text-sm text-emerald-700 font-medium hover:underline">
              <FileHeart className="w-4 h-4" /> Abrir ficha
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Prescrições</h4>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg mb-3">
            {prescriptions.length === 0 && <li className="p-3 text-sm text-slate-500">Nenhuma prescrição.</li>}
            {prescriptions.map((p) => (
              <li key={p.id} className={`flex items-center justify-between gap-2 px-4 py-2 text-sm ${p.active ? '' : 'opacity-50'}`}>
                <span>
                  <strong className="text-slate-800">{p.description}</strong> {p.dose} {p.route && `(${p.route})`} • a cada {Number(p.interval_hours)}h
                  {p.ends_at && ` até ${formatDateTime(p.ends_at)}`}
                </span>
                {p.active && (
                  <button onClick={() => stop(p)} className="text-xs text-red-600 hover:underline whitespace-nowrap">
                    Suspender
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={addPrescription} className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Medicamento / procedimento" maxLength={300} className={`${fieldClass} col-span-2`} />
            <input value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="Dose" maxLength={120} className={fieldClass} />
            <select value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} className={fieldClass}>
              {['VO', 'IV', 'IM', 'SC', 'Tópico', 'Oftálmico', 'Inalatório', 'Outro'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <select value={form.interval_hours} onChange={(e) => setForm({ ...form, interval_hours: e.target.value })} className={fieldClass}>
              {[1, 2, 4, 6, 8, 12, 24].map((h) => (
                <option key={h} value={h}>
                  a cada {h}h
                </option>
              ))}
            </select>
            <select value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className={fieldClass}>
              {[1, 2, 3, 5, 7, 10].map((d) => (
                <option key={d} value={d}>
                  por {d} dia{d > 1 ? 's' : ''}
                </option>
              ))}
              <option value="0">até suspender</option>
            </select>
            <div className="col-span-2 sm:col-span-6 flex flex-col sm:flex-row gap-2">
              <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className={`${fieldClass} sm:w-60`} title="Início (vazio = agora)" />
              <PrimaryButton type="submit">Prescrever</PrimaryButton>
            </div>
          </form>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Mapa de execução</h4>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
            {tasks.length === 0 && <li className="p-3 text-sm text-slate-500">Nenhuma tarefa nas últimas 12h ou próximas.</li>}
            {tasks.map((t) => {
              const late = t.status === 'pending' && new Date(t.scheduled_at).getTime() < Date.now() - 15 * 60000;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className={`w-20 sm:w-24 shrink-0 font-medium ${late ? 'text-red-600' : 'text-slate-700'}`}>{formatDateTime(t.scheduled_at).slice(0, 17)}</span>
                  <span className={`flex-1 min-w-0 ${t.status === 'skipped' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{t.description}</span>
                  {t.status === 'pending' ? (
                    <span className="flex gap-1">
                      <button onClick={() => mark(t, 'done')} title="Feito" className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => mark(t, 'skipped')} title="Não feito" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 text-right shrink-0 max-w-[7rem] sm:max-w-[12rem]">
                      {t.status === 'done' ? '✓' : '✗'} {t.done_at && time(t.done_at)}
                      <span className="hidden sm:block truncate" title={t.done_by_email ?? undefined}>
                        {t.done_by_email}
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
          <button onClick={() => finish('discharged')} className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium">
            Dar alta
          </button>
          <button onClick={() => finish('transferred')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">
            Transferir
          </button>
          <button onClick={() => finish('deceased')} className="px-4 py-2 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">
            Registrar óbito
          </button>
        </div>
      </div>
    </Modal>
  );
}
