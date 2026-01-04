import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Client {
  id: string;
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
  client_id: string;
  animal_id: string;
  appointment_date: string;
  appointment_time: string;
  reason_for_visit: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  created_at: string;
  updated_at: string;
}

export interface Microchip {
  id: string;
  codigo: string;
  fabricante?: string;
  data_implantacao?: string;
  local_implantacao?: string;
  veterinario_responsavel?: string;
  status: 'ativo' | 'inativo' | 'perdido';
  created_at: string;
  updated_at: string;
}

export interface MicrochipHistorico {
  id: string;
  microchip_id: string;
  acao: 'implantacao' | 'associacao' | 'desassociacao' | 'alteracao_status';
  observacao?: string;
  usuario_id?: string;
  created_at: string;
}
