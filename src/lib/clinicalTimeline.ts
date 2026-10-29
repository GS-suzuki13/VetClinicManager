import {
  AlertTriangle,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartPulse,
  LucideIcon,
  MessageSquare,
  Microscope,
  Scale,
  Stethoscope,
  Syringe,
} from 'lucide-react';
import type { Animal, ClinicalEvent, ClinicalEventType, MedicalRecord, Vaccination } from './supabase';
import { parseISODate } from './format';

// Consultas e vacinas vêm das tabelas próprias; o resto, de `clinical_events`.
export type TimelineKind = 'consultation' | 'vaccine' | ClinicalEventType;

interface KindMeta {
  label: string;
  icon: LucideIcon;
  // Ícone/realce, borda do card e botão de "Adicionar".
  text: string;
  border: string;
  tile: string;
}

export const kindMeta: Record<TimelineKind, KindMeta> = {
  consultation: { label: 'Consulta', icon: Stethoscope, text: 'text-blue-600', border: 'border-l-blue-500', tile: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  vitals: { label: 'Sinais vitais', icon: HeartPulse, text: 'text-rose-600', border: 'border-l-rose-500', tile: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
  weight: { label: 'Peso', icon: Scale, text: 'text-amber-600', border: 'border-l-amber-500', tile: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  vaccine: { label: 'Vacina', icon: Syringe, text: 'text-emerald-600', border: 'border-l-emerald-500', tile: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  pathology: { label: 'Patologia', icon: Microscope, text: 'text-purple-600', border: 'border-l-purple-500', tile: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
  exam: { label: 'Exame', icon: FlaskConical, text: 'text-orange-600', border: 'border-l-orange-500', tile: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
  prescription: { label: 'Receita', icon: ClipboardList, text: 'text-indigo-600', border: 'border-l-indigo-500', tile: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
  document: { label: 'Documento', icon: FileText, text: 'text-teal-700', border: 'border-l-teal-600', tile: 'bg-teal-50 text-teal-800 hover:bg-teal-100' },
  note: { label: 'Observação', icon: MessageSquare, text: 'text-slate-600', border: 'border-l-slate-400', tile: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
  alert: { label: 'Alerta', icon: AlertTriangle, text: 'text-red-600', border: 'border-l-red-500', tile: 'bg-red-50 text-red-700 hover:bg-red-100' },
};

// Ordem dos botões de "Adicionar" e dos filtros.
export const timelineKinds: TimelineKind[] = [
  'consultation', 'vitals', 'weight', 'vaccine', 'pathology', 'exam', 'prescription', 'document', 'note', 'alert',
];

export type TimelineItem =
  | { key: string; kind: 'consultation'; date: Date; hasTime: boolean; record: MedicalRecord }
  | { key: string; kind: 'vaccine'; date: Date; hasTime: false; vaccination: Vaccination }
  | { key: string; kind: ClinicalEventType; date: Date; hasTime: true; event: ClinicalEvent };

// O formulário de consulta grava só a data (meia-noite UTC); nesses casos não há hora real.
function consultationDate(iso: string) {
  const dateOnly = /T00:00:00(\.0+)?(\+00(:00)?|Z)$/.test(iso) || iso.length === 10;
  return { date: dateOnly ? parseISODate(iso) : new Date(iso), hasTime: !dateOnly };
}

export function buildTimeline(records: MedicalRecord[], vaccinations: Vaccination[], events: ClinicalEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...records.map((record) => ({ key: `r-${record.id}`, kind: 'consultation' as const, record, ...consultationDate(record.consultation_date) })),
    ...vaccinations.map((vaccination) => ({
      key: `v-${vaccination.id}`,
      kind: 'vaccine' as const,
      vaccination,
      date: parseISODate(vaccination.application_date),
      hasTime: false as const,
    })),
    ...events.map((event) => ({ key: `e-${event.id}`, kind: event.event_type, event, date: new Date(event.occurred_at), hasTime: true as const })),
  ];
  return items.sort((a, b) => b.date.getTime() - a.date.getTime());
}

// Faixas de referência usuais para animais adultos (orientativas).
export const vitalRanges: Record<Animal['species'], Record<'temperature_c' | 'heart_rate' | 'respiratory_rate', [number, number]>> = {
  Dog: { temperature_c: [37.5, 39.2], heart_rate: [60, 160], respiratory_rate: [10, 30] },
  Cat: { temperature_c: [37.8, 39.2], heart_rate: [140, 220], respiratory_rate: [20, 30] },
};

export function outOfRange(species: Animal['species'], field: keyof (typeof vitalRanges)['Dog'], value: number | null) {
  if (value == null) return false;
  const [min, max] = vitalRanges[species][field];
  return value < min || value > max;
}

export function formatAge(dateOfBirth: string, today = new Date()) {
  const birth = parseISODate(dateOfBirth);
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return '-';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years === 1 ? '1 ano' : `${years} anos`;
  const m = rest === 1 ? '1 mês' : `${rest} meses`;
  if (years === 0) return rest === 0 ? 'menos de 1 mês' : m;
  return rest === 0 ? y : `${y} e ${m}`;
}

export function formatDateTime(date: Date, withTime: boolean) {
  const d = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return withTime ? `${d} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : d;
}

export function formatNumber(value: number, digits = 1) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
}
