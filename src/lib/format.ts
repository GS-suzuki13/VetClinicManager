import type { Animal, Appointment } from './supabase';

// Datas no formato YYYY-MM-DD usam o fuso LOCAL. `toISOString()` usa UTC e, no
// Brasil, vira o dia seguinte a partir das 21h.
export function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return toISODate(new Date());
}

// `new Date('2026-12-01')` é meia-noite UTC (30/11 no Brasil); monta a data local.
export function parseISODate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(iso: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!iso) return '-';
  return parseISODate(iso).toLocaleDateString('pt-BR', options ?? { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const speciesLabel: Record<Animal['species'], string> = {
  Dog: 'Cachorro',
  Cat: 'Gato',
};

export const statusLabel: Record<Appointment['status'], string> = {
  Scheduled: 'Agendado',
  Confirmed: 'Confirmado',
  Waiting: 'Em espera',
  InProgress: 'Em atendimento',
  Completed: 'Atendido',
  Cancelled: 'Cancelado',
  NoShow: 'Não compareceu',
};

export const statusStyle: Record<Appointment['status'], string> = {
  Scheduled: 'bg-slate-100 text-slate-700',
  Confirmed: 'bg-blue-100 text-blue-700',
  Waiting: 'bg-amber-100 text-amber-800',
  InProgress: 'bg-emerald-100 text-emerald-800',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
  NoShow: 'bg-orange-100 text-orange-700',
};

// Agendamentos ainda por acontecer ou em andamento.
export const openStatuses: Appointment['status'][] = ['Scheduled', 'Confirmed', 'Waiting', 'InProgress'];

// Horário passou e o animal ainda não chegou.
export function isLate(appointment: Pick<Appointment, 'status' | 'appointment_date' | 'appointment_time'>, now = new Date()) {
  if (appointment.status !== 'Scheduled' && appointment.status !== 'Confirmed') return false;
  const start = parseISODate(appointment.appointment_date);
  const [h, m] = appointment.appointment_time.split(':').map(Number);
  start.setHours(h, m);
  return start.getTime() < now.getTime();
}

export const careTypes = ['Consulta', 'Retorno', 'Vacinação', 'Cirurgia', 'Exame', 'Emergência', 'Banho e tosa', 'Teleconsulta'];

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

// Mensagem amigável para erros do PostgREST/Postgres.
export function dbErrorMessage(error: { code?: string; message?: string } | null | undefined, fallback: string) {
  switch (error?.code) {
    case '23505':
      return 'Já existe um registro com estes dados (ex.: CPF já cadastrado nesta clínica).';
    case '23503':
      return 'Registro relacionado inválido. Atualize a página e tente novamente.';
    case '23514':
    case '22P02':
      return 'Há campos com valores inválidos.';
    case '23P01':
      return 'Este profissional já tem um agendamento nesse horário.';
    case '42501':
      return 'Você não tem permissão para esta ação.';
    // Regras de negócio das RPCs: a mensagem já é para o usuário.
    case 'P0001':
      return error?.message ?? fallback;
    default:
      return fallback;
  }
}

// Junta o texto ditado por voz ao que já está no campo.
export function appendText(current: string, addition: string) {
  if (!addition) return current;
  if (!current.trim()) return addition.charAt(0).toUpperCase() + addition.slice(1);
  return `${current.replace(/\s+$/, '')}${/[.!?:]$/.test(current.trim()) ? ' ' : '. '}${addition}`;
}
