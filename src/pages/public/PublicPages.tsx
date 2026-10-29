import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { CalendarCheck, Dog, Syringe, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { careTypes, formatDate, speciesLabel, toISODate } from '../../lib/format';
import { fieldClass, labelClass } from '../../components/Modal';

// Páginas abertas ao tutor sem login (links enviados pela clínica):
// ?nps=<token> pesquisa de satisfação, ?agendar=<slug> agendamento online,
// ?pet=<token> cartão do pet (vacinas e próximas consultas).

export default function PublicRoute() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('nps')) return <NpsPage token={params.get('nps')!} />;
  if (params.get('agendar')) return <BookingPage slug={params.get('agendar')!} />;
  if (params.get('pet')) return <PetCardPage token={params.get('pet')!} />;
  return null;
}

function Shell({ clinic, children }: { clinic?: string | null; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white">
        <div className="max-w-xl mx-auto flex items-center gap-3 px-4 py-4">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <Dog className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold leading-tight">{clinic ?? 'VetClinic'}</p>
            <p className="text-xs text-slate-400">via VetClinic</p>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-xl mx-auto p-4 sm:py-8">{children}</main>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">{children}</div>;
}

function NotFound({ text }: { text: string }) {
  return (
    <Shell>
      <Panel>
        <p className="text-center text-slate-600 py-6">{text}</p>
      </Panel>
    </Shell>
  );
}

function NpsPage({ token }: { token: string }) {
  const [info, setInfo] = useState<{ clinic_name: string; tutor_first_name: string; answered: boolean } | null | undefined>(undefined);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.rpc('get_nps_survey', { p_token: token }).then(({ data }) => setInfo(data ?? null));
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (score === null) return;
    await supabase.rpc('submit_nps', { p_token: token, p_score: score, p_comment: comment });
    setDone(true);
  };

  if (info === undefined) return null;
  if (info === null) return <NotFound text="Pesquisa não encontrada." />;

  return (
    <Shell clinic={info.clinic_name}>
      <Panel>
        {done || info.answered ? (
          <p className="text-center text-lg text-slate-700 py-6">Obrigado pela sua resposta! 💚</p>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <h1 className="text-xl font-bold text-slate-800">
              Olá{info.tutor_first_name ? `, ${info.tutor_first_name}` : ''}! De 0 a 10, quanto você recomendaria a {info.clinic_name} para um amigo?
            </h1>
            <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  className={`h-11 rounded-lg font-semibold border transition-colors ${
                    score === n ? 'bg-emerald-500 border-emerald-500 text-white' : n <= 6 ? 'border-red-200 text-red-700 hover:bg-red-50' : n <= 8 ? 'border-amber-200 text-amber-800 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div>
              <label className={labelClass}>Quer contar o motivo? (opcional)</label>
              <textarea rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} className={fieldClass} />
            </div>
            <button type="submit" disabled={score === null} className="w-full py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-semibold">
              Enviar
            </button>
          </form>
        )}
      </Panel>
    </Shell>
  );
}

const publicCareTypes = careTypes.filter((t) => ['Consulta', 'Retorno', 'Vacinação', 'Exame', 'Banho e tosa', 'Teleconsulta'].includes(t));

function BookingPage({ slug }: { slug: string }) {
  const [info, setInfo] = useState<{ clinic_name: string; phone: string | null; address: string | null; days: number[] } | null | undefined>(undefined);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<string[] | null>(null);
  const [form, setForm] = useState({ time: '', tutor_name: '', phone: '', email: '', pet_name: '', species: 'Dog', care_type: 'Consulta', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.rpc('online_booking_info', { p_slug: slug }).then(({ data }) => setInfo(data ?? null));
  }, [slug]);

  // Próximos 21 dias de atendimento.
  const days: string[] = [];
  if (info) {
    for (let i = 0; days.length < 14 && i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.getDay() === 0 ? 7 : d.getDay();
      if (info.days.includes(iso)) days.push(toISODate(d));
    }
  }

  useEffect(() => {
    if (!date) return;
    setSlots(null);
    setForm((f) => ({ ...f, time: '' }));
    supabase.rpc('online_booking_slots', { p_slug: slug, p_date: date }).then(({ data }) => setSlots(((data as string[] | null) ?? []).map((s) => (typeof s === 'string' ? s : Object.values(s)[0] as string))));
  }, [date, slug]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('request_online_booking', {
      p_slug: slug,
      p_tutor_name: form.tutor_name,
      p_phone: form.phone,
      p_email: form.email,
      p_pet_name: form.pet_name,
      p_species: form.species,
      p_care_type: form.care_type,
      p_date: date,
      p_time: form.time,
      p_notes: form.notes,
    });
    setBusy(false);
    if (error) setError(error.code === 'P0001' ? error.message : 'Não foi possível enviar. Confira os dados e tente novamente.');
    else setDone(true);
  };

  if (info === undefined) return null;
  if (info === null) return <NotFound text="Agendamento online indisponível para esta clínica." />;

  return (
    <Shell clinic={info.clinic_name}>
      <Panel>
        {done ? (
          <div className="text-center py-6 space-y-2">
            <CalendarCheck className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-lg font-semibold text-slate-800">Pedido enviado!</p>
            <p className="text-slate-600">
              A {info.clinic_name} vai confirmar {formatDate(date)} às {form.time} pelo WhatsApp.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h1 className="text-xl font-bold text-slate-800">Agende um horário</h1>
            {info.address && <p className="text-sm text-slate-500">{info.address}</p>}
            <div>
              <label className={labelClass}>Tipo de atendimento</label>
              <select value={form.care_type} onChange={(e) => setForm({ ...form, care_type: e.target.value })} className={fieldClass}>
                {publicCareTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Dia</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDate(d)}
                    className={`shrink-0 w-16 py-2 rounded-lg border text-center text-sm ${date === d ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 text-slate-700 hover:border-emerald-400'}`}
                  >
                    <span className="block text-xs capitalize">{new Date(`${d}T12:00`).toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                    <span className="font-semibold">{d.slice(8)}/{d.slice(5, 7)}</span>
                  </button>
                ))}
              </div>
            </div>
            {date && (
              <div>
                <label className={labelClass}>Horário</label>
                {slots === null ? (
                  <p className="text-sm text-slate-500">Carregando...</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-slate-500">Sem horários livres neste dia.</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {slots.map((s) => (
                      <button key={s} type="button" onClick={() => setForm({ ...form, time: s })} className={`py-2 rounded-lg border text-sm ${form.time === s ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 hover:border-emerald-400'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {form.time && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required minLength={2} maxLength={120} value={form.tutor_name} onChange={(e) => setForm({ ...form, tutor_name: e.target.value })} placeholder="Seu nome" className={fieldClass} />
                  <input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="WhatsApp com DDD" className={fieldClass} />
                  <input required maxLength={80} value={form.pet_name} onChange={(e) => setForm({ ...form, pet_name: e.target.value })} placeholder="Nome do pet" className={fieldClass} />
                  <select value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} className={fieldClass}>
                    <option value="Dog">Cachorro</option>
                    <option value="Cat">Gato</option>
                  </select>
                </div>
                <input type="email" maxLength={160} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail (opcional)" className={fieldClass} />
                <textarea rows={2} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="O que está acontecendo? (opcional)" className={fieldClass} />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={busy} className="w-full py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-semibold">
                  {busy ? 'Enviando...' : `Pedir ${formatDate(date)} às ${form.time}`}
                </button>
                <p className="text-xs text-slate-500 text-center">Seus dados são usados só para este agendamento.</p>
              </>
            )}
          </form>
        )}
      </Panel>
    </Shell>
  );
}

interface PetCard {
  clinic_name: string;
  clinic_phone: string | null;
  pet: { name: string; species: 'Dog' | 'Cat'; breed: string; date_of_birth: string };
  vaccinations: { name: string; date: string; next: string | null }[];
  scheduled_doses: { name: string; due: string }[];
  appointments: { date: string; time: string; type: string | null; video_url: string | null }[];
}

function PetCardPage({ token }: { token: string }) {
  const [card, setCard] = useState<PetCard | null | undefined>(undefined);
  useEffect(() => {
    supabase.rpc('get_pet_card', { p_token: token }).then(({ data }) => setCard(data ?? null));
  }, [token]);

  if (card === undefined) return null;
  if (card === null) return <NotFound text="Link expirado ou inválido. Peça um novo à clínica." />;

  return (
    <Shell clinic={card.clinic_name}>
      <div className="space-y-4">
        <Panel>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Dog className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{card.pet.name}</h1>
              <p className="text-sm text-slate-500">
                {speciesLabel[card.pet.species]} • {card.pet.breed} • nasceu em {formatDate(card.pet.date_of_birth)}
              </p>
            </div>
          </div>
        </Panel>
        {card.appointments.length > 0 && (
          <Panel>
            <h2 className="font-semibold text-slate-800">Próximos atendimentos</h2>
            <ul className="space-y-2 text-sm">
              {card.appointments.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span>
                    {formatDate(a.date)} às {a.time} • {a.type ?? 'Consulta'}
                  </span>
                  {a.video_url && (
                    <a href={a.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-700 font-medium">
                      <Video className="w-4 h-4" /> Entrar
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <Panel>
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Syringe className="w-4 h-4 text-emerald-600" /> Carteira de vacinação
          </h2>
          {card.scheduled_doses.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-3 text-sm space-y-1">
              {card.scheduled_doses.map((d, i) => (
                <p key={i} className="text-amber-900">
                  Próxima: {d.name} em {formatDate(d.due)}
                </p>
              ))}
            </div>
          )}
          <ul className="divide-y divide-slate-100 text-sm">
            {card.vaccinations.length === 0 && <li className="py-2 text-slate-500">Nenhuma vacina registrada.</li>}
            {card.vaccinations.map((v, i) => (
              <li key={i} className="flex justify-between gap-2 py-2">
                <span className="text-slate-800">{v.name}</span>
                <span className="text-slate-500">{formatDate(v.date)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        {card.clinic_phone && <p className="text-center text-sm text-slate-500">Dúvidas? Fale com a clínica: {card.clinic_phone}</p>}
      </div>
    </Shell>
  );
}
