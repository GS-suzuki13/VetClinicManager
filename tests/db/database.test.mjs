// Testes das regras do banco SEM Docker: aplica todas as migrações num Postgres
// em memória (PGlite) com stubs do que o Supabase provê (papéis, auth.users,
// auth.uid()) e executa os cenários como usuários "authenticated"/"anon", com
// RLS ativo. Rode com `npm run test:db`.
//
// Os testes de API (tests/isolation.test.mjs) continuam exigindo o Supabase
// local; estes cobrem triggers, constraints, RLS e RPCs.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const MIGRATIONS = new URL('../../supabase/migrations/', import.meta.url);
let db;
let ua, ub, uc; // A = owner da clínica A, B = owner da clínica B, C = recepção em A
let A, B;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function as(uid, sql, params = [], clinic = null) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.headers', $2, true)`, [
      uid ?? '',
      clinic ? JSON.stringify({ 'x-clinic-id': clinic }) : '',
    ]);
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
    return (await tx.query(sql, params)).rows;
  });
}
const anon = (sql, params) => as(null, sql, params);
const one = async (...args) => (await as(...args))[0];

async function fails(code, fn, msg) {
  try {
    await fn();
  } catch (e) {
    if (code) assert.equal(e.code, code, `${msg}: ${e.message}`);
    return e;
  }
  assert.fail(`deveria falhar: ${msg}`);
}

async function seedClinic(uid, tag) {
  const { id: clinic } = await one(uid, `select (public.create_clinic($1)).id`, [`Clínica ${tag}`]);
  const client = await one(
    uid,
    `insert into clients(full_name, cpf, email, phone_number, date_of_birth, residential_address)
     values ($1, '000.000.000-00', $2, '(11) 99999-0000', '1990-01-01', 'Rua 1') returning *`,
    [`Tutor ${tag}`, `t-${tag}@example.test`]
  );
  const animal = await one(
    uid,
    `insert into animals(client_id, name, species, breed, age, date_of_birth, weight) values ($1, $2, 'Dog', 'SRD', 3, '2021-01-01', 10) returning *`,
    [client.id, `Pet ${tag}`]
  );
  return { clinic, client, animal };
}

const balance = async (uid, client) =>
  Number((await one(uid, `select coalesce(sum(amount), 0) as b from client_account_entries where client_id = $1`, [client])).b);

async function newSale(uid, items, extra = {}) {
  const sale = await one(uid, `insert into sales(client_id, animal_id, discount, status) values ($1, $2, $3, $4) returning *`, [
    extra.client ?? A.client.id,
    extra.animal ?? A.animal.id,
    extra.discount ?? 0,
    extra.status ?? 'open',
  ]);
  for (const it of items) {
    await as(uid, `insert into sale_items(sale_id, item_id, description, quantity, unit_price, discount) values ($1, $2, $3, $4, $5, $6)`, [
      sale.id,
      it.item ?? null,
      it.description ?? 'Item',
      it.quantity ?? 1,
      it.price,
      it.discount ?? 0,
    ]);
  }
  return one(uid, `select * from sales where id = $1`, [sale.id]);
}

before(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema extensions;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}', created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth, extensions to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
    } catch (e) {
      throw new Error(`Migração ${file}: ${e.message}`);
    }
  }
  const user = async (email) => (await db.query(`insert into auth.users(email) values ($1) returning id`, [email])).rows[0].id;
  ua = await user('a@example.test');
  ub = await user('b@example.test');
  uc = await user('c@example.test');
  A = await seedClinic(ua, 'A');
  B = await seedClinic(ub, 'B');
  await db.query(`insert into clinic_members(clinic_id, user_id, role) values ($1, $2, 'staff')`, [A.clinic, uc]);
});

// ---------------------------------------------------------------------------
// Fases 1–3: ficha, agenda e vacinas
// ---------------------------------------------------------------------------

test('ficha: autor vem da sessão e não pode ser forjado', async () => {
  const ev = await one(ua, `insert into clinical_events(animal_id, event_type, title, author_id) values ($1, 'note', 'Obs', $2) returning *`, [
    A.animal.id,
    ub,
  ]);
  assert.equal(ev.author_id, ua);
  assert.equal(ev.author_email, 'a@example.test');
});

test('ficha: pesagem mais recente atualiza o peso do animal', async () => {
  const ins = (kg, when) => as(ua, `insert into clinical_events(animal_id, event_type, weight_kg, occurred_at) values ($1, 'weight', $2, $3)`, [A.animal.id, kg, when]);
  await ins(12.345, '2026-03-01T10:00:00Z');
  await ins(9, '2026-01-01T10:00:00Z');
  const { weight } = await one(ua, `select weight from animals where id = $1`, [A.animal.id]);
  assert.equal(Number(weight), 12.35);
});

test('ficha: tipos validados e outra clínica bloqueada', async () => {
  await fails('23514', () => as(ua, `insert into clinical_events(animal_id, event_type) values ($1, 'vitals')`, [A.animal.id]), 'sinais sem valor');
  await fails(null, () => as(ua, `insert into clinical_events(clinic_id, animal_id, event_type, title) values ($1, $2, 'note', 'x')`, [A.clinic, B.animal.id]), 'animal de B');
  assert.equal((await as(ub, `select * from clinical_events`)).length, 0);
});

test('agenda: fluxo com horários do servidor e conflito de profissional', async () => {
  const base = `insert into appointments(client_id, animal_id, appointment_date, appointment_time, reason_for_visit, professional_id, duration_minutes) values ($1, $2, '2026-12-03', $3, 'x', $4, 30) returning *`;
  const apt = await one(ua, base, [A.client.id, A.animal.id, '10:00', ua]);
  await fails('23P01', () => as(ua, base, [A.client.id, A.animal.id, '10:15', ua]), 'sobreposição');
  await fails('23503', () => as(ua, base, [A.client.id, A.animal.id, '11:00', ub]), 'profissional de B');
  const w = await one(ua, `update appointments set status = 'Waiting', checked_in_at = '2000-01-01' where id = $1 returning *`, [apt.id]);
  assert.ok(new Date(w.checked_in_at).getFullYear() > 2000);
});

test('vacinas: protocolo programa série e reforço', async () => {
  const p = await one(ua, `insert into vaccine_protocols(name, doses, interval_days, booster_days) values ('V10', 2, 21, 365) returning *`);
  const { s } = await one(ua, `select apply_vaccine_protocol($1, $2, '2026-01-10') as s`, [A.animal.id, p.id]);
  const doses = await as(ua, `select id, due_date::text as due from vaccine_doses where series_id = $1 order by dose_number`, [s]);
  assert.deepEqual(doses.map((d) => d.due), ['2026-01-10', '2026-01-31']);
  await as(ua, `select apply_vaccine_dose($1, '2026-01-10')`, [doses[0].id]);
  await as(ua, `select apply_vaccine_dose($1, '2026-02-01')`, [doses[1].id]);
  const booster = await one(ua, `select due_date::text as due from vaccine_doses where series_id = $1 and is_booster`, [s]);
  assert.equal(booster.due, '2027-02-01');
  await fails(null, () => as(ub, `select apply_vaccine_protocol($1, $2, '2026-01-01')`, [B.animal.id, p.id]), 'protocolo de A');
});

// ---------------------------------------------------------------------------
// Fase 4–6: catálogo, estoque, caixa, vendas e conta corrente
// ---------------------------------------------------------------------------

let racao, consulta;

test('estoque: quantidade só muda por movimentação', async () => {
  racao = await one(ua, `insert into catalog_items(name, kind, price, cost, track_stock, min_stock, stock_qty) values ('Ração 1kg', 'product', 50, 30, true, 2, 999) returning *`);
  consulta = await one(ua, `insert into catalog_items(name, kind, price) values ('Consulta', 'service', 150) returning *`);
  assert.equal(Number(racao.stock_qty), 0, 'insert ignora stock_qty');
  await as(ua, `update catalog_items set stock_qty = 500 where id = $1`, [racao.id]);
  await as(ua, `insert into stock_movements(item_id, movement_type, quantity, unit_cost, batch, expires_on) values ($1, 'purchase', 10, 30, 'L1', '2027-01-01')`, [racao.id]);
  assert.equal(Number((await one(ua, `select stock_qty from catalog_items where id = $1`, [racao.id])).stock_qty), 10);
  await fails('42501', () => as(ua, `insert into stock_movements(item_id, movement_type, quantity) values ($1, 'sale', -1)`, [racao.id]), 'venda direta');
  await fails('23514', () => as(ua, `insert into stock_movements(item_id, movement_type, quantity) values ($1, 'purchase', 1)`, [consulta.id]), 'serviço sem estoque');
  await fails('23514', () => as(ua, `insert into stock_movements(item_id, movement_type, quantity) values ($1, 'loss', 1)`, [racao.id]), 'perda positiva');
});

test('venda: totais do servidor, exige caixa aberto e pagamentos que fecham', async () => {
  const sale = await newSale(ua, [
    { item: racao.id, description: 'Ração 1kg', quantity: 2, price: 50 },
    { item: consulta.id, description: 'Consulta', price: 150, discount: 10 },
  ]);
  assert.equal(Number(sale.subtotal), 240);
  assert.equal(Number(sale.total), 240);
  const forged = await one(ua, `update sales set total = 1, subtotal = 1, discount = 20 where id = $1 returning *`, [sale.id]);
  assert.equal(Number(forged.total), 220, 'total recalculado com o desconto');

  const pay = (p) => as(ua, `select finalize_sale($1, $2::jsonb)`, [sale.id, JSON.stringify(p)]);
  const noCash = await fails('P0001', () => pay([{ method: 'pix', amount: 220 }]), 'sem caixa');
  assert.match(noCash.message, /Abra o caixa/);

  await as(ua, `select open_cash_session(100)`);
  await fails('P0001', () => as(ua, `select open_cash_session(0)`), 'dois caixas');
  await fails('P0001', () => pay([{ method: 'pix', amount: 100 }]), 'não fecha');

  await pay([
    { method: 'cash', amount: 70 },
    { method: 'pix', amount: 100 },
    { method: 'on_account', amount: 50 },
  ]);
  const done = await one(ua, `select * from sales where id = $1`, [sale.id]);
  assert.equal(done.status, 'completed');
  assert.equal(Number((await one(ua, `select stock_qty from catalog_items where id = $1`, [racao.id])).stock_qty), 8);
  assert.equal(await balance(ua, A.client.id), -50, 'a prazo vira débito');

  const entries = await as(ua, `select kind, amount::float as amount from financial_entries where payment_id in (select id from payments where sale_id = $1) order by amount`, [sale.id]);
  assert.deepEqual(entries, [{ kind: 'income', amount: 70 }, { kind: 'income', amount: 100 }], 'a prazo não entra no caixa');

  await fails('42501', () => as(ua, `update sales set discount = 0 where id = $1`, [sale.id]), 'editar finalizada');
  await fails('42501', () => as(ua, `insert into sale_items(sale_id, description, unit_price) values ($1, 'x', 1)`, [sale.id]), 'item em finalizada');
  await fails(null, () => as(ua, `insert into payments(method, amount) values ('cash', 10)`), 'pagamento direto');
  await fails('P0001', () => as(ua, `delete from financial_entries where payment_id is not null`), 'excluir lançamento de venda');
  const locked = await one(ua, `update financial_entries set amount = 1 where payment_id is not null returning amount::float as amount`);
  assert.notEqual(locked.amount, 1, 'valor de lançamento de venda travado');
});

test('conta corrente: recebimento quita débito e crédito insuficiente é bloqueado', async () => {
  await as(ua, `select receive_client_payment($1, 80, 'pix', 'Acerto')`, [A.client.id]);
  assert.equal(await balance(ua, A.client.id), 30, 'sobra vira crédito');

  const sale = await newSale(ua, [{ description: 'Banho', price: 40 }]);
  await fails('P0001', () => as(ua, `select finalize_sale($1, '[{"method":"client_credit","amount":40}]')`, [sale.id]), 'crédito insuficiente');
  await as(ua, `select finalize_sale($1, '[{"method":"client_credit","amount":30},{"method":"debit_card","amount":10}]')`, [sale.id]);
  assert.equal(await balance(ua, A.client.id), 0);
});

test('desconto: recepção respeita o limite; proprietário não', async () => {
  const mk = (uid) => newSale(uid, [{ description: 'Vacina', price: 100, discount: 20 }]);
  const staffSale = await mk(uc);
  const e = await fails('P0001', () => as(uc, `select finalize_sale($1, '[{"method":"cash","amount":80}]')`, [staffSale.id]), 'acima do limite');
  assert.match(e.message, /limite de 10/);
  const ownerSale = await mk(ua);
  await as(ua, `select finalize_sale($1, '[{"method":"cash","amount":80}]')`, [ownerSale.id]);
});

test('cancelamento de venda finalizada estorna caixa, conta e estoque', async () => {
  const sale = await newSale(ua, [{ item: racao.id, description: 'Ração', quantity: 1, price: 50 }]);
  await as(ua, `select finalize_sale($1, '[{"method":"cash","amount":20},{"method":"on_account","amount":30}]')`, [sale.id]);
  const before = await balance(ua, A.client.id);
  await fails('42501', () => as(uc, `select cancel_sale($1, 'erro')`, [sale.id]), 'recepção não cancela finalizada');
  await as(ua, `select cancel_sale($1, 'Cliente desistiu')`, [sale.id]);
  assert.equal(await balance(ua, A.client.id), before + 30);
  assert.equal(Number((await one(ua, `select stock_qty from catalog_items where id = $1`, [racao.id])).stock_qty), 8, 'devolve a unidade vendida');
  const refund = await one(ua, `select kind, amount::float as amount from financial_entries where description like 'Estorno da venda%'`);
  assert.deepEqual(refund, { kind: 'expense', amount: 20 });
});

test('caixa: sangria, suprimento e fechamento com valor esperado', async () => {
  await as(ua, `select add_cash_adjustment('withdrawal', 50, 'Depósito no banco')`);
  await as(ua, `select add_cash_adjustment('deposit', 10, 'Troco')`);
  const session = await one(ua, `select id from cash_sessions where status = 'open'`);
  // 100 abertura + 70 + 80 (dinheiro) + 20 − 20 (venda e estorno) − 50 + 10
  const { e } = await one(ua, `select cash_session_expected($1)::float as e`, [session.id]);
  assert.equal(e, 210);
  const { diff } = await one(ua, `select close_cash_session($1, 205)::float as diff`, [session.id]);
  assert.equal(diff, -5);
  await fails('P0001', () => as(ua, `select receive_client_payment($1, 10, 'pix')`, [A.client.id]), 'caixa fechado');
});

test('vendas e caixa: outra clínica não lê nem opera', async () => {
  for (const t of ['sales', 'sale_items', 'payments', 'cash_sessions', 'client_account_entries', 'catalog_items', 'stock_movements', 'client_balances']) {
    assert.equal((await as(ub, `select * from ${t}`)).length, 0, t);
  }
  const sale = await one(ua, `select id from sales limit 1`);
  await fails('42501', () => as(ub, `select cancel_sale($1, 'x')`, [sale.id]), 'cancelar venda de A');
  await fails('42501', () => as(ub, `select receive_client_payment($1, 10, 'pix')`, [A.client.id]), 'receber de cliente de A');
  await fails(null, () => as(ub, `insert into sales(client_id) values ($1)`, [A.client.id]), 'venda para cliente de A');
  await fails(null, () => anon(`select * from sales`), 'anônimo');
});

// ---------------------------------------------------------------------------
// Fase 7: financeiro e conciliação
// ---------------------------------------------------------------------------

test('financeiro: só proprietário/administrador vê e lança', async () => {
  assert.equal((await as(uc, `select * from financial_entries`)).length, 0, 'recepção não vê');
  await fails(null, () => as(uc, `insert into financial_entries(kind, description, amount, due_on) values ('expense', 'x', 1, '2026-11-01')`), 'recepção não lança');
  const cats = await as(ua, `select name from financial_categories where system_key = 'sales'`);
  assert.equal(cats.length, 1, 'categorias padrão');
  const expenseCat = await one(ua, `select id from financial_categories where kind = 'expense' and system_key is null limit 1`);
  await fails('23514', () =>
    as(ua, `insert into financial_entries(kind, description, amount, due_on, category_id) values ('income', 'x', 1, '2026-11-01', $1)`, [expenseCat.id]), 'categoria de outro tipo');
});

test('conciliação: liga extrato ao lançamento e cria lançamento a partir da linha', async () => {
  const bank = await one(ua, `select id from financial_accounts where system_key = 'bank'`);
  const rent = await one(ua, `insert into financial_entries(kind, description, amount, due_on) values ('expense', 'Aluguel', 2500, '2026-11-05') returning *`);
  assert.equal(rent.paid_on, null);
  const line = await one(ua, `insert into bank_statement_lines(account_id, posted_on, amount, description, fitid) values ($1, '2026-11-06', -2500, 'TED ALUGUEL', 'F1') returning *`, [bank.id]);
  await fails('23505', () => as(ua, `insert into bank_statement_lines(account_id, posted_on, amount, fitid) values ($1, '2026-11-06', -1, 'F1')`, [bank.id]), 'mesma linha duas vezes');

  const wrong = await one(ua, `insert into financial_entries(kind, description, amount, due_on) values ('expense', 'Outro', 99, '2026-11-05') returning id`);
  await fails('P0001', () => as(ua, `select reconcile_statement_line($1, $2)`, [line.id, wrong.id]), 'valor diferente');

  await as(ua, `select reconcile_statement_line($1, $2)`, [line.id, rent.id]);
  const paid = await one(ua, `select paid_on::text as paid, account_id from financial_entries where id = $1`, [rent.id]);
  assert.deepEqual(paid, { paid: '2026-11-06', account_id: bank.id });

  const fee = await one(ua, `insert into bank_statement_lines(account_id, posted_on, amount, description, fitid) values ($1, '2026-11-07', -12.9, 'TARIFA', 'F2') returning *`, [bank.id]);
  const cat = await one(ua, `select id from financial_categories where name = 'Tarifas bancárias e de cartão'`);
  const { id } = await one(ua, `select create_entry_from_statement_line($1, $2) as id`, [fee.id, cat.id]);
  const created = await one(ua, `select kind, amount::float as amount, paid_on::text as paid from financial_entries where id = $1`, [id]);
  assert.deepEqual(created, { kind: 'expense', amount: 12.9, paid: '2026-11-07' });
  assert.equal((await as(ub, `select * from bank_statement_lines`)).length, 0);
});

// ---------------------------------------------------------------------------
// Fase 8: internação
// ---------------------------------------------------------------------------

test('internação: mapa de execução, box exclusivo e desfecho', async () => {
  const box = await one(ua, `insert into hospital_boxes(name, kind) values ('Canil 1', 'kennel') returning *`);
  const h = await one(ua, `insert into hospitalizations(animal_id, box_id, triage, reason, status) values ($1, $2, 'red', 'Gastroenterite', 'deceased') returning *`, [A.animal.id, box.id]);
  assert.equal(h.status, 'active', 'status inicial forçado');

  const other = await one(ua, `insert into animals(client_id, name, species, breed, age, date_of_birth, weight) values ($1, 'Outro', 'Cat', 'SRD', 1, '2025-01-01', 3) returning *`, [A.client.id]);
  await fails('23505', () => as(ua, `insert into hospitalizations(animal_id, box_id, reason) values ($1, $2, 'x')`, [other.id, box.id]), 'box ocupado');
  await fails('23505', () => as(ua, `insert into hospitalizations(animal_id, reason) values ($1, 'x')`, [A.animal.id]), 'animal já internado');

  await as(ua, `insert into hospital_prescriptions(hospitalization_id, description, dose, route, interval_hours, starts_at, ends_at) values ($1, 'Dipirona', '25 mg/kg', 'IV', 8, now(), now() + interval '24 hours')`, [h.id]);
  const tasks = await as(ua, `select * from hospital_tasks where hospitalization_id = $1 order by scheduled_at`, [h.id]);
  assert.equal(tasks.length, 3, '0h, 8h e 16h');
  assert.match(tasks[0].description, /Dipirona 25 mg\/kg \(IV\)/);

  const done = await one(ua, `update hospital_tasks set status = 'done', done_by_email = 'x' where id = $1 returning *`, [tasks[0].id]);
  assert.equal(done.done_by_email, 'a@example.test');
  assert.ok(done.done_at);

  const kept = await one(ua, `update hospitalizations set status = 'discharged', ended_at = now() where id = $1 returning status`, [h.id]);
  assert.equal(kept.status, 'active', 'desfecho só pela RPC');

  await as(ua, `select finish_hospitalization($1, 'deceased', 'Parada cardiorrespiratória')`, [h.id]);
  const pending = await as(ua, `select * from hospital_tasks where hospitalization_id = $1 and status = 'pending'`, [h.id]);
  assert.equal(pending.length, 0);
  const animal = await one(ua, `select deceased_on from animals where id = $1`, [A.animal.id]);
  assert.ok(animal.deceased_on);
  const ev = await one(ua, `select title from clinical_events where animal_id = $1 and title like 'Óbito%'`, [A.animal.id]);
  assert.ok(ev);
  await fails('P0001', () => as(ua, `select finish_hospitalization($1, 'discharged')`, [h.id]), 'já encerrada');
  assert.equal((await as(ub, `select * from hospitalizations`)).length, 0);
});

// ---------------------------------------------------------------------------
// Fase 9: relacionamento, NPS, agendamento online e cartão do pet
// ---------------------------------------------------------------------------

test('modelos de mensagem padrão e histórico com autor', async () => {
  const t = await as(ua, `select key from message_templates order by key`);
  assert.ok(t.some((x) => x.key === 'appointment_confirm'));
  const m = await one(ua, `insert into client_messages(client_id, body, direction, author_email) values ($1, 'Oi', 'inbound', 'x') returning *`, [A.client.id]);
  assert.equal(m.author_email, 'a@example.test');
  await fails(null, () => as(ub, `insert into client_messages(client_id, body) values ($1, 'x')`, [A.client.id]), 'cliente de A');
});

test('NPS: tutor responde por token, uma vez; equipe não altera a nota', async () => {
  const s = await one(ua, `insert into nps_surveys(client_id, score) values ($1, 10) returning *`, [A.client.id]);
  assert.equal(s.score, null);
  const info = (await anon(`select get_nps_survey($1) as j`, [s.token]))[0].j;
  assert.deepEqual(info, { clinic_name: 'Clínica A', tutor_first_name: 'Tutor', answered: false });
  assert.equal((await anon(`select submit_nps($1, 9, 'Ótimo') as ok`, [s.token]))[0].ok, true);
  assert.equal((await anon(`select submit_nps($1, 0) as ok`, [s.token]))[0].ok, false, 'segunda resposta ignorada');
  await as(ua, `update nps_surveys set score = 10 where id = $1`, [s.id]);
  assert.equal((await one(ua, `select score from nps_surveys where id = $1`, [s.id])).score, 9);
  await fails(null, () => anon(`select * from nps_surveys`), 'anônimo não lista');
});

test('agendamento online: horários livres, pedido público e aceite', async () => {
  const day = (await db.query(`select (current_date + ((8 - extract(isodow from current_date)::int) % 7 + 1))::text as d`)).rows[0].d; // próxima terça ou depois
  await as(ua, `update clinics set booking_enabled = true, booking_slug = 'clinica-a', booking_open = '09:00', booking_close = '11:00', booking_slot_minutes = 30, booking_days = '{1,2,3,4,5,6,7}' where id = $1`, [A.clinic]);
  const info = (await anon(`select online_booking_info('clinica-a') as j`))[0].j;
  assert.equal(info.clinic_name, 'Clínica A');
  let slots = (await anon(`select s from online_booking_slots('clinica-a', $1) s`, [day])).map((r) => r.s);
  assert.deepEqual(slots, ['09:00', '09:30', '10:00', '10:30']);

  await as(ua, `insert into appointments(client_id, animal_id, appointment_date, appointment_time, reason_for_visit, duration_minutes) values ($1, $2, $3, '09:00', 'x', 60)`, [A.client.id, A.animal.id, day]);
  slots = (await anon(`select s from online_booking_slots('clinica-a', $1) s`, [day])).map((r) => r.s);
  assert.deepEqual(slots, ['10:00', '10:30'], 'consulta de 1h ocupa 09:00 e 09:30');

  const req = (time) =>
    anon(`select request_online_booking('clinica-a', 'Maria Silva', '(11) 98888-7777', null, 'Rex', 'Dog', 'Consulta', $1, $2, 'Tosse') as id`, [day, time]);
  const [{ id }] = await req('10:00');
  await fails('P0001', () => req('10:00'), 'horário pedido fica reservado');
  await fails('P0001', () => req('09:00'), 'horário ocupado');
  await fails(null, () => anon(`insert into booking_requests(clinic_id, tutor_name, phone, pet_name, species, care_type, requested_date, requested_time) values ($1, 'x', '11999999999', 'y', 'Dog', 'Consulta', $2, '10:30')`, [A.clinic, day]), 'insert direto');
  assert.equal((await as(ub, `select * from booking_requests`)).length, 0);

  const { apt } = await one(ua, `select accept_booking_request($1, $2, $3) as apt`, [id, A.client.id, A.animal.id]);
  const created = await one(ua, `select status, care_type, appointment_time::text as t from appointments where id = $1`, [apt]);
  assert.deepEqual(created, { status: 'Confirmed', care_type: 'Consulta', t: '10:00:00' });
  await fails('P0001', () => as(ua, `select accept_booking_request($1, $2, $3)`, [id, A.client.id, A.animal.id]), 'já respondido');
  assert.equal((await anon(`select online_booking_info('outra') as j`))[0].j, null);
});

test('cartão do pet: link público mostra vacinas e expira', async () => {
  const link = await one(ua, `insert into pet_share_links(animal_id) values ($1) returning *`, [A.animal.id]);
  const card = (await anon(`select get_pet_card($1) as j`, [link.token]))[0].j;
  assert.equal(card.pet.name, 'Pet A');
  assert.ok(card.vaccinations.length >= 2);
  await db.query(`update pet_share_links set expires_at = now() - interval '1 day' where id = $1`, [link.id]);
  assert.equal((await anon(`select get_pet_card($1) as j`, [link.token]))[0].j, null);
  await fails(null, () => as(ub, `insert into pet_share_links(animal_id) values ($1)`, [A.animal.id]), 'animal de A');
});
