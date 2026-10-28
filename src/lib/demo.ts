import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Demonstração para visitantes (ex.: vindos do portfólio): cada visitante ganha
// uma conta e uma clínica próprias, com dados fictícios. Nada é compartilhado
// entre visitantes e o isolamento é o mesmo RLS multi-tenant das clínicas reais.

export const DEMO_CLINIC_NAME = 'Clínica Demonstração';

export function isDemoUser(user: User | null | undefined) {
  return user?.user_metadata?.demo === true;
}

// ?demo na URL entra direto na demonstração (link do portfólio).
export function demoRequestedInUrl() {
  return new URLSearchParams(window.location.search).has('demo');
}

export function clearDemoFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('demo')) return;
  url.searchParams.delete('demo');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

function isoDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoDateTime(offsetDays: number, time: string) {
  return new Date(`${isoDate(offsetDays)}T${time}:00`).toISOString();
}

function check<T>(result: { data: T | null; error: { message: string } | null }, step: string): T {
  if (result.error || !result.data) {
    throw new Error(`${step}: ${result.error?.message ?? 'sem retorno'}`);
  }
  return result.data;
}

// Conta nova (confirmação automática de e-mail no projeto) + clínica + dados de exemplo.
export async function createDemoSandbox(onStep: (step: string) => void) {
  onStep('Criando sua clínica de demonstração…');

  const id = crypto.randomUUID();
  const { data: auth, error: signUpError } = await supabase.auth.signUp({
    email: `demo-${id}@example.com`,
    password: `Demo-${id}-Aa1`,
    options: { data: { demo: true } },
  });
  if (signUpError) throw signUpError;
  if (!auth.session) throw new Error('A demonstração exige confirmação automática de e-mail no projeto.');

  const clinic = check<{ id: string }>(
    await supabase.rpc('create_clinic', { p_name: DEMO_CLINIC_NAME }),
    'create_clinic',
  );

  onStep('Cadastrando tutores, pets e agenda de exemplo…');
  await seedDemoClinic(clinic.id);

  return { clinicId: clinic.id, userId: auth.session.user.id };
}

async function seedDemoClinic(clinicId: string) {
  const clients = check(
    await supabase
      .from('clients')
      .insert(
        [
          { full_name: 'Mariana Costa', cpf: '52998224725', email: 'mariana.costa@exemplo.com', phone_number: '(47) 99812-3401', date_of_birth: '1991-04-12', residential_address: 'Rua XV de Novembro, 820 - Centro, Blumenau/SC' },
          { full_name: 'Rafael Oliveira', cpf: '15350946056', email: 'rafael.oliveira@exemplo.com', phone_number: '(47) 99734-5520', date_of_birth: '1986-09-03', residential_address: 'Rua Amazonas, 145 - Garcia, Blumenau/SC' },
          { full_name: 'Juliana Martins', cpf: '71428793860', email: 'juliana.martins@exemplo.com', phone_number: '(47) 98821-0077', date_of_birth: '1995-01-27', residential_address: 'Rua Itajaí, 2310 - Vorstadt, Blumenau/SC' },
          { full_name: 'Carlos Henrique Souza', cpf: '29537914852', email: 'carlos.souza@exemplo.com', phone_number: '(47) 99655-1290', date_of_birth: '1979-11-18', residential_address: 'Rua São Paulo, 3020 - Itoupava Seca, Blumenau/SC' },
          { full_name: 'Beatriz Lima', cpf: '86751409087', email: 'beatriz.lima@exemplo.com', phone_number: '(47) 99128-8843', date_of_birth: '2000-06-09', residential_address: 'Rua Bahia, 560 - Salto, Blumenau/SC' },
        ].map((c) => ({ ...c, clinic_id: clinicId })),
      )
      .select('id, full_name'),
    'clientes',
  );
  const client = (name: string) => clients.find((c) => c.full_name === name)!.id;

  const animals = check(
    await supabase
      .from('animals')
      .insert(
        [
          { client_id: client('Mariana Costa'), name: 'Thor', species: 'Dog', breed: 'Golden Retriever', age: 4, date_of_birth: '2022-03-15', weight: 31.4 },
          { client_id: client('Mariana Costa'), name: 'Luna', species: 'Cat', breed: 'SRD', age: 2, date_of_birth: '2024-02-02', weight: 3.9 },
          { client_id: client('Rafael Oliveira'), name: 'Paçoca', species: 'Dog', breed: 'SRD', age: 6, date_of_birth: '2020-07-21', weight: 12.7 },
          { client_id: client('Juliana Martins'), name: 'Mel', species: 'Dog', breed: 'Shih Tzu', age: 3, date_of_birth: '2023-05-30', weight: 6.2 },
          { client_id: client('Juliana Martins'), name: 'Nina', species: 'Cat', breed: 'Siamês', age: 7, date_of_birth: '2019-08-11', weight: 4.4 },
          { client_id: client('Carlos Henrique Souza'), name: 'Bidu', species: 'Dog', breed: 'Beagle', age: 5, date_of_birth: '2021-10-05', weight: 14.1 },
          { client_id: client('Beatriz Lima'), name: 'Frajola', species: 'Cat', breed: 'Persa', age: 1, date_of_birth: '2025-06-14', weight: 3.1 },
        ].map((a) => ({ ...a, clinic_id: clinicId })),
      )
      .select('id, name, client_id'),
    'animais',
  );
  const animal = (name: string) => animals.find((a) => a.name === name)!;

  const vet = 'Dra. Camila Andrade';
  const rows = <T extends object>(list: T[]) => list.map((r) => ({ ...r, clinic_id: clinicId }));

  const results = await Promise.all([
    supabase.from('appointments').insert(
      [
        { name: 'Thor', date: 0, time: '09:00', reason: 'Retorno pós-cirúrgico', status: 'Scheduled' },
        { name: 'Mel', date: 0, time: '10:30', reason: 'Consulta de rotina e banho medicamentoso', status: 'Scheduled' },
        { name: 'Bidu', date: 0, time: '15:00', reason: 'Otite recorrente', status: 'Scheduled' },
        { name: 'Luna', date: 1, time: '11:00', reason: 'Vacina V4 (reforço)', status: 'Scheduled' },
        { name: 'Paçoca', date: 3, time: '16:30', reason: 'Check-up geriátrico', status: 'Scheduled' },
        { name: 'Frajola', date: 6, time: '14:00', reason: 'Castração (avaliação pré-operatória)', status: 'Scheduled' },
        { name: 'Nina', date: -2, time: '09:30', reason: 'Controle de peso', status: 'Completed' },
        { name: 'Thor', date: -9, time: '08:00', reason: 'Cirurgia: retirada de nódulo cutâneo', status: 'Completed' },
        { name: 'Bidu', date: -4, time: '17:00', reason: 'Consulta dermatológica', status: 'Cancelled' },
      ].map(({ name, date, time, reason, status }) => ({
        clinic_id: clinicId,
        client_id: animal(name).client_id,
        animal_id: animal(name).id,
        appointment_date: isoDate(date),
        appointment_time: time,
        reason_for_visit: reason,
        status,
      })),
    ),
    supabase.from('medical_records').insert(
      rows([
        {
          animal_id: animal('Thor').id,
          consultation_date: isoDateTime(-9, '08:00'),
          symptoms: 'Nódulo cutâneo no flanco esquerdo, crescimento lento nos últimos 3 meses.',
          diagnosis: 'Lipoma subcutâneo (citologia compatível).',
          procedures: 'Exérese cirúrgica sob anestesia inalatória; sutura intradérmica.',
          prescribed_medication: 'Meloxicam 0,1 mg/kg 1x ao dia por 4 dias; Cefalexina 30 mg/kg 2x ao dia por 7 dias.',
          observations: 'Uso de roupa cirúrgica até o retorno. Retirada de pontos em 10 dias.',
          veterinarian_name: vet,
        },
        {
          animal_id: animal('Nina').id,
          consultation_date: isoDateTime(-2, '09:30'),
          symptoms: 'Ganho de peso progressivo, baixa atividade.',
          diagnosis: 'Sobrepeso (ECC 7/9).',
          procedures: 'Pesagem, avaliação de escore corporal e orientação nutricional.',
          prescribed_medication: 'Ração light, 45 g/dia divididos em 3 refeições.',
          observations: 'Reavaliar em 30 dias. Meta: -10% do peso em 3 meses.',
          veterinarian_name: vet,
        },
        {
          animal_id: animal('Bidu').id,
          consultation_date: isoDateTime(-30, '16:00'),
          symptoms: 'Prurido e secreção no ouvido direito.',
          diagnosis: 'Otite externa por Malassezia.',
          procedures: 'Limpeza otológica e citologia de cerúmen.',
          prescribed_medication: 'Otológico com antifúngico e corticoide, 2x ao dia por 14 dias.',
          observations: 'Evitar entrada de água nos ouvidos durante o tratamento.',
          veterinarian_name: 'Dr. Lucas Ferreira',
        },
        {
          animal_id: animal('Mel').id,
          consultation_date: isoDateTime(-45, '10:00'),
          symptoms: 'Lacrimejamento excessivo no olho esquerdo.',
          diagnosis: 'Conjuntivite leve.',
          procedures: 'Teste de fluoresceína (negativo para úlcera).',
          prescribed_medication: 'Colírio antibiótico 4x ao dia por 7 dias.',
          observations: 'Retorno se não houver melhora em 5 dias.',
          veterinarian_name: vet,
        },
      ]),
    ),
    supabase.from('animal_vaccinations').insert(
      rows([
        { animal_id: animal('Thor').id, vaccine_name: 'V10 (polivalente)', vaccine_type: 'Polivalente', manufacturer: 'Zoetis', dose_number: 1, total_doses: 1, application_date: isoDate(-20), next_dose_date: isoDate(345), veterinarian_name: vet },
        { animal_id: animal('Thor').id, vaccine_name: 'Antirrábica', vaccine_type: 'Raiva', manufacturer: 'Boehringer Ingelheim', dose_number: 1, total_doses: 1, application_date: isoDate(-200), next_dose_date: isoDate(165), veterinarian_name: vet },
        { animal_id: animal('Luna').id, vaccine_name: 'V4 felina', vaccine_type: 'Polivalente', manufacturer: 'Zoetis', dose_number: 2, total_doses: 3, application_date: isoDate(-27), next_dose_date: isoDate(1), veterinarian_name: vet, notes: 'Reforço agendado.' },
        { animal_id: animal('Paçoca').id, vaccine_name: 'Giárdia', vaccine_type: 'Giardíase', manufacturer: 'Zoetis', dose_number: 1, total_doses: 2, application_date: isoDate(-25), next_dose_date: isoDate(-4), veterinarian_name: 'Dr. Lucas Ferreira', notes: 'Segunda dose em atraso: contatar tutor.' },
        { animal_id: animal('Mel').id, vaccine_name: 'Gripe canina (tosse dos canis)', vaccine_type: 'Bordetella', manufacturer: 'MSD', dose_number: 1, total_doses: 1, application_date: isoDate(-90), next_dose_date: isoDate(275), veterinarian_name: vet },
        { animal_id: animal('Frajola').id, vaccine_name: 'V5 felina', vaccine_type: 'Polivalente', manufacturer: 'MSD', dose_number: 1, total_doses: 3, application_date: isoDate(-12), next_dose_date: isoDate(9), veterinarian_name: vet },
      ]),
    ),
    supabase.from('microchips').insert(
      rows([
        { animal_id: animal('Thor').id, code: '982000412345671', manufacturer: 'Allflex', implanted_at: isoDate(-400), implant_site: 'Região escapular esquerda', implanted_by: vet, status: 'active' },
        { animal_id: animal('Mel').id, code: '981020000123458', manufacturer: 'Datamars', implanted_at: isoDate(-300), implant_site: 'Região escapular esquerda', implanted_by: vet, status: 'active' },
        { animal_id: animal('Bidu').id, code: '076099000004321', manufacturer: 'Não informado', implanted_at: isoDate(-700), implant_site: 'Região escapular', status: 'active', notes: 'Chip implantado em outra clínica; lido na primeira consulta.' },
      ]),
    ),
  ]);

  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`dados de exemplo: ${failed.error.message}`);
}
