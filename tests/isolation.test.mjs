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
  return { client, animal, record, vaccination, appointment };
}

const TABLES = {
  clients: 'client',
  animals: 'animal',
  medical_records: 'record',
  animal_vaccinations: 'vaccination',
  appointments: 'appointment',
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
  for (const table of [...Object.keys(TABLES), 'clinics', 'clinic_members']) {
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

  for (const [table, key] of [['medical_records', 'record'], ['animal_vaccinations', 'vaccination'], ['clients', 'client'], ['animals', 'animal']]) {
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
