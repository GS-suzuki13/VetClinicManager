import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Clínica ativa enviada em toda requisição. As políticas RLS usam o header
// apenas para restringir o escopo; o acesso continua exigindo membership.
let activeClinicId: string | null = null;

export function setActiveClinicScope(id: string | null) {
  activeClinicId = id;
}

const clinicScopedFetch: typeof fetch = (input, init) => {
  if (!activeClinicId) return fetch(input, init);
  const headers = new Headers(init?.headers);
  headers.set('x-clinic-id', activeClinicId);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: clinicScopedFetch },
});

export type ClinicRole = 'owner' | 'admin' | 'veterinarian' | 'staff';

export const clinicRoleLabels: Record<ClinicRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  veterinarian: 'Veterinário',
  staff: 'Recepção',
};

export interface ClinicMember {
  user_id: string;
  email: string;
  role: ClinicRole;
  created_at: string;
}

export interface Client {
  id: string;
  clinic_id: string;
  full_name: string;
  cpf: string;
  email: string;
  phone_number: string;
  date_of_birth: string;
  residential_address: string;
  created_at: string;
  updated_at: string;
}

export interface Animal {
  id: string;
  clinic_id: string;
  client_id: string;
  name: string;
  species: 'Dog' | 'Cat';
  breed: string;
  age: number;
  date_of_birth: string;
  weight: number;
  deceased_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicalRecord {
  id: string;
  clinic_id: string;
  animal_id: string;
  consultation_date: string;
  symptoms: string;
  diagnosis: string;
  procedures: string;
  prescribed_medication: string;
  observations: string;
  veterinarian_name: string;
  created_at: string;
  updated_at: string;
}

export type AppointmentStatus = 'Scheduled' | 'Confirmed' | 'Waiting' | 'InProgress' | 'Completed' | 'Cancelled' | 'NoShow';

export interface Appointment {
  id: string;
  clinic_id: string;
  client_id: string;
  animal_id: string;
  appointment_date: string;
  appointment_time: string;
  reason_for_visit: string;
  status: AppointmentStatus;
  care_type: string | null;
  duration_minutes: number;
  professional_id: string | null;
  checked_in_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  cancel_reason: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
}

export type MicrochipStatus = 'active' | 'inactive' | 'removed' | 'defective';

export interface Microchip {
  id: string;
  clinic_id: string;
  animal_id: string | null;
  code: string;
  manufacturer: string | null;
  implanted_at: string | null;
  implant_site: string | null;
  implanted_by: string | null;
  status: MicrochipStatus;
  external_registry: string | null;
  external_registry_id: string | null;
  public_lookup: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type MicrochipEventType =
  | 'registered'
  | 'linked'
  | 'unlinked'
  | 'status_changed'
  | 'external_registry'
  | 'code_changed'
  | 'scanned'
  | 'note';

export interface MicrochipEvent {
  id: string;
  clinic_id: string;
  microchip_id: string;
  animal_id: string | null;
  event_type: MicrochipEventType;
  old_value: string | null;
  new_value: string | null;
  details: string | null;
  performed_by: string | null;
  performed_by_email: string | null;
  created_at: string;
}

export type ClinicalEventType = 'weight' | 'vitals' | 'pathology' | 'exam' | 'prescription' | 'document' | 'note' | 'alert';

export interface ClinicalEvent {
  id: string;
  clinic_id: string;
  animal_id: string;
  event_type: ClinicalEventType;
  occurred_at: string;
  title: string | null;
  content: string | null;
  weight_kg: number | null;
  temperature_c: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  body_condition_score: number | null;
  pain_score: number | null;
  resolved_at: string | null;
  author_id: string | null;
  author_email: string | null;
  created_at: string;
  updated_at: string;
}

export type VaccineGroup = 'vaccine' | 'dewormer' | 'antiparasitic';

export interface VaccineProtocol {
  id: string;
  clinic_id: string;
  name: string;
  vaccine_group: VaccineGroup;
  species: Animal['species'] | null;
  doses: number;
  interval_days: number;
  booster_days: number | null;
  next_protocol_id: string | null;
  manufacturer: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VaccineDose {
  id: string;
  clinic_id: string;
  animal_id: string;
  protocol_id: string;
  series_id: string;
  dose_number: number;
  is_booster: boolean;
  due_date: string;
  status: 'scheduled' | 'applied' | 'skipped';
  vaccination_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vaccination {
  id: string;
  clinic_id: string;
  animal_id: string;

  vaccine_name: string;
  vaccine_type?: string;
  manufacturer?: string;

  dose_number?: number;
  total_doses?: number;

  application_date: string;
  next_dose_date?: string;

  veterinarian_name?: string;
  clinic_name?: string;

  notes?: string;

  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Vendas, estoque e caixa
// ---------------------------------------------------------------------------

export interface CatalogItem {
  id: string;
  clinic_id: string;
  kind: 'product' | 'service';
  name: string;
  category: string | null;
  sku: string | null;
  barcode: string | null;
  unit: string;
  price: number;
  cost: number | null;
  track_stock: boolean;
  stock_qty: number;
  min_stock: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type StockMovementType = 'purchase' | 'adjustment' | 'loss' | 'return' | 'sale' | 'sale_cancel';

export interface StockMovement {
  id: string;
  clinic_id: string;
  item_id: string;
  movement_type: StockMovementType;
  quantity: number;
  unit_cost: number | null;
  batch: string | null;
  expires_on: string | null;
  supplier: string | null;
  document: string | null;
  sale_id: string | null;
  notes: string | null;
  author_email: string | null;
  occurred_at: string;
  created_at: string;
}

export interface CashSession {
  id: string;
  clinic_id: string;
  status: 'open' | 'closed';
  opening_amount: number;
  opened_at: string;
  opened_by_email: string | null;
  expected_amount: number | null;
  closing_amount: number | null;
  closed_at: string | null;
  closed_by_email: string | null;
  notes: string | null;
}

export interface CashAdjustment {
  id: string;
  session_id: string;
  kind: 'deposit' | 'withdrawal';
  amount: number;
  reason: string;
  author_email: string | null;
  created_at: string;
}

export type SaleStatus = 'quote' | 'open' | 'completed' | 'cancelled';

export interface Sale {
  id: string;
  clinic_id: string;
  number: number;
  status: SaleStatus;
  client_id: string | null;
  animal_id: string | null;
  appointment_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  cash_session_id: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  author_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
}

export type PaymentMethod = 'cash' | 'pix' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'client_credit' | 'on_account';

export interface Payment {
  id: string;
  clinic_id: string;
  sale_id: string | null;
  client_id: string | null;
  method: PaymentMethod;
  amount: number;
  installments: number;
  cash_session_id: string | null;
  received_at: string;
  notes: string | null;
  author_email: string | null;
}

export interface ClientAccountEntry {
  id: string;
  client_id: string;
  amount: number;
  description: string;
  sale_id: string | null;
  payment_id: string | null;
  author_email: string | null;
  created_at: string;
}

export interface ClientBalance {
  client_id: string;
  balance: number;
  last_entry_at: string;
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

export interface FinancialAccount {
  id: string;
  name: string;
  kind: 'cash' | 'bank' | 'card' | 'other';
  opening_balance: number;
  system_key: 'cash' | 'bank' | null;
  active: boolean;
}

export type DreGroup = 'revenue' | 'deductions' | 'cogs' | 'operating_expense' | 'payroll' | 'taxes' | 'financial' | 'other';

export interface FinancialCategory {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  dre_group: DreGroup;
  system_key: 'sales' | 'refunds' | null;
  active: boolean;
}

export interface FinancialEntry {
  id: string;
  clinic_id: string;
  kind: 'income' | 'expense';
  description: string;
  amount: number;
  due_on: string;
  paid_on: string | null;
  category_id: string | null;
  account_id: string | null;
  client_id: string | null;
  supplier: string | null;
  document: string | null;
  notes: string | null;
  payment_id: string | null;
  created_at: string;
}

export interface StatementLine {
  id: string;
  account_id: string;
  posted_on: string;
  amount: number;
  description: string;
  fitid: string;
  entry_id: string | null;
}

// ---------------------------------------------------------------------------
// Internação
// ---------------------------------------------------------------------------

export interface HospitalBox {
  id: string;
  name: string;
  kind: 'kennel' | 'cattery' | 'isolation' | 'icu' | 'other';
  active: boolean;
}

export type Triage = 'red' | 'orange' | 'yellow' | 'green' | 'blue';

export interface Hospitalization {
  id: string;
  clinic_id: string;
  animal_id: string;
  box_id: string | null;
  status: 'active' | 'discharged' | 'deceased' | 'transferred';
  triage: Triage;
  reason: string;
  diet: string | null;
  responsible: string | null;
  admitted_at: string;
  ended_at: string | null;
  outcome_notes: string | null;
  author_email: string | null;
}

export interface HospitalPrescription {
  id: string;
  hospitalization_id: string;
  description: string;
  dose: string | null;
  route: string | null;
  interval_hours: number;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  author_email: string | null;
}

export interface HospitalTask {
  id: string;
  hospitalization_id: string;
  prescription_id: string | null;
  description: string;
  scheduled_at: string;
  status: 'pending' | 'done' | 'skipped';
  done_at: string | null;
  done_by_email: string | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Relacionamento
// ---------------------------------------------------------------------------

export type TemplateKey = 'appointment_confirm' | 'vaccine_due' | 'return' | 'debt' | 'birthday' | 'inactive' | 'nps' | 'custom';

export interface MessageTemplate {
  id: string;
  key: TemplateKey;
  name: string;
  body: string;
  active: boolean;
}

export type MessageChannel = 'whatsapp' | 'sms' | 'email' | 'phone' | 'in_person';

export interface ClientMessage {
  id: string;
  client_id: string;
  animal_id: string | null;
  channel: MessageChannel;
  direction: 'outbound' | 'inbound';
  body: string;
  template_key: string | null;
  appointment_id: string | null;
  author_email: string | null;
  created_at: string;
}

export interface NpsSurvey {
  id: string;
  client_id: string;
  appointment_id: string | null;
  token: string;
  score: number | null;
  comment: string | null;
  answered_at: string | null;
  created_at: string;
}

export interface BookingRequest {
  id: string;
  tutor_name: string;
  phone: string;
  email: string | null;
  pet_name: string;
  species: Animal['species'];
  care_type: string;
  requested_date: string;
  requested_time: string;
  notes: string | null;
  status: 'pending' | 'accepted' | 'declined';
  appointment_id: string | null;
  created_at: string;
}

export interface ClinicSettings {
  id: string;
  name: string;
  max_discount_pct: number;
  booking_enabled: boolean;
  booking_slug: string | null;
  booking_open: string;
  booking_close: string;
  booking_slot_minutes: number;
  booking_days: number[];
  phone: string | null;
  address: string | null;
}
