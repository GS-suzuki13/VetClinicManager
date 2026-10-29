import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  MessagesSquare,
  Share2,
  ShoppingCart,
  CalendarClock,
  Cat,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Dog,
  Edit,
  Mail,
  Phone,
  ScanLine,
  Syringe,
  Trash2,
} from 'lucide-react';
import {
  supabase,
  Appointment,
  ClinicalEvent,
  ClinicalEventType,
  MedicalRecord,
  Microchip,
  Vaccination,
} from '../lib/supabase';
import { dbErrorMessage, formatDate, openStatuses, speciesLabel, statusLabel, statusStyle, todayISO } from '../lib/format';
import { formatChipCode } from '../lib/microchip';
import {
  TimelineItem,
  TimelineKind,
  buildTimeline,
  formatAge,
  formatDateTime,
  formatNumber,
  kindMeta,
  outOfRange,
  timelineKinds,
} from '../lib/clinicalTimeline';
import ClinicalEventModal, { AnimalWithClient } from '../components/ClinicalEventModal';
import MedicalRecordModal from '../components/MedicalRecordModal';
import VaccinationModal from '../components/VaccinationModal';
import { PageLoader } from '../components/PageToolbar';
import VaccineSchedule, { ApplyProtocolModal } from '../components/VaccineSchedule';
import { DoseWithDetails, doseSelect } from '../lib/vaccines';
import { canDeleteClinicalData, useClinic } from '../context/AuthContext';
import { useAnimalsModal } from '../context/AnimalsModalContext';
import { useAppointmentsModal } from '../context/AppointmentsModalContext';
import SaleModal from '../components/SaleModal';
import ClientMessagesModal from '../components/ClientMessagesModal';
import { AdmitModal } from './Hospitalization';
import { firstName, publicUrl, sendWhatsapp } from '../lib/messages';
import { askConfirm, notify } from '../lib/dialogs';

interface Props {
  animalId: string;
  onBack: () => void;
}

type Tab = 'history' | 'vaccines' | 'evolution' | 'agenda';

type ModalState =
  | { kind: 'consultation'; record: MedicalRecord | null }
  | { kind: 'vaccine'; vaccination: Vaccination | null }
  | { kind: ClinicalEventType; event: ClinicalEvent | null };

const cardClass = 'bg-white rounded-xl shadow-sm border border-slate-200';

export default function AnimalRecord({ animalId, onBack }: Props) {
  const clinic = useClinic();
  const canDelete = canDeleteClinicalData(clinic.role);
  const { openModal: openAnimalModal, savedVersion: animalVersion } = useAnimalsModal();
  const { savedVersion: appointmentVersion } = useAppointmentsModal();

  const [animal, setAnimal] = useState<AnimalWithClient | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [events, setEvents] = useState<ClinicalEvent[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [chip, setChip] = useState<Pick<Microchip, 'code'> | null>(null);
  const [doses, setDoses] = useState<DoseWithDetails[]>([]);
  const [applyingProtocol, setApplyingProtocol] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [tab, setTab] = useState<Tab>('history');
  const [filter, setFilter] = useState<TimelineKind | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState | null>(null);
  // Ações do atendimento: venda, internação e conversa com o tutor.
  const [action, setAction] = useState<'sale' | 'admit' | 'messages' | null>(null);
  const [hospitalized, setHospitalized] = useState(false);

  const load = useCallback(async () => {
    const [a, r, v, e, ap, mc, vd] = await Promise.all([
      supabase.from('animals').select('*, clients(*)').eq('id', animalId).maybeSingle(),
      supabase.from('medical_records').select('*').eq('animal_id', animalId),
      supabase.from('animal_vaccinations').select('*').eq('animal_id', animalId),
      supabase.from('clinical_events').select('*').eq('animal_id', animalId),
      supabase.from('appointments').select('*').eq('animal_id', animalId).order('appointment_date', { ascending: false }).order('appointment_time', { ascending: false }),
      supabase.from('microchips').select('code').eq('animal_id', animalId).eq('status', 'active').maybeSingle(),
      supabase.from('vaccine_doses').select(doseSelect).eq('animal_id', animalId).neq('status', 'skipped').order('due_date', { ascending: false }),
    ]);
    const failed = [a, r, v, e, ap].find((res) => res.error);
    if (failed?.error) console.error('Erro ao carregar a ficha:', failed.error);
    setAnimal(a.data);
    setNotFound(!a.data && !a.error);
    setRecords(r.data ?? []);
    setVaccinations(v.data ?? []);
    setEvents(e.data ?? []);
    setAppointments(ap.data ?? []);
    setChip(mc.data);
    setDoses((vd.data as DoseWithDetails[]) ?? []);
    const { count } = await supabase.from('hospitalizations').select('id', { count: 'exact', head: true }).eq('animal_id', animalId).eq('status', 'active');
    setHospitalized(!!count);
    setLoading(false);
  }, [animalId]);

  useEffect(() => {
    load();
  }, [load, animalVersion, appointmentVersion]);

  const timeline = useMemo(() => buildTimeline(records, vaccinations, events), [records, vaccinations, events]);

  const counts = useMemo(() => {
    const c: Partial<Record<TimelineKind, number>> = {};
    for (const item of timeline) c[item.kind] = (c[item.kind] ?? 0) + 1;
    return c;
  }, [timeline]);

  const weights = useMemo(
    () =>
      events
        .filter((e) => e.event_type === 'weight' && e.weight_kg != null)
        .map((e) => ({ date: new Date(e.occurred_at), kg: Number(e.weight_kg) }))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [events]
  );

  const vitals = useMemo(
    () => events.filter((e) => e.event_type === 'vitals').sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    [events]
  );

  const activeAlerts = events.filter((e) => e.event_type === 'alert' && !e.resolved_at);

  // Próxima dose: a programação dos protocolos; sem ela, a última aplicação de cada vacina.
  const nextScheduled = doses.filter((d) => d.status === 'scheduled').sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const nextVaccineLegacy = useMemo(() => {
    const latest = new Map<string, Vaccination>();
    for (const v of vaccinations) {
      const key = v.vaccine_name.trim().toLowerCase();
      const current = latest.get(key);
      if (!current || v.application_date > current.application_date) latest.set(key, v);
    }
    return [...latest.values()]
      .filter((v) => v.next_dose_date)
      .sort((a, b) => a.next_dose_date!.localeCompare(b.next_dose_date!))[0];
  }, [vaccinations]);
  const nextVaccine = nextScheduled
    ? { vaccine_name: nextScheduled.vaccine_protocols.name, next_dose_date: nextScheduled.due_date }
    : nextVaccineLegacy;

  const today = todayISO();
  const nextAppointment = appointments
    .filter((a) => openStatuses.includes(a.status) && a.appointment_date >= today)
    .sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time))[0];

  if (loading) return <PageLoader />;

  if (!animal) {
    return (
      <div className={`${cardClass} p-8 text-center text-slate-500`}>
        {notFound ? 'Animal não encontrado.' : 'Não foi possível carregar a ficha.'}
        <button onClick={onBack} className="block mx-auto mt-4 text-emerald-700 font-medium hover:underline">
          Voltar para animais
        </button>
      </div>
    );
  }

  const SpeciesIcon = animal.species === 'Cat' ? Cat : Dog;
  const lastWeight = weights[weights.length - 1];
  const lastRecord = records.length ? timeline.find((i) => i.kind === 'consultation') : undefined;
  const pathologies = [...new Set(events.filter((e) => e.event_type === 'pathology').map((e) => e.title!))].slice(0, 5);
  const visible = filter ? timeline.filter((i) => i.kind === filter) : timeline;

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const openNew = (kind: TimelineKind) => {
    if (kind === 'consultation') setModal({ kind, record: null });
    else if (kind === 'vaccine') setModal({ kind, vaccination: null });
    else setModal({ kind, event: null });
  };

  const openEdit = (item: TimelineItem) => {
    if (item.kind === 'consultation') setModal({ kind: 'consultation', record: item.record });
    else if (item.kind === 'vaccine') setModal({ kind: 'vaccine', vaccination: item.vaccination });
    else setModal({ kind: item.kind, event: item.event });
  };

  const handleDelete = async (item: TimelineItem) => {
    if (!(await askConfirm(`Excluir este registro de ${kindMeta[item.kind].label.toLowerCase()}?`, { danger: true, title: 'Excluir', confirmLabel: 'Excluir' }))) return;
    const [table, id] =
      item.kind === 'consultation'
        ? ['medical_records', item.record.id]
        : item.kind === 'vaccine'
          ? ['animal_vaccinations', item.vaccination.id]
          : ['clinical_events', item.event.id];
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) notify(dbErrorMessage(error, 'Não foi possível excluir o registro.'));
    else load();
  };

  // Cartão do pet: link público com vacinas e próximas consultas (portal do tutor).
  const sharePetCard = async () => {
    const { data, error } = await supabase.from('pet_share_links').insert({ animal_id: animal.id }).select('token').single();
    if (error) {
      notify(dbErrorMessage(error, 'Não foi possível gerar o link.'));
      return;
    }
    const text = `Olá, ${firstName(animal.clients.full_name)}! Aqui está a carteira de vacinação e os próximos atendimentos de ${animal.name}: ${publicUrl('pet', data.token)} • ${clinic.name}`;
    await sendWhatsapp({ phone: animal.clients.phone_number, text, clientId: animal.clients.id, animalId: animal.id });
  };

  const resolveAlert = async (event: ClinicalEvent) => {
    const { error } = await supabase.from('clinical_events').update({ resolved_at: new Date().toISOString() }).eq('id', event.id);
    if (error) notify(dbErrorMessage(error, 'Não foi possível resolver o alerta.'));
    else load();
  };

  // Agrupa por ano, mantendo a ordem (mais recente primeiro).
  const byYear: [number, TimelineItem[]][] = [];
  for (const item of visible) {
    const year = item.date.getFullYear();
    const group = byYear[byYear.length - 1];
    if (group && group[0] === year) group[1].push(item);
    else byYear.push([year, [item]]);
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700">
        <ArrowLeft className="w-4 h-4" />
        Voltar para animais
      </button>

      {/* Cabeçalho: paciente e tutor */}
      <section className={`${cardClass} p-4 sm:p-6`}>
        <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div
              className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center ${
                animal.species === 'Cat' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <SpeciesIcon className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-slate-800">{animal.name}</h2>
                <button
                  onClick={() => openAnimalModal(animal)}
                  title="Editar cadastro do animal"
                  aria-label="Editar cadastro do animal"
                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-600">
                {speciesLabel[animal.species]} • {animal.breed} • {formatAge(animal.date_of_birth)}
              </p>
              <p className="text-sm text-slate-600">
                {lastWeight ? (
                  <>
                    <strong className="text-slate-800">{formatNumber(lastWeight.kg, 3)} kg</strong> em {formatDateTime(lastWeight.date, false)}
                  </>
                ) : (
                  <>
                    <strong className="text-slate-800">{formatNumber(animal.weight, 2)} kg</strong> (cadastro)
                  </>
                )}
                <span className="mx-2 text-slate-300">|</span>
                <ScanLine className="inline w-4 h-4 -mt-0.5 mr-1 text-slate-400" />
                {chip ? <span className="font-mono tracking-wider">{formatChipCode(chip.code)}</span> : <span className="text-amber-600">sem microchip</span>}
              </p>
            </div>
          </div>

          <div className="md:text-right text-sm text-slate-600 md:border-l md:border-slate-200 md:pl-6 min-w-0">
            <p className="text-xs uppercase tracking-wider text-slate-400">Tutor</p>
            <p className="font-semibold text-slate-800">{animal.clients.full_name}</p>
            <a href={`tel:${animal.clients.phone_number.replace(/\D/g, '')}`} className="flex md:justify-end items-center gap-1.5 hover:text-emerald-700">
              <Phone className="w-3.5 h-3.5" />
              {animal.clients.phone_number}
            </a>
            <a href={`mailto:${animal.clients.email}`} className="flex md:justify-end items-center gap-1.5 hover:text-emerald-700 break-all">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              {animal.clients.email}
            </a>
          </div>
        </div>

        {/* Alertas e lembretes fixos */}
        {(activeAlerts.length > 0 || nextVaccine || nextAppointment || hospitalized || animal.deceased_on) && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            {animal.deceased_on && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-white">Óbito em {formatDate(animal.deceased_on)}</span>
            )}
            {hospitalized && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                <BedDouble className="w-3.5 h-3.5" />
                Internado
              </span>
            )}
            {activeAlerts.map((a) => (
              <span key={a.id} title={a.content ?? undefined} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                {a.title}
              </span>
            ))}
            {nextVaccine && (
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  nextVaccine.next_dose_date! < today ? 'bg-orange-100 text-orange-700' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <Syringe className="w-3.5 h-3.5" />
                {nextVaccine.next_dose_date! < today ? 'Vacina atrasada' : 'Próxima vacina'}: {nextVaccine.vaccine_name} em {formatDate(nextVaccine.next_dose_date)}
              </span>
            )}
            {nextAppointment && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                <CalendarClock className="w-3.5 h-3.5" />
                {formatDate(nextAppointment.appointment_date)} às {nextAppointment.appointment_time.slice(0, 5)}: {nextAppointment.reason_for_visit}
              </span>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
          <button onClick={() => setAction('sale')} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600">
            <ShoppingCart className="w-4 h-4" />
            Lançar venda
          </button>
          {!hospitalized && !animal.deceased_on && (
            <button onClick={() => setAction('admit')} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
              <BedDouble className="w-4 h-4" />
              Internar
            </button>
          )}
          <button onClick={() => setAction('messages')} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
            <MessagesSquare className="w-4 h-4" />
            Conversas com o tutor
          </button>
          <button onClick={sharePetCard} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
            <Share2 className="w-4 h-4" />
            Enviar carteira de vacinação
          </button>
        </div>
      </section>

      {action === 'sale' && (
        <SaleModal
          context={{ clientId: animal.client_id, animalId: animal.id, appointmentId: appointments.find((a) => a.status === 'InProgress')?.id ?? null }}
          onClose={() => setAction(null)}
          onSaved={() => {}}
        />
      )}
      {action === 'admit' && <AdmitModal animal={animal} onClose={() => setAction(null)} onSaved={load} />}
      {action === 'messages' && <ClientMessagesModal client={animal.clients} animal={animal} onClose={() => setAction(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Adicionar + resumo (primeiro no celular) */}
        <aside className="space-y-6 lg:order-2">
          <section className={`${cardClass} p-4`}>
            <h3 className="font-semibold text-slate-800 mb-3">Adicionar registro</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-2 gap-2">
              {timelineKinds.map((kind) => {
                const { label, icon: Icon, tile } = kindMeta[kind];
                return (
                  <button
                    key={kind}
                    onClick={() => openNew(kind)}
                    className={`flex flex-col lg:flex-row items-center gap-1.5 lg:gap-2 px-2 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${tile}`}
                  >
                    <Icon className="w-5 h-5 lg:w-4 lg:h-4 shrink-0" />
                    <span className="text-center lg:text-left leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`${cardClass} p-4 text-sm`}>
            <h3 className="font-semibold text-slate-800 mb-3">Resumo clínico</h3>
            <dl className="space-y-3 text-slate-700">
              <div>
                <dt className="text-slate-500">Última consulta</dt>
                <dd>
                  {lastRecord?.kind === 'consultation' ? (
                    <>
                      {formatDateTime(lastRecord.date, false)} — {lastRecord.record.diagnosis}
                    </>
                  ) : (
                    'Nenhuma'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Patologias registradas</dt>
                <dd>{pathologies.length ? pathologies.join(', ') : 'Nenhuma'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Últimos sinais vitais</dt>
                <dd>{vitals[0] ? <VitalsLine event={vitals[0]} species={animal.species} /> : 'Não registrados'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Registros no histórico</dt>
                <dd>{timeline.length}</dd>
              </div>
            </dl>
          </section>
        </aside>

        {/* Abas */}
        <section className={`${cardClass} lg:col-span-2 lg:order-1 overflow-hidden`}>
          <div className="flex border-b border-slate-200 overflow-x-auto">
            {(
              [
                ['history', 'Histórico'],
                ['vaccines', `Vacinas${doses.some((d) => d.status === 'scheduled' && d.due_date < today) ? ' (atrasada)' : ''}`],
                ['evolution', 'Evolução'],
                ['agenda', `Agenda (${appointments.length})`],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 sm:px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  tab === id ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'history' && (
            <div className="p-4 sm:p-6">
              <div className="flex flex-wrap gap-2 mb-5">
                <FilterChip active={filter === null} onClick={() => setFilter(null)} label={`Todos (${timeline.length})`} />
                {timelineKinds
                  .filter((k) => counts[k])
                  .map((k) => (
                    <FilterChip key={k} active={filter === k} onClick={() => setFilter(filter === k ? null : k)} label={`${kindMeta[k].label} (${counts[k]})`} />
                  ))}
              </div>

              {visible.length === 0 ? (
                <p className="text-center text-slate-500 py-10">
                  Nenhum registro ainda. Use "Adicionar registro" para começar o histórico de {animal.name}.
                </p>
              ) : (
                byYear.map(([year, items]) => (
                  <div key={year} className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-slate-400 mb-3">{year}</h4>
                    <ol className="space-y-3">
                      {items.map((item) => (
                        <TimelineCard
                          key={item.key}
                          item={item}
                          previousWeight={item.kind === 'weight' ? previousWeight(weights, item.date) : undefined}
                          species={animal.species}
                          expanded={expanded.has(item.key)}
                          onToggle={() => toggle(item.key)}
                          onEdit={() => openEdit(item)}
                          onDelete={canDelete ? () => handleDelete(item) : undefined}
                          onResolve={item.kind === 'alert' && !item.event.resolved_at ? () => resolveAlert(item.event) : undefined}
                        />
                      ))}
                    </ol>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'vaccines' && (
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <button
                  onClick={() => setApplyingProtocol(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium"
                >
                  <Syringe className="w-4 h-4" />
                  Aplicar protocolo
                </button>
                <button
                  onClick={() => openNew('vaccine')}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
                >
                  Registrar vacina avulsa
                </button>
              </div>
              <VaccineSchedule
                doses={[...doses].sort((a, b) => (a.status === b.status ? a.due_date.localeCompare(b.due_date) : a.status === 'scheduled' ? -1 : 1))}
                onChanged={load}
                emptyText={`Nenhuma dose programada para ${animal.name}. Aplique um protocolo para programar as datas automaticamente.`}
              />
            </div>
          )}

          {tab === 'evolution' && (
            <div className="p-4 sm:p-6 space-y-8">
              <div>
                <h4 className="font-semibold text-slate-800 mb-3">Curva de peso</h4>
                {weights.length >= 2 ? (
                  <WeightChart points={weights} />
                ) : (
                  <p className="text-sm text-slate-500">Registre ao menos duas pesagens para ver a curva de peso.</p>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-3">Sinais vitais</h4>
                {vitals.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="text-left py-2 pr-4 font-medium">Data</th>
                          <th className="text-right py-2 px-2 font-medium">Temp. °C</th>
                          <th className="text-right py-2 px-2 font-medium">FC</th>
                          <th className="text-right py-2 px-2 font-medium">FR</th>
                          <th className="text-right py-2 px-2 font-medium">ECC</th>
                          <th className="text-right py-2 pl-2 font-medium">Dor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vitals.map((v) => (
                          <tr key={v.id}>
                            <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(new Date(v.occurred_at), true)}</td>
                            <VitalCell value={v.temperature_c} alert={outOfRange(animal.species, 'temperature_c', v.temperature_c)} />
                            <VitalCell value={v.heart_rate} alert={outOfRange(animal.species, 'heart_rate', v.heart_rate)} />
                            <VitalCell value={v.respiratory_rate} alert={outOfRange(animal.species, 'respiratory_rate', v.respiratory_rate)} />
                            <VitalCell value={v.body_condition_score} alert={v.body_condition_score != null && (v.body_condition_score <= 3 || v.body_condition_score >= 7)} />
                            <VitalCell value={v.pain_score} alert={v.pain_score != null && v.pain_score >= 4} />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-slate-500 mt-2">Valores em vermelho estão fora da faixa de referência para {speciesLabel[animal.species].toLowerCase()}s adultos.</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Nenhum sinal vital registrado.</p>
                )}
              </div>
            </div>
          )}

          {tab === 'agenda' && (
            <div className="p-4 sm:p-6">
              {appointments.length === 0 ? (
                <p className="text-center text-slate-500 py-10">Nenhum agendamento para {animal.name}.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {appointments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">
                          {formatDate(a.appointment_date)} às {a.appointment_time.slice(0, 5)}
                        </p>
                        <p className="text-slate-600 truncate">{a.reason_for_visit}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${statusStyle[a.status]}`}>{statusLabel[a.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      {applyingProtocol && <ApplyProtocolModal animal={animal} onClose={() => setApplyingProtocol(false)} onSaved={load} />}
      {modal?.kind === 'consultation' && (
        <MedicalRecordModal record={modal.record} fixedAnimal={animal} onClose={() => setModal(null)} onSaved={load} />
      )}
      {modal?.kind === 'vaccine' && (
        <VaccinationModal
          vaccination={modal.vaccination ? { ...modal.vaccination, clientId: animal.client_id } : null}
          fixedAnimal={animal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      {modal && modal.kind !== 'consultation' && modal.kind !== 'vaccine' && (
        <ClinicalEventModal
          type={modal.kind}
          event={modal.event}
          animal={animal}
          vaccinations={vaccinations}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function previousWeight(weights: { date: Date; kg: number }[], date: Date) {
  const before = weights.filter((w) => w.date.getTime() < date.getTime());
  return before[before.length - 1]?.kg;
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function VitalCell({ value, alert }: { value: number | null; alert: boolean }) {
  return (
    <td className={`py-2 px-2 text-right tabular-nums ${alert ? 'text-red-600 font-semibold' : 'text-slate-700'}`}>
      {value == null ? '-' : formatNumber(Number(value))}
    </td>
  );
}

function VitalsLine({ event, species }: { event: ClinicalEvent; species: 'Dog' | 'Cat' }) {
  const parts: [string, boolean][] = [];
  if (event.temperature_c != null) parts.push([`${formatNumber(Number(event.temperature_c))} °C`, outOfRange(species, 'temperature_c', event.temperature_c)]);
  if (event.heart_rate != null) parts.push([`FC ${event.heart_rate}`, outOfRange(species, 'heart_rate', event.heart_rate)]);
  if (event.respiratory_rate != null) parts.push([`FR ${event.respiratory_rate}`, outOfRange(species, 'respiratory_rate', event.respiratory_rate)]);
  if (event.body_condition_score != null) parts.push([`ECC ${event.body_condition_score}/9`, event.body_condition_score <= 3 || event.body_condition_score >= 7]);
  if (event.pain_score != null) parts.push([`Dor ${event.pain_score}/10`, event.pain_score >= 4]);
  return (
    <span>
      {parts.map(([text, alert], i) => (
        <span key={text} className={alert ? 'text-red-600 font-semibold' : undefined}>
          {i > 0 && <span className="text-slate-300 font-normal"> · </span>}
          {text}
        </span>
      ))}
    </span>
  );
}

function itemTitle(item: TimelineItem, previous?: number) {
  switch (item.kind) {
    case 'consultation':
      return item.record.diagnosis;
    case 'vaccine': {
      const v = item.vaccination;
      return v.dose_number ? `${v.vaccine_name} (dose ${v.dose_number}${v.total_doses ? `/${v.total_doses}` : ''})` : v.vaccine_name;
    }
    case 'weight': {
      const kg = Number(item.event.weight_kg);
      const delta = previous != null ? kg - previous : null;
      return `${formatNumber(kg, 3)} kg${delta ? ` (${delta > 0 ? '+' : ''}${formatNumber(delta, 3)} kg)` : ''}`;
    }
    case 'vitals':
      return null;
    default:
      return item.event.title;
  }
}

function itemAuthor(item: TimelineItem) {
  if (item.kind === 'consultation') return item.record.veterinarian_name;
  if (item.kind === 'vaccine') return item.vaccination.veterinarian_name;
  return item.event.author_email;
}

function TimelineCard({
  item,
  previousWeight,
  species,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onResolve,
}: {
  item: TimelineItem;
  previousWeight?: number;
  species: 'Dog' | 'Cat';
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onResolve?: () => void;
}) {
  const meta = kindMeta[item.kind];
  const Icon = meta.icon;
  const author = itemAuthor(item);
  const resolved = item.kind === 'alert' && item.event.resolved_at;

  const details: [string, string | null | undefined][] =
    item.kind === 'consultation'
      ? [
          ['Sintomas', item.record.symptoms],
          ['Diagnóstico', item.record.diagnosis],
          ['Procedimentos', item.record.procedures],
          ['Prescrição', item.record.prescribed_medication],
          ['Observações', item.record.observations],
        ]
      : item.kind === 'vaccine'
        ? [
            ['Fabricante', item.vaccination.manufacturer],
            ['Próxima dose', item.vaccination.next_dose_date ? formatDate(item.vaccination.next_dose_date) : null],
            ['Observações', item.vaccination.notes],
          ]
        : [[item.kind === 'alert' && resolved ? `Resolvido em ${formatDateTime(new Date(item.event.resolved_at!), false)}` : '', item.event.content]];

  const filled = details.filter(([, value]) => value && value.trim());

  return (
    <li className={`border border-slate-200 border-l-4 ${meta.border} rounded-lg ${resolved ? 'opacity-60' : ''}`}>
      <button onClick={onToggle} className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 rounded-r-lg">
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${meta.text}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800">
            <span className={`font-semibold ${meta.text}`}>{meta.label}</span>
            {item.kind === 'vitals' ? (
              <span className="ml-2">
                <VitalsLine event={item.event} species={species} />
              </span>
            ) : (
              <span className="ml-2 break-words">{itemTitle(item, previousWeight)}</span>
            )}
            {resolved && <span className="ml-2 text-xs text-slate-500">(resolvido)</span>}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatDateTime(item.date, item.hasTime)}
            {author && <> • {author}</>}
          </p>
        </div>
        {filled.length > 0 && (expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />)}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pl-11 space-y-2 text-sm text-slate-700">
          {filled.map(([label, value]) => (
            <div key={label}>
              {label && <p className="text-xs font-medium text-slate-500">{label}</p>}
              <p className="whitespace-pre-wrap break-words">{value}</p>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            {onResolve && (
              <button onClick={onResolve} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                <CheckCircle2 className="w-4 h-4" />
                Marcar como resolvido
              </button>
            )}
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50">
              <Edit className="w-4 h-4" />
              Editar
            </button>
            {onDelete && (
              <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function WeightChart({ points }: { points: { date: Date; kg: number }[] }) {
  const W = 600;
  const H = 200;
  const pad = { l: 44, r: 16, t: 16, b: 28 };
  const kgs = points.map((p) => p.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const span = max - min || 1;
  const t0 = points[0].date.getTime();
  const tSpan = points[points.length - 1].date.getTime() - t0 || 1;
  const x = (d: Date) => pad.l + ((d.getTime() - t0) / tSpan) * (W - pad.l - pad.r);
  const y = (kg: number) => pad.t + (1 - (kg - min) / span) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Curva de peso">
      {[min, (min + max) / 2, max].map((kg) => (
        <g key={kg}>
          <line x1={pad.l} x2={W - pad.r} y1={y(kg)} y2={y(kg)} className="stroke-slate-100" />
          <text x={pad.l - 6} y={y(kg) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">
            {formatNumber(kg)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" strokeWidth={2.5} className="stroke-emerald-500" />
      {points.map((p) => (
        <circle key={p.date.getTime()} cx={x(p.date)} cy={y(p.kg)} r={4} className="fill-white stroke-emerald-500" strokeWidth={2}>
          <title>
            {formatDateTime(p.date, false)}: {formatNumber(p.kg, 3)} kg
          </title>
        </circle>
      ))}
      <text x={pad.l} y={H - 6} className="fill-slate-400 text-[11px]">
        {formatDateTime(points[0].date, false)}
      </text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" className="fill-slate-400 text-[11px]">
        {formatDateTime(points[points.length - 1].date, false)}
      </text>
    </svg>
  );
}
