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
  Completed: 'Concluído',
  Cancelled: 'Cancelado',
};

export const statusStyle: Record<Appointment['status'], string> = {
  Scheduled: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-700',
};

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
    case '42501':
      return 'Você não tem permissão para esta ação.';
    default:
      return fallback;
  }
}
