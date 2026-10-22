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

export interface Appointment {
  id: string;
  clinic_id: string;
  client_id: string;
  animal_id: string;
  appointment_date: string;
  appointment_time: string;
  reason_for_visit: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
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
