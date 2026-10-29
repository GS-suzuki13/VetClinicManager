/*
  Testes de isolamento multi-tenant.

  Rodam contra uma instância Supabase (por padrão a local, `npx supabase start`)
  usando apenas a anon key e usuários comuns, exatamente como um navegador ou
  um atacante com a anon key pública faria. Nenhuma service key é usada.

  Todos os dados são fictícios. Os usuários são criados com e-mails
  aleatórios em `example.test`.

  Uso: npm run test:isolation
*/

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function loadConfig() {
  let url = process.env.SUPABASE_URL;
  let anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const out = execSync('npx supabase status -o env', { encoding: 'utf8' });
    const env = Object.fromEntries(
      out
        .split(/\r?\n/)
        .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2]])
    );
    url = env.API_URL;
    anonKey = env.ANON_KEY;
  }

  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url ?? '');
  if (!isLocal && process.env.ALLOW_REMOTE_TESTS !== '1') {
    throw new Error(
      `Recusando rodar contra ${url}: os testes criam usuários. Use um projeto de teste e ALLOW_REMOTE_TESTS=1.`
    );
  }
  return { url, anonKey };
}

const { url, anonKey } = loadConfig();
const PASSWORD = 'Teste-Isolamento-123';
const run = randomUUID().slice(0, 8);

function newClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signUp(label) {
  const sb = newClient();
  const email = `${label}-${run}@example.test`;
  const { data, error } = await sb.auth.signUp({ email, password: PASSWORD });
  assert.ifError(error);
  assert.ok(data.session, 'cadastro deveria retornar sessão (confirmação de e-mail desativada no ambiente de teste)');
  return { sb, email, userId: data.user.id, token: data.session.access_token };
}

function unwrap({ data, error }) {
  assert.ifError(error);
  return data;
}

// Popula uma clínica com um registro fictício de cada tabela.
async function seedClinic(sb, clinicId, tag) {
  const client = unwrap(
    await sb
      .from('clients')
      .insert({
        clinic_id: clinicId,
        full_name: `Tutor Fictício ${tag}`,
        cpf: '000.000.000-00',
        email: `tutor-${tag}@example.test`,
        phone_number: '(00) 00000-0000',
        date_of_birth: '1990-01-01',
        residential_address: `Rua Teste ${tag}, 1`,
      })
      .select()
      .single()
  );
  const animal = unwrap(
    await sb
      .from('animals')
      .insert({
        clinic_id: clinicId,
        client_id: client.id,
        name: `Pet ${tag}`,
        species: 'Dog',
        breed: 'SRD',
        age: 3,
        date_of_birth: '2021-01-01',
        weight: 10,
      })
      .select()
      .single()
  );
  const record = unwrap(
    await sb
      .from('medical_records')
      .insert({
        clinic_id: clinicId,
        animal_id: animal.id,
        consultation_date: new Date().toISOString(),
        symptoms: `sintoma ${tag}`,
        diagnosis: `diagnóstico ${tag}`,
        veterinarian_name: `Dra. Teste ${tag}`,
      })
      .select()
      .single()
  );
  const vaccination = unwrap(
    await sb
      .from('animal_vaccinations')
      .insert({
        clinic_id: clinicId,
        animal_id: animal.id,
        vaccine_name: `V10 ${tag}`,
        application_date: '2026-01-01',
      })
      .select()
      .single()
  );
  const appointment = unwrap(
    await sb
      .from('appointments')
      .insert({
        clinic_id: clinicId,
        client_id: client.id,
        animal_id: animal.id,
        appointment_date: '2026-12-01',
        appointment_time: '10:00',
        reason_for_visit: `consulta ${tag}`,
      })
      .select()
      .single()
  );
  // Mesmo número de chip nas duas clínicas: único por clínica, invisível entre elas.
  const microchip = unwrap(
    await sb
      .from('microchips')
      .insert({
        clinic_id: clinicId,
        animal_id: animal.id,
        code: CHIP_CODE.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2-$3.'),
        manufacturer: `Fabricante ${tag}`,
        implanted_at: '2026-01-01',
      })
      .select()
      .single()
  );
  const clinicalEvent = unwrap(
    await sb
      .from('clinical_events')
      .insert({
        clinic_id: clinicId,
        animal_id: animal.id,
        event_type: 'alert',
        title: `Alergia fictícia ${tag}`,
      })
      .select()
      .single()
  );
  return { client, animal, record, vaccination, appointment, microchip, clinicalEvent };
}

// Único por execução: rodadas anteriores no mesmo banco não interferem na busca entre clínicas.
const CHIP_CODE = `982${String(Date.now()).slice(-12).padStart(12, '0')}`;
const SPACED_CHIP_CODE = CHIP_CODE.replace(/(\d{3})(?=\d)/g, '$1 ');

const TABLES = {
  clients: 'client',
  animals: 'animal',
  medical_records: 'record',
  animal_vaccinations: 'vaccination',
  appointments: 'appointment',
  microchips: 'microchip',
  clinical_events: 'clinicalEvent',
};

let A, B, clinicA, clinicB, dataA, dataB;

before(async () => {
  A = await signUp('clinica-a');
  B = await signUp('clinica-b');
  clinicA = unwrap(await A.sb.rpc('create_clinic', { p_name: `Clínica A ${run}` }));
  clinicB = unwrap(await B.sb.rpc('create_clinic', { p_name: `Clínica B ${run}` }));
  dataA = await seedClinic(A.sb, clinicA.id, 'A');
  dataB = await seedClinic(B.sb, clinicB.id, 'B');
});

// ---------------------------------------------------------------------------
// Visitante anônimo (só a anon key pública)
// ---------------------------------------------------------------------------

test('anônimo não lê nenhuma tabela', async () => {
  const anon = newClient();
  for (const table of [...Object.keys(TABLES), 'microchip_events', 'clinics', 'clinic_members']) {
    const { data, error } = await anon.from(table).select('*');
    assert.ok(error, `${table}: esperado erro de permissão, veio ${JSON.stringify(data)}`);
    assert.equal(error.code, '42501', `${table}: ${error.message}`);
  }
});

test('anônimo não insere, altera nem apaga', async () => {
  const anon = newClient();
  const ins = await anon.from('clients').insert({
    full_name: 'Invasor', cpf: '1', email: 'x@example.test', phone_number: '1',
    date_of_birth: '2000-01-01', residential_address: 'x', clinic_id: clinicA.id,
  });
  assert.equal(ins.error?.code, '42501');

  const upd = await anon.from('clients').update({ full_name: 'Invasor' }).eq('id', dataA.client.id);
  assert.equal(upd.error?.code, '42501');

  const del = await anon.from('clients').delete().eq('id', dataA.client.id);
  assert.equal(del.error?.code, '42501');
});

test('anônimo não executa RPCs', async () => {
  const anon = newClient();
  const r1 = await anon.rpc('create_clinic', { p_name: 'Invasora' });
  assert.ok(r1.error, 'create_clinic deveria falhar');
  const r2 = await anon.rpc('list_clinic_members', { p_clinic_id: clinicA.id });
  assert.ok(r2.error, 'list_clinic_members deveria falhar');
});

test('anônimo não lê dados pelo GraphQL', async () => {
  const res = await fetch(`${url}/graphql/v1`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ clientsCollection { edges { node { id full_name } } } }' }),
  });
  const body = await res.json();
  const edges = body?.data?.clientsCollection?.edges ?? [];
  assert.equal(edges.length, 0, JSON.stringify(body));
});

// ---------------------------------------------------------------------------
// Clínica A x Clínica B
// ---------------------------------------------------------------------------

test('cada clínica só lista as próprias linhas em todas as tabelas', async () => {
  for (const [user, mine, theirs, clinic] of [
    [A, dataA, dataB, clinicA],
    [B, dataB, dataA, clinicB],
  ]) {
    for (const [table, key] of Object.entries(TABLES)) {
      const rows = unwrap(await user.sb.from(table).select('*'));
      assert.ok(rows.length >= 1, `${table}: deveria ver a própria linha`);
      assert.ok(rows.every((r) => r.clinic_id === clinic.id), `${table}: linha de outra clínica visível`);
      assert.ok(rows.some((r) => r.id === mine[key].id));
      assert.ok(!rows.some((r) => r.id === theirs[key].id), `${table}: vazou linha da outra clínica`);
    }
  }
});

test('buscar linha da outra clínica pelo id retorna vazio', async () => {
  for (const [table, key] of Object.entries(TABLES)) {
    const rows = unwrap(await A.sb.from(table).select('*').eq('id', dataB[key].id));
    assert.equal(rows.length, 0, `${table}: A leu linha de B pelo id`);
  }
});

test('filtro explícito por clinic_id da outra clínica retorna vazio', async () => {
  for (const table of Object.keys(TABLES)) {
    const rows = unwrap(await A.sb.from(table).select('*').eq('clinic_id', clinicB.id));
    assert.equal(rows.length, 0, `${table}: filtro por clinic_id de B vazou`);
  }
});

test('contagens (head/count) não incluem a outra clínica', async () => {
  for (const table of Object.keys(TABLES)) {
    const { count, error } = await A.sb.from(table).select('*', { count: 'exact', head: true });
    assert.ifError(error);
    const own = unwrap(await A.sb.from(table).select('id'));
    assert.equal(count, own.length, `${table}: contagem inclui linhas de outra clínica`);
  }
});

test('embeds (joins) não trazem dados da outra clínica', async () => {
  const rows = unwrap(
    await A.sb.from('appointments').select('*, clients(*), animals(*, clients(*))')
  );
  const text = JSON.stringify(rows);
  assert.ok(!text.includes(dataB.client.id), 'join expôs tutor de B');
  assert.ok(!text.includes(dataB.animal.id), 'join expôs animal de B');
  assert.ok(rows.every((r) => r.clients && r.animals), 'join da própria clínica deveria funcionar');
});

test('A não altera linhas de B (0 linhas afetadas e B intacto)', async () => {
  for (const [table, key] of Object.entries(TABLES)) {
    const field = {
      clients: { full_name: 'HACKED' },
      animals: { name: 'HACKED' },
      medical_records: { diagnosis: 'HACKED' },
      animal_vaccinations: { vaccine_name: 'HACKED' },
      appointments: { reason_for_visit: 'HACKED' },
      microchips: { notes: 'HACKED' },
    }[table];
    const updated = unwrap(await A.sb.from(table).update(field).eq('id', dataB[key].id).select());
    assert.equal(updated.length, 0, `${table}: A alterou linha de B`);

    const row = unwrap(await B.sb.from(table).select('*').eq('id', dataB[key].id).single());
    assert.ok(!Object.values(row).includes('HACKED'), `${table}: dado de B foi alterado`);
  }
});

test('A não apaga linhas de B', async () => {
  for (const [table, key] of Object.entries(TABLES)) {
    const deleted = unwrap(await A.sb.from(table).delete().eq('id', dataB[key].id).select());
    assert.equal(deleted.length, 0, `${table}: A apagou linha de B`);
    const still = unwrap(await B.sb.from(table).select('id').eq('id', dataB[key].id));
    assert.equal(still.length, 1, `${table}: linha de B sumiu`);
  }
});

test('A não insere linhas com clinic_id de B', async () => {
  const { error } = await A.sb.from('clients').insert({
    clinic_id: clinicB.id, full_name: 'Intruso', cpf: '111', email: 'i@example.test',
    phone_number: '0', date_of_birth: '2000-01-01', residential_address: 'x',
  });
  assert.equal(error?.code, '42501', error?.message);
});

test('A não move a própria linha para a clínica B', async () => {
  const { error } = await A.sb.from('clients').update({ clinic_id: clinicB.id }).eq('id', dataA.client.id);
  assert.ok(error, 'mudança de clinic_id deveria falhar');
  const row = unwrap(await A.sb.from('clients').select('clinic_id').eq('id', dataA.client.id).single());
  assert.equal(row.clinic_id, clinicA.id);
});

test('A não referencia registros de B (vazamento por chave estrangeira)', async () => {
  // Animal da clínica A apontando para tutor de B.
  const animal = await A.sb.from('animals').insert({
    clinic_id: clinicA.id, client_id: dataB.client.id, name: 'x', species: 'Cat',
    breed: 'x', age: 1, date_of_birth: '2025-01-01', weight: 1,
  });
  assert.equal(animal.error?.code, '23503', animal.error?.message);

  // Prontuário, vacina e agendamento na clínica A apontando para animal de B.
  const record = await A.sb.from('medical_records').insert({
    clinic_id: clinicA.id, animal_id: dataB.animal.id, consultation_date: new Date().toISOString(),
    symptoms: 'x', diagnosis: 'x', veterinarian_name: 'x',
  });
  assert.equal(record.error?.code, '23503', record.error?.message);

  const vac = await A.sb.from('animal_vaccinations').insert({
    clinic_id: clinicA.id, animal_id: dataB.animal.id, vaccine_name: 'x', application_date: '2026-01-01',
  });
  assert.equal(vac.error?.code, '23503', vac.error?.message);

  const appt = await A.sb.from('appointments').insert({
    clinic_id: clinicA.id, client_id: dataA.client.id, animal_id: dataB.animal.id,
    appointment_date: '2026-12-02', appointment_time: '09:00', reason_for_visit: 'x',
  });
  assert.equal(appt.error?.code, '23503', appt.error?.message);
});

test('agendamento exige que o animal seja do tutor informado', async () => {
  const other = unwrap(
    await A.sb.from('clients').insert({
      clinic_id: clinicA.id, full_name: 'Outro Tutor A', cpf: '222', email: 'o@example.test',
      phone_number: '0', date_of_birth: '1980-01-01', residential_address: 'x',
    }).select().single()
  );
  const { error } = await A.sb.from('appointments').insert({
    clinic_id: clinicA.id, client_id: other.id, animal_id: dataA.animal.id,
    appointment_date: '2026-12-03', appointment_time: '11:00', reason_for_visit: 'x',
  });
  assert.equal(error?.code, '23503', error?.message);
});

test('clinic_id é preenchido automaticamente quando o usuário tem uma única clínica', async () => {
  const row = unwrap(
    await A.sb.from('clients').insert({
      full_name: 'Sem clinic_id', cpf: '333', email: 's@example.test',
      phone_number: '0', date_of_birth: '1980-01-01', residential_address: 'x',
    }).select().single()
  );
  assert.equal(row.clinic_id, clinicA.id);
});

test('mesmo CPF pode existir em clínicas diferentes (sem vazar existência)', async () => {
  // Ambos os seeds usam o mesmo CPF fictício; o cadastro de B não falhou.
  assert.equal(dataA.client.cpf, dataB.client.cpf);
  const dup = await A.sb.from('clients').insert({
    clinic_id: clinicA.id, full_name: 'Duplicado', cpf: dataA.client.cpf, email: 'd@example.test',
    phone_number: '0', date_of_birth: '1980-01-01', residential_address: 'x',
  });
  assert.equal(dup.error?.code, '23505', 'CPF deve continuar único dentro da clínica');
});

// ---------------------------------------------------------------------------
// Tenants, equipe e papéis
// ---------------------------------------------------------------------------

test('A só vê a própria clínica e a própria equipe', async () => {
  const clinics = unwrap(await A.sb.from('clinics').select('*'));
  assert.deepEqual(clinics.map((c) => c.id), [clinicA.id]);

  const members = unwrap(await A.sb.from('clinic_members').select('*'));
  assert.ok(members.every((m) => m.clinic_id === clinicA.id));

  const renamed = unwrap(await A.sb.from('clinics').update({ name: 'HACKED' }).eq('id', clinicB.id).select());
  assert.equal(renamed.length, 0);
});

test('A não se adiciona nem lista a equipe de B', async () => {
  const add = await A.sb.rpc('add_clinic_member', { p_clinic_id: clinicB.id, p_email: A.email, p_role: 'owner' });
  assert.equal(add.error?.code, '42501', add.error?.message);

  const list = await A.sb.rpc('list_clinic_members', { p_clinic_id: clinicB.id });
  assert.equal(list.error?.code, '42501', list.error?.message);

  const direct = await A.sb.from('clinic_members').insert({ clinic_id: clinicB.id, user_id: A.userId, role: 'owner' });
  assert.equal(direct.error?.code, '42501', direct.error?.message);
});

test('membro "staff" vê só a clínica dele e não apaga histórico clínico', async () => {
  const C = await signUp('staff-a');
  unwrap(await A.sb.rpc('add_clinic_member', { p_clinic_id: clinicA.id, p_email: C.email, p_role: 'staff' }));

  const rows = unwrap(await C.sb.from('animals').select('*'));
  assert.ok(rows.some((r) => r.id === dataA.animal.id));
  assert.ok(!rows.some((r) => r.id === dataB.animal.id));

  for (const [table, key] of [['medical_records', 'record'], ['animal_vaccinations', 'vaccination'], ['clinical_events', 'clinicalEvent'], ['clients', 'client'], ['animals', 'animal']]) {
    const deleted = unwrap(await C.sb.from(table).delete().eq('id', dataA[key].id).select());
    assert.equal(deleted.length, 0, `staff apagou ${table}`);
  }

  const promote = await C.sb.rpc('add_clinic_member', { p_clinic_id: clinicA.id, p_email: C.email, p_role: 'owner' });
  assert.equal(promote.error?.code, '42501', 'staff não pode se promover');

  const removeOwner = await C.sb.rpc('remove_clinic_member', { p_clinic_id: clinicA.id, p_user_id: A.userId });
  assert.equal(removeOwner.error?.code, '42501', 'staff não pode remover o owner');

  const team = unwrap(await A.sb.rpc('list_clinic_members', { p_clinic_id: clinicA.id }));
  assert.deepEqual(team.map((m) => m.role).sort(), ['owner', 'staff']);
});

test('admin não rebaixa o owner e o último owner não é rebaixado', async () => {
  const D = await signUp('admin-a');
  unwrap(await A.sb.rpc('add_clinic_member', { p_clinic_id: clinicA.id, p_email: D.email, p_role: 'admin' }));

  const demote = await D.sb.rpc('add_clinic_member', { p_clinic_id: clinicA.id, p_email: A.email, p_role: 'staff' });
  assert.equal(demote.error?.code, '42501', demote.error?.message);

  const self = await A.sb.rpc('add_clinic_member', { p_clinic_id: clinicA.id, p_email: A.email, p_role: 'admin' });
  assert.equal(self.error?.code, '23514', self.error?.message);

  const team = unwrap(await A.sb.rpc('list_clinic_members', { p_clinic_id: clinicA.id }));
  assert.equal(team.find((m) => m.user_id === A.userId).role, 'owner');
});

test('membro de duas clínicas: header x-clinic-id escopa, mas não concede acesso', async () => {
  const E = await signUp('multi');
  unwrap(await A.sb.rpc('add_clinic_member', { p_clinic_id: clinicA.id, p_email: E.email, p_role: 'veterinarian' }));
  const clinicE = unwrap(await E.sb.rpc('create_clinic', { p_name: `Clínica E ${run}` }));

  const scoped = (clinicId) =>
    createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${E.token}`, 'x-clinic-id': clinicId } },
    });

  // Sem header: vê as duas clínicas das quais é membro (nunca B).
  const all = unwrap(await E.sb.from('clients').select('clinic_id'));
  assert.ok(all.every((r) => r.clinic_id === clinicA.id || r.clinic_id === clinicE.id));

  // Com header da clínica E: só E; insert sem clinic_id vai para E.
  const inE = scoped(clinicE.id);
  assert.equal(unwrap(await inE.from('clients').select('id')).length, 0);
  const created = unwrap(
    await inE.from('clients').insert({
      full_name: 'Tutor E', cpf: '444', email: 'e@example.test',
      phone_number: '0', date_of_birth: '1980-01-01', residential_address: 'x',
    }).select().single()
  );
  assert.equal(created.clinic_id, clinicE.id);

  // Com header da clínica A: não enxerga nem altera a linha de E.
  const inA = scoped(clinicA.id);
  assert.ok(!unwrap(await inA.from('clients').select('id')).some((r) => r.id === created.id));
  assert.equal(unwrap(await inA.from('clients').update({ full_name: 'X' }).eq('id', created.id).select()).length, 0);

  // Header com a clínica B (da qual não é membro): nada visível, insert negado.
  const inB = scoped(clinicB.id);
  assert.equal(unwrap(await inB.from('clients').select('id')).length, 0);
  const ins = await inB.from('clients').insert({
    full_name: 'Intruso', cpf: '555', email: 'i@example.test',
    phone_number: '0', date_of_birth: '1980-01-01', residential_address: 'x',
  });
  assert.equal(ins.error?.code, '42501', ins.error?.message);
});

test('último owner não pode sair da clínica', async () => {
  const { error } = await B.sb.rpc('remove_clinic_member', { p_clinic_id: clinicB.id, p_user_id: B.userId });
  assert.equal(error?.code, '23514', error?.message);
});

// ---------------------------------------------------------------------------
// Chamadas diretas à API REST com token forjado
// ---------------------------------------------------------------------------

test('JWT adulterado (sub trocado) é rejeitado pela API', async () => {
  const [header, payload, signature] = B.token.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  claims.sub = A.userId;
  const forged = [header, Buffer.from(JSON.stringify(claims)).toString('base64url'), signature].join('.');

  const res = await fetch(`${url}/rest/v1/clients?select=*`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${forged}` },
  });
  assert.equal(res.status, 401, await res.text());
});

test('token de B via REST direto não lê dados de A', async () => {
  const res = await fetch(`${url}/rest/v1/medical_records?select=*&id=eq.${dataA.record.id}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${B.token}` },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

// ---------------------------------------------------------------------------
// Microchips
// ---------------------------------------------------------------------------

test('microchip: código normalizado e validado', async () => {
  assert.equal(dataA.microchip.code, CHIP_CODE, 'espaços/pontos/traços devem ser removidos');

  for (const code of ['123', '98200012345678X', 'ZZZZZZZZZZ']) {
    const { error } = await A.sb.from('microchips').insert({ clinic_id: clinicA.id, code });
    assert.equal(error?.code, '23514', `${code}: ${error?.message}`);
  }

  // Formatos legados aceitos: FDX-A (10 hex) e AVID (9 dígitos).
  for (const code of ['0a1b2c3d4e', '123456789']) {
    const row = unwrap(await A.sb.from('microchips').insert({ clinic_id: clinicA.id, code }).select().single());
    assert.equal(row.code, code.toUpperCase());
  }
});

test('microchip: único por clínica e um chip ativo por animal', async () => {
  const dup = await A.sb.from('microchips').insert({ clinic_id: clinicA.id, code: CHIP_CODE });
  assert.equal(dup.error?.code, '23505', 'mesmo código duas vezes na clínica');

  const second = await A.sb
    .from('microchips')
    .insert({ clinic_id: clinicA.id, animal_id: dataA.animal.id, code: '982000999999999' });
  assert.equal(second.error?.code, '23505', 'segundo chip ativo no mesmo animal');
});

test('microchip: não vincula animal de outra clínica', async () => {
  const { error } = await A.sb
    .from('microchips')
    .insert({ clinic_id: clinicA.id, animal_id: dataB.animal.id, code: '982000111111111' });
  assert.equal(error?.code, '23503', error?.message);

  const upd = await A.sb.from('microchips').update({ animal_id: dataB.animal.id }).eq('id', dataA.microchip.id);
  assert.equal(upd.error?.code, '23503', upd.error?.message);
});

test('microchip: histórico automático registra cadastro, status e registro externo', async () => {
  unwrap(
    await A.sb
      .from('microchips')
      .update({ status: 'defective', external_registry: 'SinPatinhas', external_registry_id: 'SP-TESTE-1' })
      .eq('id', dataA.microchip.id)
  );
  unwrap(await A.sb.from('microchips').update({ status: 'active' }).eq('id', dataA.microchip.id));

  const events = unwrap(
    await A.sb.from('microchip_events').select('*').eq('microchip_id', dataA.microchip.id).order('created_at')
  );
  const types = events.map((e) => e.event_type);
  assert.ok(types.includes('registered'));
  assert.ok(types.includes('external_registry'));
  assert.equal(types.filter((t) => t === 'status_changed').length, 2);
  const change = events.find((e) => e.event_type === 'status_changed');
  assert.deepEqual([change.old_value, change.new_value], ['active', 'defective']);
  assert.ok(events.every((e) => e.performed_by === A.userId && e.performed_by_email === A.email));
});

test('microchip: histórico é imutável e só aceita leituras/anotações manuais', async () => {
  const forged = await A.sb.from('microchip_events').insert({
    clinic_id: clinicA.id, microchip_id: dataA.microchip.id, event_type: 'registered',
  });
  assert.equal(forged.error?.code, '42501', 'evento automático não pode ser forjado');

  // Autor forjado é substituído pelo usuário da sessão.
  const scan = unwrap(
    await A.sb
      .from('microchip_events')
      .insert({
        clinic_id: clinicA.id, microchip_id: dataA.microchip.id, event_type: 'scanned',
        details: 'Leitura na consulta', performed_by: B.userId, performed_by_email: 'falso@example.test',
      })
      .select()
      .single()
  );
  assert.equal(scan.performed_by, A.userId);
  assert.equal(scan.performed_by_email, A.email);

  const upd = await A.sb.from('microchip_events').update({ details: 'HACKED' }).eq('id', scan.id);
  assert.equal(upd.error?.code, '42501', 'histórico não pode ser alterado');
  const del = await A.sb.from('microchip_events').delete().eq('id', scan.id);
  assert.equal(del.error?.code, '42501', 'histórico não pode ser apagado');
});

test('microchip: B não lê nem escreve no histórico de A', async () => {
  const rows = unwrap(await B.sb.from('microchip_events').select('*').eq('microchip_id', dataA.microchip.id));
  assert.equal(rows.length, 0);
  const own = unwrap(await B.sb.from('microchip_events').select('clinic_id'));
  assert.ok(own.every((e) => e.clinic_id === clinicB.id));

  const ins = await B.sb.from('microchip_events').insert({
    clinic_id: clinicA.id, microchip_id: dataA.microchip.id, event_type: 'note', details: 'intruso',
  });
  assert.ok(ins.error, 'B não pode anotar no chip de A');

  // Chip de A com clinic_id de B: FK composta impede.
  const cross = await B.sb.from('microchip_events').insert({
    clinic_id: clinicB.id, microchip_id: dataA.microchip.id, event_type: 'note', details: 'intruso',
  });
  assert.equal(cross.error?.code, '23503', cross.error?.message);
});

test('microchip: busca entre clínicas só revela nome da clínica com opt-in', async () => {
  // Sem opt-in: B só encontra o próprio chip.
  let res = unwrap(await B.sb.rpc('lookup_microchip', { p_code: CHIP_CODE }));
  assert.deepEqual(res, [{ clinic_name: clinicB.name, own_clinic: true }]);

  unwrap(await A.sb.from('microchips').update({ public_lookup: true }).eq('id', dataA.microchip.id));
  res = unwrap(await B.sb.rpc('lookup_microchip', { p_code: SPACED_CHIP_CODE }));
  assert.equal(res.length, 2);
  const other = res.find((r) => !r.own_clinic);
  assert.deepEqual(Object.keys(other).sort(), ['clinic_name', 'own_clinic'], 'nenhum dado além do nome da clínica');
  assert.equal(other.clinic_name, clinicA.name);

  const invalid = await B.sb.rpc('lookup_microchip', { p_code: 'abc' });
  assert.equal(invalid.error?.code, '22023');

  const anon = await newClient().rpc('lookup_microchip', { p_code: CHIP_CODE });
  assert.ok(anon.error, 'anônimo não busca chips');
});

test('microchip: recepção não exclui chip; excluir animal desvincula e registra no histórico', async () => {
  const S = await signUp('staff-chip');
  unwrap(await A.sb.rpc('add_clinic_member', { p_clinic_id: clinicA.id, p_email: S.email, p_role: 'staff' }));
  const deleted = unwrap(await S.sb.from('microchips').delete().eq('id', dataA.microchip.id).select());
  assert.equal(deleted.length, 0, 'staff apagou chip');

  const animal = unwrap(
    await A.sb.from('animals').insert({
      clinic_id: clinicA.id, client_id: dataA.client.id, name: 'Temporário', species: 'Cat',
      breed: 'SRD', age: 1, date_of_birth: '2025-01-01', weight: 3,
    }).select().single()
  );
  const chip = unwrap(
    await A.sb.from('microchips').insert({ clinic_id: clinicA.id, animal_id: animal.id, code: '076000000000001' }).select().single()
  );
  unwrap(await A.sb.from('animals').delete().eq('id', animal.id));

  const after = unwrap(await A.sb.from('microchips').select('animal_id').eq('id', chip.id).single());
  assert.equal(after.animal_id, null);
  const events = unwrap(await A.sb.from('microchip_events').select('event_type, animal_id').eq('microchip_id', chip.id));
  assert.ok(events.some((e) => e.event_type === 'unlinked' && e.animal_id === animal.id));
});

// ---------------------------------------------------------------------------
// Ficha do animal (eventos clínicos)
// ---------------------------------------------------------------------------

test('ficha: autor vem da sessão e não pode ser forjado nem alterado', async () => {
  const created = unwrap(
    await A.sb
      .from('clinical_events')
      .insert({ animal_id: dataA.animal.id, event_type: 'note', title: 'Observação', author_id: B.userId, author_email: 'forjado@example.test' })
      .select()
      .single()
  );
  assert.equal(created.author_id, A.userId);
  assert.equal(created.author_email, A.email);
  assert.equal(created.clinic_id, clinicA.id);

  const updated = unwrap(
    await A.sb.from('clinical_events').update({ author_id: B.userId, author_email: 'x@example.test', title: 'Editada' }).eq('id', created.id).select().single()
  );
  assert.equal(updated.author_id, A.userId);
  assert.equal(updated.author_email, A.email);
  assert.equal(updated.title, 'Editada');
});

test('ficha: pesagem mais recente atualiza o peso do animal', async () => {
  const insert = (kg, when) =>
    A.sb.from('clinical_events').insert({ animal_id: dataA.animal.id, event_type: 'weight', weight_kg: kg, occurred_at: when }).select().single();
  unwrap(await insert(12.345, '2026-03-01T10:00:00Z'));
  const older = unwrap(await insert(9, '2026-01-01T10:00:00Z'));

  let animal = unwrap(await A.sb.from('animals').select('weight').eq('id', dataA.animal.id).single());
  assert.equal(Number(animal.weight), 12.35, 'pesagem antiga não sobrescreve a mais recente');

  unwrap(await A.sb.from('clinical_events').update({ occurred_at: '2026-06-01T10:00:00Z' }).eq('id', older.id));
  animal = unwrap(await A.sb.from('animals').select('weight').eq('id', dataA.animal.id).single());
  assert.equal(Number(animal.weight), 9);
});

test('ficha: tipos validados no banco', async () => {
  const bad = [
    { event_type: 'weight' },
    { event_type: 'note', title: '  ' },
    { event_type: 'vitals' },
    { event_type: 'note', title: 'x', weight_kg: 3 },
    { event_type: 'vitals', temperature_c: 60 },
    { event_type: 'note', title: 'x', resolved_at: new Date().toISOString() },
    { event_type: 'outro', title: 'x' },
  ];
  for (const row of bad) {
    const { error } = await A.sb.from('clinical_events').insert({ animal_id: dataA.animal.id, ...row });
    assert.equal(error?.code, '23514', `deveria rejeitar ${JSON.stringify(row)}: ${error?.message}`);
  }
  unwrap(await A.sb.from('clinical_events').insert({ animal_id: dataA.animal.id, event_type: 'vitals', temperature_c: 38.6, pain_score: 2 }));
});

test('ficha: não cria evento para animal de outra clínica', async () => {
  const { error } = await A.sb.from('clinical_events').insert({ clinic_id: clinicA.id, animal_id: dataB.animal.id, event_type: 'note', title: 'x' });
  assert.ok(error, 'deveria falhar');
});

// ---------------------------------------------------------------------------
// Agenda: fluxo de atendimento e profissional
// ---------------------------------------------------------------------------

test('agenda: transições gravam chegada, início e fim pelo servidor', async () => {
  const apt = unwrap(
    await A.sb
      .from('appointments')
      .insert({
        client_id: dataA.client.id,
        animal_id: dataA.animal.id,
        appointment_date: '2026-12-02',
        appointment_time: '09:00',
        reason_for_visit: 'fluxo',
        checked_in_at: '2000-01-01T00:00:00Z',
      })
      .select()
      .single()
  );
  assert.equal(apt.checked_in_at, null, 'cliente não define horários do fluxo');

  const waiting = unwrap(await A.sb.from('appointments').update({ status: 'Waiting' }).eq('id', apt.id).select().single());
  assert.ok(waiting.checked_in_at);
  const started = unwrap(await A.sb.from('appointments').update({ status: 'InProgress' }).eq('id', apt.id).select().single());
  assert.equal(started.checked_in_at, waiting.checked_in_at);
  assert.ok(started.started_at);
  const done = unwrap(await A.sb.from('appointments').update({ status: 'Completed', started_at: null }).eq('id', apt.id).select().single());
  assert.equal(done.started_at, started.started_at, 'edição não apaga tempos');
  assert.ok(done.finished_at);

  const back = unwrap(await A.sb.from('appointments').update({ status: 'Scheduled' }).eq('id', apt.id).select().single());
  assert.equal(back.checked_in_at, null);
  assert.equal(back.finished_at, null);
});

test('agenda: mesmo profissional não tem horários sobrepostos', async () => {
  const base = {
    client_id: dataA.client.id,
    animal_id: dataA.animal.id,
    appointment_date: '2026-12-03',
    reason_for_visit: 'conflito',
    professional_id: A.userId,
    duration_minutes: 30,
  };
  const first = unwrap(await A.sb.from('appointments').insert({ ...base, appointment_time: '10:00' }).select().single());
  const overlap = await A.sb.from('appointments').insert({ ...base, appointment_time: '10:15' });
  assert.equal(overlap.error?.code, '23P01', overlap.error?.message);

  unwrap(await A.sb.from('appointments').insert({ ...base, appointment_time: '10:30' }));
  unwrap(await A.sb.from('appointments').insert({ ...base, appointment_time: '10:15', professional_id: null }));

  unwrap(await A.sb.from('appointments').update({ status: 'Cancelled' }).eq('id', first.id));
  unwrap(await A.sb.from('appointments').insert({ ...base, appointment_time: '10:00' }));
});

test('agenda: profissional precisa ser da equipe da clínica', async () => {
  const { error } = await A.sb.from('appointments').insert({
    client_id: dataA.client.id,
    animal_id: dataA.animal.id,
    appointment_date: '2026-12-04',
    appointment_time: '11:00',
    reason_for_visit: 'outro tenant',
    professional_id: B.userId,
  });
  assert.equal(error?.code, '23503', error?.message);
});

// ---------------------------------------------------------------------------
// Vacinas: protocolos e programação
// ---------------------------------------------------------------------------

test('vacinas: protocolo programa a série, aplica dose e programa reforço', async () => {
  const proto = unwrap(
    await A.sb.from('vaccine_protocols').insert({ name: 'V10 teste', doses: 2, interval_days: 21, booster_days: 365 }).select().single()
  );
  const series = unwrap(await A.sb.rpc('apply_vaccine_protocol', { p_animal_id: dataA.animal.id, p_protocol_id: proto.id, p_start: '2026-01-10' }));
  let doses = unwrap(await A.sb.from('vaccine_doses').select('*').eq('series_id', series).order('dose_number'));
  assert.deepEqual(doses.map((d) => d.due_date), ['2026-01-10', '2026-01-31']);

  unwrap(await A.sb.rpc('apply_vaccine_dose', { p_dose_id: doses[0].id, p_application_date: '2026-01-10' }));
  const vacc2 = unwrap(await A.sb.rpc('apply_vaccine_dose', { p_dose_id: doses[1].id, p_application_date: '2026-02-01' }));

  doses = unwrap(await A.sb.from('vaccine_doses').select('*').eq('series_id', series).order('dose_number'));
  assert.equal(doses.length, 3);
  assert.equal(doses[2].is_booster, true);
  assert.equal(doses[2].due_date, '2027-02-01');

  const v = unwrap(await A.sb.from('animal_vaccinations').select('*').eq('id', vacc2).single());
  assert.equal(v.vaccine_name, 'V10 teste');
  assert.equal(v.next_dose_date, '2027-02-01');

  const again = await A.sb.rpc('apply_vaccine_dose', { p_dose_id: doses[1].id, p_application_date: '2026-02-01' });
  assert.equal(again.error?.code, '22023', 'dose já aplicada não é aplicada de novo');
});

test('vacinas: protocolo encadeado é programado ao terminar a série', async () => {
  const adult = unwrap(await A.sb.from('vaccine_protocols').insert({ name: 'Adulto', doses: 1, interval_days: 30 }).select().single());
  const puppy = unwrap(
    await A.sb.from('vaccine_protocols').insert({ name: 'Filhote', doses: 1, interval_days: 30, next_protocol_id: adult.id }).select().single()
  );
  const series = unwrap(await A.sb.rpc('apply_vaccine_protocol', { p_animal_id: dataA.animal.id, p_protocol_id: puppy.id, p_start: '2026-03-01' }));
  const [dose] = unwrap(await A.sb.from('vaccine_doses').select('*').eq('series_id', series));
  unwrap(await A.sb.rpc('apply_vaccine_dose', { p_dose_id: dose.id, p_application_date: '2026-03-02' }));
  const chained = unwrap(await A.sb.from('vaccine_doses').select('*').eq('protocol_id', adult.id).eq('animal_id', dataA.animal.id));
  assert.equal(chained.length, 1);
  assert.equal(chained[0].due_date, '2026-04-01');
});

test('vacinas: B não usa protocolo nem animal de A', async () => {
  const proto = unwrap(await A.sb.from('vaccine_protocols').insert({ name: 'Privado A', doses: 1, interval_days: 10 }).select().single());
  const cross = await B.sb.rpc('apply_vaccine_protocol', { p_animal_id: dataB.animal.id, p_protocol_id: proto.id, p_start: '2026-01-01' });
  assert.ok(cross.error, 'B não enxerga o protocolo de A');
  const list = unwrap(await B.sb.from('vaccine_protocols').select('*'));
  assert.ok(!list.some((p) => p.id === proto.id));
  const direct = await B.sb.from('vaccine_doses').insert({ animal_id: dataA.animal.id, protocol_id: proto.id, series_id: proto.id, dose_number: 1, due_date: '2026-01-01' });
  assert.ok(direct.error, 'B não programa dose para animal de A');
});
