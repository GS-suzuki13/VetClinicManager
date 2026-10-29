import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, Star } from 'lucide-react';
import {
  supabase,
  Animal,
  Appointment,
  BookingRequest,
  Client,
  ClientMessage,
  ClinicSettings,
  MessageTemplate,
  NpsSurvey,
  TemplateKey,
} from '../lib/supabase';
import { dbErrorMessage, formatDate, todayISO, toISODate } from '../lib/format';
import { formatBRL, formatDateTime } from '../lib/money';
import { channelLabel, fillTemplate, firstName, publicUrl, sendWhatsapp, templateKeyLabel, TemplateVars } from '../lib/messages';
import { DoseWithDetails, doseSelect } from '../lib/vaccines';
import { useClinic } from '../context/AuthContext';
import { useClientsModal } from '../context/ClientsModalContext';
import { PageLoader } from '../components/PageToolbar';
import Modal, { FormActions, FormError, fieldClass, labelClass } from '../components/Modal';
import ClientMessagesModal from '../components/ClientMessagesModal';
import { Badge, Card, PrimaryButton, StatTile, Tabs } from '../components/ui';
import { askConfirm, notify } from '../lib/dialogs';

type Tab = 'reminders' | 'inbox' | 'nps' | 'booking' | 'templates';
type AptRow = Appointment & { clients: Client; animals: Pick<Animal, 'id' | 'name'> };

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export default function Relationship({ onOpenRecord }: { onOpenRecord: (animalId: string) => void }) {
  const clinic = useClinic();
  const [tab, setTab] = useState<Tab>('reminders');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [appointments, setAppointments] = useState<AptRow[]>([]);
  const [doses, setDoses] = useState<DoseWithDetails[]>([]);
  const [balances, setBalances] = useState<{ client_id: string; balance: number }[]>([]);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [surveys, setSurveys] = useState<NpsSurvey[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<Client | null>(null);

  const load = useCallback(async () => {
    const since = addDays(-365);
    const [t, c, a, ap, d, b, m, n, r, s] = await Promise.all([
      supabase.from('message_templates').select('*').order('name'),
      supabase.from('clients').select('*').order('full_name'),
      supabase.from('animals').select('*'),
      supabase.from('appointments').select('*, clients(*), animals(id, name)').gte('appointment_date', since).order('appointment_date'),
      supabase.from('vaccine_doses').select(doseSelect).eq('status', 'scheduled').lte('due_date', addDays(7)).order('due_date'),
      supabase.from('client_balances').select('client_id, balance').lt('balance', 0),
      supabase.from('client_messages').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('nps_surveys').select('*').order('created_at', { ascending: false }),
      supabase.from('booking_requests').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('clinics').select('*').eq('id', clinic.id).single(),
    ]);
    setTemplates(t.data ?? []);
    setClients(c.data ?? []);
    setAnimals(a.data ?? []);
    setAppointments((ap.data as AptRow[]) ?? []);
    setDoses((d.data as DoseWithDetails[]) ?? []);
    setBalances((b.data ?? []).map((x) => ({ client_id: x.client_id, balance: Number(x.balance) })));
    setMessages(m.data ?? []);
    setSurveys(n.data ?? []);
    setRequests(r.data ?? []);
    setSettings(s.data);
    setLoading(false);
  }, [clinic.id]);

  useEffect(() => {
    load();
  }, [load]);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const pending = requests.filter((r) => r.status === 'pending');

  if (loading) return <PageLoader />;

  const answered = surveys.filter((s) => s.score !== null);
  const promoters = answered.filter((s) => s.score! >= 9).length;
  const detractors = answered.filter((s) => s.score! <= 6).length;
  const nps = answered.length ? Math.round(((promoters - detractors) / answered.length) * 100) : null;

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatTile label="NPS" value={nps ?? '—'} tone={nps === null ? 'slate' : nps >= 50 ? 'emerald' : nps >= 0 ? 'amber' : 'red'} hint={`${answered.length} resposta(s)`} />
        <StatTile label="Pedidos de agendamento" value={pending.length} tone={pending.length ? 'blue' : 'slate'} hint="Aguardando resposta" />
        <StatTile label="Mensagens (30 dias)" value={messages.filter((m) => m.created_at >= addDays(-30)).length} />
        <StatTile label="Clientes devendo" value={balances.length} tone={balances.length ? 'red' : 'slate'} hint={balances.length ? formatBRL(-balances.reduce((s, b) => s + b.balance, 0)) : undefined} />
      </div>

      <Tabs
        tabs={[
          ['reminders', 'Lembretes'],
          ['inbox', 'Conversas'],
          ['nps', 'Satisfação (NPS)'],
          ['booking', `Agendamento online${pending.length ? ` (${pending.length})` : ''}`],
          ['templates', 'Modelos de mensagem'],
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'reminders' && (
        <Reminders
          clinicName={clinic.name}
          templates={templates}
          clients={clients}
          animals={animals}
          appointments={appointments}
          doses={doses}
          balances={balances}
          messages={messages}
          clientById={clientById}
          onSent={load}
          onOpenRecord={onOpenRecord}
        />
      )}

      {tab === 'inbox' && (
        <Card title="Últimas conversas">
          <ul className="divide-y divide-slate-100">
            {messages.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nenhuma mensagem registrada ainda.</li>}
            {[...new Map(messages.map((m) => [m.client_id, m])).values()].map((m) => {
              const c = clientById.get(m.client_id);
              return (
                <li key={m.id}>
                  <button onClick={() => c && setConversation(c)} className="w-full text-left flex items-start gap-3 px-4 sm:px-6 py-3 hover:bg-slate-50">
                    <MessageCircle className={`w-5 h-5 mt-0.5 shrink-0 ${m.direction === 'inbound' ? 'text-blue-600' : 'text-emerald-600'}`} />
                    <span className="flex-1 min-w-0">
                      <span className="flex justify-between gap-2">
                        <span className="font-medium text-slate-800">{c?.full_name ?? 'Cliente removido'}</span>
                        <span className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(m.created_at)}</span>
                      </span>
                      <span className="block text-sm text-slate-600 truncate">
                        {m.direction === 'inbound' ? '↙ ' : '↗ '}
                        {m.body}
                      </span>
                      <span className="text-xs text-slate-400">{channelLabel[m.channel]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {tab === 'nps' && <Nps surveys={surveys} appointments={appointments} templates={templates} clinicName={clinic.name} clientById={clientById} onChanged={load} />}
      {tab === 'booking' && settings && <Booking settings={settings} requests={requests} clients={clients} onChanged={load} />}
      {tab === 'templates' && <Templates templates={templates} onChanged={load} />}

      {conversation && (
        <ClientMessagesModal
          client={conversation}
          onClose={() => {
            setConversation(null);
            load();
          }}
        />
      )}
    </div>
  );
}

interface ReminderItem {
  key: string;
  client: Client;
  animal?: Pick<Animal, 'id' | 'name'> | null;
  title: string;
  detail: string;
  vars: TemplateVars;
  appointmentId?: string;
  confirmable?: AptRow;
}

function Reminders(props: {
  clinicName: string;
  templates: MessageTemplate[];
  clients: Client[];
  animals: Animal[];
  appointments: AptRow[];
  doses: DoseWithDetails[];
  balances: { client_id: string; balance: number }[];
  messages: ClientMessage[];
  clientById: Map<string, Client>;
  onSent: () => void;
  onOpenRecord: (animalId: string) => void;
}) {
  const { clinicName, templates, clients, animals, appointments, doses, balances, messages, clientById, onSent, onOpenRecord } = props;
  const today = todayISO();
  const tomorrow = addDays(1);
  const yesterday = addDays(-1);
  const sentRecently = (clientId: string, key: TemplateKey, days = 3) =>
    messages.some((m) => m.client_id === clientId && m.template_key === key && m.created_at >= addDays(-days));

  const groups: { key: TemplateKey; title: string; hint: string; items: ReminderItem[] }[] = [
    {
      key: 'appointment_confirm',
      title: 'Confirmar agendamentos de amanhã',
      hint: 'Reduz faltas: peça a confirmação um dia antes.',
      items: appointments
        .filter((a) => a.appointment_date === tomorrow && a.status === 'Scheduled' && a.clients)
        .map((a) => ({
          key: a.id,
          client: a.clients,
          animal: a.animals,
          title: `${a.animals?.name} • ${a.appointment_time.slice(0, 5)}`,
          detail: a.care_type ?? a.reason_for_visit,
          vars: { data: formatDate(a.appointment_date), hora: a.appointment_time.slice(0, 5) },
          appointmentId: a.id,
          confirmable: a,
        })),
    },
    {
      key: 'vaccine_due',
      title: 'Vacinas atrasadas ou vencendo em 7 dias',
      hint: 'Doses programadas pelos protocolos.',
      items: doses
        .filter((d) => d.animals)
        .map((d): ReminderItem | null => {
          const animal = animals.find((a) => a.id === d.animals!.id);
          const client = animal ? clientById.get(animal.client_id) : undefined;
          return client
            ? {
                key: d.id,
                client,
                animal: d.animals!,
                title: `${d.animals!.name} • ${d.vaccine_protocols.name}`,
                detail: d.due_date < today ? `Atrasada desde ${formatDate(d.due_date)}` : `Vence ${formatDate(d.due_date)}`,
                vars: { vacina: d.vaccine_protocols.name, data: formatDate(d.due_date) },
              }
            : null;
        })
        .filter((x): x is ReminderItem => !!x),
    },
    {
      key: 'return',
      title: 'Acompanhamento pós-consulta (atendidos ontem)',
      hint: 'A principal queixa dos tutores é a falta de retorno depois do atendimento.',
      items: appointments
        .filter((a) => a.appointment_date === yesterday && a.status === 'Completed' && a.clients)
        .map((a) => ({ key: a.id, client: a.clients, animal: a.animals, title: a.animals?.name ?? '', detail: a.care_type ?? a.reason_for_visit, vars: { data: formatDate(a.appointment_date) }, appointmentId: a.id })),
    },
    {
      key: 'debt',
      title: 'Clientes com saldo devedor',
      hint: 'Inadimplência é um dos maiores desafios financeiros das clínicas.',
      items: balances
        .map((b): ReminderItem | null => {
          const client = clientById.get(b.client_id);
          return client ? { key: b.client_id, client, title: client.full_name, detail: `Deve ${formatBRL(-b.balance)}`, vars: { valor: formatBRL(-b.balance) } } : null;
        })
        .filter((x): x is ReminderItem => !!x),
    },
    {
      key: 'birthday',
      title: 'Aniversários dos pets (próximos 7 dias)',
      hint: '',
      items: animals
        .filter((a) => !a.deceased_on && a.date_of_birth)
        .filter((a) => {
          for (let i = 0; i <= 7; i++) if (addDays(i).slice(5) === a.date_of_birth.slice(5)) return true;
          return false;
        })
        .map((a): ReminderItem | null => {
          const client = clientById.get(a.client_id);
          return client ? { key: a.id, client, animal: a, title: a.name, detail: `Aniversário ${formatDate(a.date_of_birth, { day: '2-digit', month: '2-digit' })}`, vars: {} } : null;
        })
        .filter((x): x is ReminderItem => !!x),
    },
    {
      key: 'inactive',
      title: 'Clientes sem visita há mais de 6 meses',
      hint: 'Dois terços das clínicas têm dificuldade de reter clientes.',
      items: clients
        .filter((c) => {
          const visits = appointments.filter((a) => a.client_id === c.id);
          const last = visits.map((a) => a.appointment_date).sort().pop();
          return c.created_at.slice(0, 10) < addDays(-180) && (!last || last < addDays(-180)) && !visits.some((a) => a.appointment_date >= today);
        })
        .slice(0, 40)
        .map((c) => {
          const pet = animals.find((a) => a.client_id === c.id && !a.deceased_on);
          return { key: c.id, client: c, animal: pet, title: c.full_name, detail: pet ? `Pet: ${pet.name}` : 'Sem pet ativo', vars: {} };
        }),
    },
  ];

  const send = async (key: TemplateKey, item: ReminderItem) => {
    const body = templates.find((t) => t.key === key && t.active)?.body ?? '';
    const text = fillTemplate(body, { tutor: firstName(item.client.full_name), pet: item.animal?.name ?? 'seu pet', clinica: clinicName, ...item.vars });
    await sendWhatsapp({ phone: item.client.phone_number, text, clientId: item.client.id, animalId: item.animal?.id, appointmentId: item.appointmentId, templateKey: key });
    onSent();
  };

  const markConfirmed = async (apt: AptRow) => {
    const { error } = await supabase.from('appointments').update({ status: 'Confirmed' }).eq('id', apt.id);
    if (error) notify(dbErrorMessage(error, 'Não foi possível confirmar.'));
    onSent();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {groups.map((g) => (
        <Card key={g.key} title={`${g.title} (${g.items.length})`}>
          {g.hint && <p className="px-4 sm:px-6 pt-3 text-xs text-slate-500">{g.hint}</p>}
          <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {g.items.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nada pendente.</li>}
            {g.items.map((item) => {
              const sent = sentRecently(item.client.id, g.key);
              return (
                <li key={item.key} className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 text-sm">
                  <div className="flex-1 min-w-[10rem]">
                    {item.animal ? (
                      <button onClick={() => onOpenRecord(item.animal!.id)} className="font-medium text-slate-800 hover:text-emerald-700 text-left">
                        {item.title}
                      </button>
                    ) : (
                      <p className="font-medium text-slate-800">{item.title}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      {item.client.full_name} • {item.detail}
                    </p>
                  </div>
                  {item.confirmable && (
                    <button onClick={() => markConfirmed(item.confirmable!)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50">
                      <Check className="w-4 h-4" /> Confirmado
                    </button>
                  )}
                  <button
                    onClick={() => send(g.key, item)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${sent ? 'bg-slate-100 text-slate-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    {sent ? 'Enviado • reenviar' : 'WhatsApp'}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function Nps({ surveys, appointments, templates, clinicName, clientById, onChanged }: { surveys: NpsSurvey[]; appointments: AptRow[]; templates: MessageTemplate[]; clinicName: string; clientById: Map<string, Client>; onChanged: () => void }) {
  const surveyed = new Set(surveys.map((s) => s.appointment_id));
  const candidates = appointments.filter((a) => a.status === 'Completed' && a.appointment_date >= addDays(-7) && !surveyed.has(a.id) && a.clients);

  const sendSurvey = async (apt: AptRow) => {
    const { data, error } = await supabase.from('nps_surveys').insert({ client_id: apt.client_id, appointment_id: apt.id }).select().single();
    if (error) {
      notify(dbErrorMessage(error, 'Não foi possível criar a pesquisa.'));
      return;
    }
    const body = templates.find((t) => t.key === 'nps')?.body ?? 'De 0 a 10, quanto você recomendaria a {clinica}? {link}';
    const text = fillTemplate(body, { tutor: firstName(apt.clients.full_name), pet: apt.animals?.name, clinica: clinicName, link: publicUrl('nps', data.token) });
    await sendWhatsapp({ phone: apt.clients.phone_number, text, clientId: apt.client_id, animalId: apt.animal_id, appointmentId: apt.id, templateKey: 'nps' });
    onChanged();
  };

  const scoreStyle = (s: number) => (s >= 9 ? 'bg-green-100 text-green-700' : s >= 7 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Enviar pesquisa (atendidos nos últimos 7 dias)">
        <ul className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
          {candidates.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nenhum atendimento sem pesquisa.</li>}
          {candidates.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 text-sm">
              <span>
                <span className="font-medium text-slate-800">{a.clients.full_name}</span>
                <span className="block text-xs text-slate-500">
                  {a.animals?.name} • {formatDate(a.appointment_date)}
                </span>
              </span>
              <button onClick={() => sendSurvey(a)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600">
                <Star className="w-4 h-4" /> Enviar
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Respostas">
        <ul className="divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
          {surveys.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nenhuma pesquisa enviada.</li>}
          {surveys.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 px-4 sm:px-6 py-3 text-sm">
              <span>
                <span className="font-medium text-slate-800">{clientById.get(s.client_id)?.full_name}</span>
                <span className="block text-xs text-slate-500">{s.answered_at ? `Respondida ${formatDateTime(s.answered_at)}` : `Enviada ${formatDateTime(s.created_at)} • aguardando`}</span>
                {s.comment && <span className="block text-slate-600 mt-1">“{s.comment}”</span>}
              </span>
              {s.score !== null && <Badge className={scoreStyle(s.score)}>{s.score}</Badge>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const weekDays: [number, string][] = [
  [1, 'Seg'],
  [2, 'Ter'],
  [3, 'Qua'],
  [4, 'Qui'],
  [5, 'Sex'],
  [6, 'Sáb'],
  [7, 'Dom'],
];

function Booking({ settings, requests, clients, onChanged }: { settings: ClinicSettings; requests: BookingRequest[]; clients: Client[]; onChanged: () => void }) {
  const clinic = useClinic();
  const canEdit = clinic.role === 'owner' || clinic.role === 'admin';
  const [form, setForm] = useState({
    booking_enabled: settings.booking_enabled,
    booking_slug: settings.booking_slug ?? clinic.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) + `-${clinic.id.slice(0, 4)}`,
    booking_open: settings.booking_open.slice(0, 5),
    booking_close: settings.booking_close.slice(0, 5),
    booking_slot_minutes: settings.booking_slot_minutes,
    booking_days: settings.booking_days,
    phone: settings.phone ?? '',
    address: settings.address ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [accepting, setAccepting] = useState<BookingRequest | null>(null);
  const link = settings.booking_slug ? publicUrl('agendar', settings.booking_slug) : null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase
      .from('clinics')
      .update({ ...form, booking_slug: form.booking_slug || null, phone: form.phone || null, address: form.address || null })
      .eq('id', clinic.id);
    if (error) setError(error.code === '23505' ? 'Este endereço de agendamento já está em uso por outra clínica.' : dbErrorMessage(error, 'Não foi possível salvar.'));
    else {
      setSaved(true);
      onChanged();
    }
  };

  const decline = async (r: BookingRequest) => {
    if (!(await askConfirm(`Recusar o pedido de ${r.tutor_name}?`, { danger: true, confirmLabel: 'Recusar' }))) return;
    await supabase.from('booking_requests').update({ status: 'declined' }).eq('id', r.id);
    onChanged();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <Card title="Pedidos recebidos" className="lg:col-span-3">
        <ul className="divide-y divide-slate-100">
          {requests.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Nenhum pedido ainda. Divulgue o link de agendamento no Instagram, Google e WhatsApp.</li>}
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 text-sm">
              <div className="flex-1 min-w-[12rem]">
                <p className="font-medium text-slate-800">
                  {formatDate(r.requested_date)} às {r.requested_time.slice(0, 5)} • {r.care_type}
                </p>
                <p className="text-xs text-slate-500">
                  {r.tutor_name} • {r.phone} • {r.pet_name} ({r.species === 'Dog' ? 'cão' : 'gato'})
                </p>
                {r.notes && <p className="text-xs text-slate-600 mt-0.5">“{r.notes}”</p>}
              </div>
              {r.status === 'pending' ? (
                <div className="flex gap-2">
                  <button onClick={() => decline(r)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100">
                    Recusar
                  </button>
                  <button onClick={() => setAccepting(r)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600">
                    Aceitar
                  </button>
                </div>
              ) : (
                <Badge className={r.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>{r.status === 'accepted' ? 'Agendado' : 'Recusado'}</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Configuração" className="lg:col-span-2">
        <form onSubmit={save} className="p-4 sm:p-6 space-y-3">
          <FormError message={error} />
          {link && settings.booking_enabled && (
            <div className="flex items-center gap-2 bg-emerald-50 rounded-lg p-3 text-sm">
              <span className="flex-1 truncate text-emerald-800">{link}</span>
              <button type="button" title="Copiar" onClick={() => navigator.clipboard.writeText(link)} className="p-1.5 rounded hover:bg-emerald-100 text-emerald-700">
                <Copy className="w-4 h-4" />
              </button>
              <a href={link} target="_blank" rel="noreferrer" title="Abrir" className="p-1.5 rounded hover:bg-emerald-100 text-emerald-700">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" disabled={!canEdit} checked={form.booking_enabled} onChange={(e) => setForm({ ...form, booking_enabled: e.target.checked })} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Aceitar agendamentos pelo link público
          </label>
          <div>
            <label className={labelClass}>Endereço do link</label>
            <input disabled={!canEdit} value={form.booking_slug} onChange={(e) => setForm({ ...form, booking_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} pattern="[a-z0-9][a-z0-9-]{2,40}" className={fieldClass} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>Abre</label>
              <input type="time" disabled={!canEdit} value={form.booking_open} onChange={(e) => setForm({ ...form, booking_open: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Fecha</label>
              <input type="time" disabled={!canEdit} value={form.booking_close} onChange={(e) => setForm({ ...form, booking_close: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Intervalo</label>
              <select disabled={!canEdit} value={form.booking_slot_minutes} onChange={(e) => setForm({ ...form, booking_slot_minutes: Number(e.target.value) })} className={fieldClass}>
                {[15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {weekDays.map(([n, label]) => {
              const on = form.booking_days.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setForm({ ...form, booking_days: on ? form.booking_days.filter((d) => d !== n) : [...form.booking_days, n].sort() })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${on ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <input disabled={!canEdit} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} placeholder="Telefone da clínica" className={fieldClass} />
          <input disabled={!canEdit} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={300} placeholder="Endereço da clínica" className={fieldClass} />
          {canEdit && <PrimaryButton type="submit">{saved ? 'Salvo ✓' : 'Salvar'}</PrimaryButton>}
          <p className="text-xs text-slate-500">Os horários livres consideram a agenda e o número de veterinários da equipe. O pedido só vira agendamento quando a recepção aceita.</p>
        </form>
      </Card>

      {accepting && <AcceptModal request={accepting} clients={clients} onClose={() => setAccepting(null)} onSaved={onChanged} />}
    </div>
  );
}

function AcceptModal({ request, clients, onClose, onSaved }: { request: BookingRequest; clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const { openModal: openClientModal } = useClientsModal();
  const digits = (s: string) => s.replace(/\D/g, '');
  const match = clients.find((c) => digits(c.phone_number).endsWith(request.phone.slice(-8)));
  const [clientId, setClientId] = useState(match?.id ?? '');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animalId, setAnimalId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    supabase
      .from('animals')
      .select('*')
      .eq('client_id', clientId)
      .then(({ data }) => {
        setAnimals(data ?? []);
        setAnimalId(data?.find((a) => a.name.toLowerCase() === request.pet_name.toLowerCase())?.id ?? '');
      });
  }, [clientId, request.pet_name]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc('accept_booking_request', { p_request_id: request.id, p_client_id: clientId, p_animal_id: animalId });
    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível agendar.'));
      return;
    }
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      const text = `Olá, ${firstName(client.full_name)}! Seu agendamento para ${request.pet_name} em ${formatDate(request.requested_date)} às ${request.requested_time.slice(0, 5)} está confirmado.`;
      if ((await askConfirm('Agendado! Enviar a confirmação pelo WhatsApp?', { title: 'Agendado', confirmLabel: 'Enviar' }))) await sendWhatsapp({ phone: request.phone, text, clientId: client.id, animalId });
    }
    onSaved();
    onClose();
  };

  return (
    <Modal title="Aceitar pedido de agendamento" onClose={onClose} size="md">
      <form onSubmit={submit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />
        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
          {request.tutor_name} ({request.phone}) pediu {request.care_type.toLowerCase()} para <strong>{request.pet_name}</strong> em {formatDate(request.requested_date)} às {request.requested_time.slice(0, 5)}.
        </p>
        <div>
          <label className={labelClass}>Tutor cadastrado *</label>
          <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className={fieldClass}>
            <option value="">Selecione</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} • {c.phone_number}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => openClientModal()} className="text-xs text-emerald-700 font-medium hover:underline mt-1">
            + Cadastrar novo tutor
          </button>
        </div>
        <div>
          <label className={labelClass}>Animal *</label>
          <select required value={animalId} onChange={(e) => setAnimalId(e.target.value)} className={fieldClass} disabled={!clientId}>
            <option value="">Selecione</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">Pet novo? Cadastre pelo menu Animais e volte aqui.</p>
        </div>
        <FormActions submitLabel="Agendar" onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}

function Templates({ templates, onChanged }: { templates: MessageTemplate[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Record<string, string>>({});
  const save = async (t: MessageTemplate) => {
    const { error } = await supabase.from('message_templates').update({ body: editing[t.id] }).eq('id', t.id);
    if (error) notify(dbErrorMessage(error, 'Não foi possível salvar.'));
    setEditing((prev) => {
      const next = { ...prev };
      delete next[t.id];
      return next;
    });
    onChanged();
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Etiquetas disponíveis: <code>{'{tutor}'}</code> <code>{'{pet}'}</code> <code>{'{clinica}'}</code> <code>{'{data}'}</code> <code>{'{hora}'}</code> <code>{'{vacina}'}</code> <code>{'{valor}'}</code> <code>{'{link}'}</code>. Não inclua diagnósticos nas mensagens (LGPD).
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {templates.map((t) => (
          <Card key={t.id} title={templateKeyLabel[t.key] ?? t.name}>
            <div className="p-4 sm:p-6 space-y-2">
              <textarea rows={4} maxLength={1000} value={editing[t.id] ?? t.body} onChange={(e) => setEditing({ ...editing, [t.id]: e.target.value })} className={fieldClass} />
              {editing[t.id] !== undefined && editing[t.id] !== t.body && <PrimaryButton onClick={() => save(t)}>Salvar modelo</PrimaryButton>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
