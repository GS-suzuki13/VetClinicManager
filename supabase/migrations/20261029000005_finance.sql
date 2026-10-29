/*
  # Financeiro: contas, categorias, lançamentos e conciliação bancária

  - `financial_accounts`: caixa (dinheiro), conta bancária, maquininha etc.,
    com saldo inicial.
  - `financial_categories`: plano de contas simples. `dre_group` agrupa o DRE
    (receita, deduções, custos, despesas operacionais, pessoal, impostos,
    financeiro, outros).
  - `financial_entries`: contas a receber/pagar. `paid_on` vazio = em aberto.
    Pagamentos de vendas e recebimentos entram sozinhos (já pagos) e não podem
    ter valor/tipo alterados nem ser excluídos.
  - `bank_statement_lines`: extrato importado (OFX). Cada linha pode ser
    conciliada com um lançamento; `fitid` evita importar a mesma linha duas
    vezes. A conciliação bancária é a lacuna do SimplesVet citada no Reclame Aqui.

  Toda clínica recebe contas e categorias padrão (as atuais e as novas).
*/

CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  kind text NOT NULL DEFAULT 'bank' CHECK (kind IN ('cash', 'bank', 'card', 'other')),
  opening_balance numeric(12, 2) NOT NULL DEFAULT 0,
  system_key text CHECK (system_key IN ('cash', 'bank')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_accounts_id_clinic_key UNIQUE (id, clinic_id),
  CONSTRAINT financial_accounts_system_key UNIQUE (clinic_id, system_key)
);

CREATE TABLE public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  kind text NOT NULL CHECK (kind IN ('income', 'expense')),
  dre_group text NOT NULL DEFAULT 'other'
    CHECK (dre_group IN ('revenue', 'deductions', 'cogs', 'operating_expense', 'payroll', 'taxes', 'financial', 'other')),
  system_key text CHECK (system_key IN ('sales', 'refunds')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_categories_id_clinic_key UNIQUE (id, clinic_id),
  CONSTRAINT financial_categories_system_key UNIQUE (clinic_id, system_key)
);

CREATE TABLE public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('income', 'expense')),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 200),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  due_on date NOT NULL,
  paid_on date,
  category_id uuid,
  account_id uuid,
  client_id uuid,
  supplier text CHECK (char_length(supplier) <= 160),
  document text CHECK (char_length(document) <= 80),
  notes text CHECK (char_length(notes) <= 1000),
  payment_id uuid UNIQUE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_entries_id_clinic_key UNIQUE (id, clinic_id),
  CONSTRAINT financial_entries_category_same_clinic_fkey
    FOREIGN KEY (category_id, clinic_id) REFERENCES public.financial_categories(id, clinic_id) ON DELETE SET NULL (category_id),
  CONSTRAINT financial_entries_account_same_clinic_fkey
    FOREIGN KEY (account_id, clinic_id) REFERENCES public.financial_accounts(id, clinic_id) ON DELETE SET NULL (account_id),
  CONSTRAINT financial_entries_client_same_clinic_fkey
    FOREIGN KEY (client_id, clinic_id) REFERENCES public.clients(id, clinic_id) ON DELETE SET NULL (client_id),
  CONSTRAINT financial_entries_payment_same_clinic_fkey
    FOREIGN KEY (payment_id, clinic_id) REFERENCES public.payments(id, clinic_id) ON DELETE CASCADE
);

CREATE INDEX idx_financial_entries_due ON public.financial_entries (clinic_id, due_on);
CREATE INDEX idx_financial_entries_paid ON public.financial_entries (clinic_id, paid_on);

CREATE TABLE public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  posted_on date NOT NULL,
  -- Positivo = entrada; negativo = saída.
  amount numeric(12, 2) NOT NULL CHECK (amount <> 0),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  fitid text NOT NULL CHECK (char_length(fitid) BETWEEN 1 AND 120),
  entry_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_statement_lines_fitid_key UNIQUE (account_id, fitid),
  CONSTRAINT bank_statement_lines_account_same_clinic_fkey
    FOREIGN KEY (account_id, clinic_id) REFERENCES public.financial_accounts(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT bank_statement_lines_entry_same_clinic_fkey
    FOREIGN KEY (entry_id, clinic_id) REFERENCES public.financial_entries(id, clinic_id) ON DELETE SET NULL (entry_id)
);

CREATE INDEX idx_bank_statement_lines_account ON public.bank_statement_lines (account_id, posted_on DESC);

-- ---------------------------------------------------------------------------
-- Padrões por clínica
-- ---------------------------------------------------------------------------

CREATE FUNCTION private.seed_finance_defaults(p_clinic_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  INSERT INTO public.financial_accounts (clinic_id, name, kind, system_key) VALUES
    (p_clinic_id, 'Caixa (dinheiro)', 'cash', 'cash'),
    (p_clinic_id, 'Conta bancária', 'bank', 'bank')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.financial_categories (clinic_id, name, kind, dre_group, system_key) VALUES
    (p_clinic_id, 'Vendas e serviços', 'income', 'revenue', 'sales'),
    (p_clinic_id, 'Estornos e devoluções', 'expense', 'deductions', 'refunds')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.financial_categories (clinic_id, name, kind, dre_group)
  SELECT p_clinic_id, c.name, c.kind, c.dre_group
  FROM (VALUES
    ('Outras receitas', 'income', 'other'),
    ('Medicamentos e insumos', 'expense', 'cogs'),
    ('Exames terceirizados', 'expense', 'cogs'),
    ('Salários e encargos', 'expense', 'payroll'),
    ('Aluguel', 'expense', 'operating_expense'),
    ('Água, luz e internet', 'expense', 'operating_expense'),
    ('Marketing', 'expense', 'operating_expense'),
    ('Manutenção e equipamentos', 'expense', 'operating_expense'),
    ('Impostos', 'expense', 'taxes'),
    ('Tarifas bancárias e de cartão', 'expense', 'financial'),
    ('Outras despesas', 'expense', 'other')
  ) AS c(name, kind, dre_group)
  WHERE NOT EXISTS (SELECT 1 FROM public.financial_categories x WHERE x.clinic_id = p_clinic_id AND x.system_key IS NULL);
$$;

CREATE FUNCTION private.seed_clinic_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.seed_finance_defaults(NEW.id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER seed_clinic_finance AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION private.seed_clinic_finance();

-- ---------------------------------------------------------------------------
-- Pagamentos → lançamentos (regime de caixa)
-- ---------------------------------------------------------------------------

CREATE FUNCTION private.post_payment_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_day date := (NEW.received_at AT TIME ZONE 'America/Sao_Paulo')::date;
  v_number bigint;
  v_label text := CASE NEW.method
    WHEN 'cash' THEN 'dinheiro' WHEN 'pix' THEN 'Pix' WHEN 'debit_card' THEN 'cartão de débito'
    WHEN 'credit_card' THEN 'cartão de crédito' ELSE 'transferência' END;
BEGIN
  IF NEW.method IN ('client_credit', 'on_account') THEN
    RETURN NULL;
  END IF;
  SELECT number INTO v_number FROM public.sales WHERE id = NEW.sale_id;

  PERFORM private.enter_rpc();
  INSERT INTO public.financial_entries (
    clinic_id, kind, description, amount, due_on, paid_on, category_id, account_id, client_id, payment_id, author_id
  )
  VALUES (
    NEW.clinic_id,
    CASE WHEN NEW.amount > 0 THEN 'income' ELSE 'expense' END,
    CASE
      WHEN NEW.amount < 0 THEN format('Estorno da venda #%s (%s)', v_number, v_label)
      WHEN v_number IS NOT NULL THEN format('Venda #%s (%s)', v_number, v_label)
      ELSE format('Recebimento de cliente (%s)', v_label)
    END,
    abs(NEW.amount), v_day, v_day,
    (SELECT id FROM public.financial_categories
      WHERE clinic_id = NEW.clinic_id AND system_key = CASE WHEN NEW.amount > 0 THEN 'sales' ELSE 'refunds' END),
    (SELECT id FROM public.financial_accounts
      WHERE clinic_id = NEW.clinic_id AND system_key = CASE WHEN NEW.method = 'cash' THEN 'cash' ELSE 'bank' END),
    NEW.client_id, NEW.id, NEW.author_id
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER post_payment_entry AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.post_payment_entry();

-- Lançamentos automáticos: valor, tipo e origem ficam travados; não se excluem.
CREATE FUNCTION private.guard_financial_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF private.in_rpc() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.payment_id := NULL;
    RETURN NEW;
  END IF;
  IF OLD.payment_id IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Lançamento de venda: cancele a venda para estornar.' USING ERRCODE = 'P0001';
    END IF;
    NEW.kind := OLD.kind;
    NEW.amount := OLD.amount;
    NEW.paid_on := OLD.paid_on;
    NEW.due_on := OLD.due_on;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.payment_id := OLD.payment_id;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER guard_financial_entry BEFORE INSERT OR UPDATE OR DELETE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION private.guard_financial_entry();

-- Categoria precisa ser do mesmo tipo do lançamento.
CREATE FUNCTION private.check_entry_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.category_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.financial_categories c WHERE c.id = NEW.category_id AND c.kind = NEW.kind) THEN
    RAISE EXCEPTION 'A categoria não é do mesmo tipo do lançamento' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_entry_category BEFORE INSERT OR UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION private.check_entry_category();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

SELECT private.setup_tenant_table('financial_accounts', ARRAY['owner', 'admin']);
SELECT private.setup_tenant_table('financial_categories', ARRAY['owner', 'admin']);
SELECT private.setup_tenant_table('financial_entries', ARRAY['owner', 'admin']);
SELECT private.setup_tenant_table('bank_statement_lines', ARRAY['owner', 'admin']);
CREATE TRIGGER stamp_author BEFORE INSERT OR UPDATE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION private.stamp_author();

-- Financeiro é restrito a proprietário/administrador (recepção e veterinários
-- não veem nem alteram lançamentos e extratos).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['financial_entries', 'bank_statement_lines'] LOOP
    EXECUTE format('DROP POLICY "tenant_select" ON public.%I', t);
    EXECUTE format('DROP POLICY "tenant_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY "tenant_update" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "finance_select" ON public.%I FOR SELECT TO authenticated
         USING (private.can_access_clinic(clinic_id) AND private.has_clinic_role(clinic_id, ARRAY[''owner'', ''admin'']::public.clinic_role[]))', t);
    EXECUTE format(
      'CREATE POLICY "finance_insert" ON public.%I FOR INSERT TO authenticated
         WITH CHECK (private.can_access_clinic(clinic_id) AND private.has_clinic_role(clinic_id, ARRAY[''owner'', ''admin'']::public.clinic_role[]))', t);
    EXECUTE format(
      'CREATE POLICY "finance_update" ON public.%I FOR UPDATE TO authenticated
         USING (private.can_access_clinic(clinic_id) AND private.has_clinic_role(clinic_id, ARRAY[''owner'', ''admin'']::public.clinic_role[]))
         WITH CHECK (private.can_access_clinic(clinic_id))', t);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.seed_finance_defaults(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.seed_clinic_finance() FROM public, anon;
REVOKE ALL ON FUNCTION private.post_payment_entry() FROM public, anon;
REVOKE ALL ON FUNCTION private.guard_financial_entry() FROM public, anon;
REVOKE ALL ON FUNCTION private.check_entry_category() FROM public, anon;

SELECT private.seed_finance_defaults(id) FROM public.clinics;

-- ---------------------------------------------------------------------------
-- Conciliação (SECURITY INVOKER: só quem vê o financeiro concilia)
-- ---------------------------------------------------------------------------

-- Liga uma linha do extrato a um lançamento de mesmo valor e sentido; o
-- lançamento passa a pago na data do extrato, na conta do extrato.
CREATE FUNCTION public.reconcile_statement_line(p_line_id uuid, p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_line public.bank_statement_lines;
  v_entry public.financial_entries;
BEGIN
  SELECT * INTO v_line FROM public.bank_statement_lines WHERE id = p_line_id FOR UPDATE;
  SELECT * INTO v_entry FROM public.financial_entries WHERE id = p_entry_id FOR UPDATE;
  IF v_line.id IS NULL OR v_entry.id IS NULL OR v_line.clinic_id <> v_entry.clinic_id THEN
    RAISE EXCEPTION 'Linha ou lançamento não encontrado' USING ERRCODE = '23503';
  END IF;
  IF v_line.entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta linha já está conciliada.' USING ERRCODE = 'P0001';
  END IF;
  IF abs(v_line.amount) <> v_entry.amount OR (v_line.amount > 0) <> (v_entry.kind = 'income') THEN
    RAISE EXCEPTION 'Valor ou sentido diferente do lançamento.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.enter_rpc();
  UPDATE public.financial_entries
  SET paid_on = coalesce(paid_on, v_line.posted_on), account_id = v_line.account_id
  WHERE id = p_entry_id;
  UPDATE public.bank_statement_lines SET entry_id = p_entry_id WHERE id = p_line_id;
END;
$$;

-- Cria um lançamento já pago a partir da linha (ex.: tarifa bancária) e concilia.
CREATE FUNCTION public.create_entry_from_statement_line(p_line_id uuid, p_category_id uuid, p_description text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_line public.bank_statement_lines;
  v_id uuid;
BEGIN
  SELECT * INTO v_line FROM public.bank_statement_lines WHERE id = p_line_id;
  IF v_line.id IS NULL THEN
    RAISE EXCEPTION 'Linha não encontrada' USING ERRCODE = '23503';
  END IF;
  INSERT INTO public.financial_entries (clinic_id, kind, description, amount, due_on, paid_on, category_id, account_id)
  VALUES (v_line.clinic_id, CASE WHEN v_line.amount > 0 THEN 'income' ELSE 'expense' END,
          coalesce(nullif(btrim(p_description), ''), nullif(v_line.description, ''), 'Lançamento do extrato'),
          abs(v_line.amount), v_line.posted_on, v_line.posted_on, p_category_id, v_line.account_id)
  RETURNING id INTO v_id;
  PERFORM public.reconcile_statement_line(p_line_id, v_id);
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_statement_line(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.create_entry_from_statement_line(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_statement_line(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_entry_from_statement_line(uuid, uuid, text) TO authenticated;
