/*
  # Produtos e serviços, estoque, caixa, vendas (PDV) e conta corrente do cliente

  ## Catálogo (`catalog_items`)
  Produtos (com ou sem controle de estoque) e serviços, com preço, custo,
  código de barras e estoque mínimo. `stock_qty` é mantido só pelo servidor, a
  partir de `stock_movements` (entradas, perdas, ajustes, vendas).

  ## Caixa (`cash_sessions`, `cash_adjustments`)
  Um caixa aberto por clínica. Vendas e recebimentos exigem caixa aberto, como
  no SimplesVet. O fechamento calcula o valor esperado em dinheiro (abertura +
  dinheiro recebido + suprimentos − sangrias − estornos em dinheiro) e guarda a
  diferença contada.

  ## Vendas (`sales`, `sale_items`)
  Orçamento (`quote`) → venda em aberto (`open`) → finalizada (`completed`) ou
  cancelada. Itens só mudam enquanto a venda não está finalizada. Totais são
  recalculados pelo servidor. O desconto total respeita o limite da clínica
  (`clinics.max_discount_pct`), exceto para proprietário/administrador.

  ## Pagamentos e conta corrente (`payments`, `client_account_entries`)
  Gravados apenas pelas RPCs (`finalize_sale`, `cancel_sale`,
  `receive_client_payment`). Na conta corrente, valor positivo é crédito do
  cliente e negativo é débito: venda "a prazo" gera débito; recebimento ou
  adiantamento gera crédito; pagar com crédito consome o saldo.
*/

-- ---------------------------------------------------------------------------
-- Infra comum: marca de "dentro de RPC" e setup padrão de tabelas por clínica
-- ---------------------------------------------------------------------------

-- Campos mantidos pelo servidor só mudam quando uma RPC liga esta marca
-- (válida só na transação corrente).
CREATE FUNCTION private.in_rpc()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(current_setting('vetclinic.rpc', true), '') = 'on';
$$;

CREATE FUNCTION private.enter_rpc()
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  SELECT set_config('vetclinic.rpc', 'on', true);
$$;

-- Triggers e políticas padrão: clinic_id automático e imutável, updated_at,
-- acesso só à clínica ativa. `p_write` = false deixa a tabela somente leitura
-- para o usuário (escritas só pelas RPCs SECURITY DEFINER).
CREATE FUNCTION private.setup_tenant_table(p_table text, p_delete_roles text[], p_write boolean DEFAULT true, p_touch boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  EXECUTE format('CREATE TRIGGER set_clinic_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.set_clinic_id()', p_table);
  EXECUTE format('CREATE TRIGGER prevent_clinic_change BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.prevent_clinic_change()', p_table);
  IF p_touch THEN
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()', p_table);
  END IF;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', p_table);
  EXECUTE format('CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated USING (private.can_access_clinic(clinic_id))', p_table);

  IF NOT p_write THEN
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', p_table);
    RETURN;
  END IF;

  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', p_table);
  EXECUTE format('CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (private.can_access_clinic(clinic_id))', p_table);
  EXECUTE format('CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated USING (private.can_access_clinic(clinic_id)) WITH CHECK (private.can_access_clinic(clinic_id))', p_table);
  IF p_delete_roles IS NOT NULL THEN
    EXECUTE format(
      'CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated
         USING (private.can_access_clinic(clinic_id) AND private.has_clinic_role(clinic_id, %L::public.clinic_role[]))',
      p_table, p_delete_roles);
  END IF;
END;
$$;

-- Autor (id + e-mail) vem da sessão; edições não trocam o autor.
CREATE FUNCTION private.stamp_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := coalesce((SELECT auth.uid()), NEW.author_id);
    NEW.author_email := (SELECT u.email FROM auth.users u WHERE u.id = NEW.author_id);
  ELSE
    NEW.author_id := OLD.author_id;
    NEW.author_email := OLD.author_email;
  END IF;
  RETURN NEW;
END;
$$;

-- Exige acesso à clínica dentro de funções SECURITY DEFINER (que ignoram RLS).
CREATE FUNCTION private.require_clinic_access(p_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF p_clinic_id IS NULL OR NOT private.can_access_clinic(p_clinic_id) THEN
    RAISE EXCEPTION 'Registro não encontrado' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.in_rpc() FROM public, anon;
REVOKE ALL ON FUNCTION private.enter_rpc() FROM public, anon;
REVOKE ALL ON FUNCTION private.setup_tenant_table(text, text[], boolean, boolean) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.stamp_author() FROM public, anon;
REVOKE ALL ON FUNCTION private.require_clinic_access(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.in_rpc() TO authenticated;
-- Usada por RPCs SECURITY INVOKER (ex.: conciliação). O schema private não é exposto pela API.
GRANT EXECUTE ON FUNCTION private.enter_rpc() TO authenticated;
GRANT EXECUTE ON FUNCTION private.require_clinic_access(uuid) TO authenticated;

-- Limite de desconto para quem não é proprietário/administrador.
ALTER TABLE public.clinics
  ADD COLUMN max_discount_pct numeric(5, 2) NOT NULL DEFAULT 10 CHECK (max_discount_pct BETWEEN 0 AND 100);
GRANT UPDATE (max_discount_pct) ON public.clinics TO authenticated;

-- Chave composta para referências da mesma clínica (venda em atendimento, mensagens, NPS).
ALTER TABLE public.appointments ADD CONSTRAINT appointments_id_clinic_key UNIQUE (id, clinic_id);

-- ---------------------------------------------------------------------------
-- Catálogo e estoque
-- ---------------------------------------------------------------------------

CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'product' CHECK (kind IN ('product', 'service')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  category text CHECK (char_length(category) <= 80),
  sku text CHECK (char_length(sku) <= 60),
  barcode text CHECK (char_length(barcode) <= 60),
  unit text NOT NULL DEFAULT 'un' CHECK (char_length(unit) BETWEEN 1 AND 10),
  price numeric(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  cost numeric(12, 2) CHECK (cost >= 0),
  track_stock boolean NOT NULL DEFAULT false,
  stock_qty numeric(12, 3) NOT NULL DEFAULT 0,
  min_stock numeric(12, 3) CHECK (min_stock >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_items_id_clinic_key UNIQUE (id, clinic_id),
  CONSTRAINT catalog_items_service_no_stock CHECK (kind = 'product' OR NOT track_stock)
);

CREATE INDEX idx_catalog_items_clinic ON public.catalog_items (clinic_id, active, name);
CREATE UNIQUE INDEX catalog_items_barcode_key ON public.catalog_items (clinic_id, barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX catalog_items_sku_key ON public.catalog_items (clinic_id, sku) WHERE sku IS NOT NULL;

-- Estoque só muda por movimentação.
CREATE FUNCTION private.protect_stock_qty()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stock_qty := 0;
  ELSIF NEW.stock_qty IS DISTINCT FROM OLD.stock_qty AND coalesce(current_setting('vetclinic.stock_sync', true), '') <> 'on' THEN
    NEW.stock_qty := OLD.stock_qty;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_stock_qty BEFORE INSERT OR UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION private.protect_stock_qty();

-- ---------------------------------------------------------------------------
-- Caixa
-- ---------------------------------------------------------------------------

CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_by_email text,
  expected_amount numeric(12, 2),
  closing_amount numeric(12, 2) CHECK (closing_amount >= 0),
  closed_at timestamptz,
  closed_by_email text,
  notes text CHECK (char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_sessions_id_clinic_key UNIQUE (id, clinic_id),
  CONSTRAINT cash_sessions_closed_fields CHECK ((status = 'closed') = (closed_at IS NOT NULL))
);

CREATE UNIQUE INDEX cash_sessions_one_open ON public.cash_sessions (clinic_id) WHERE status = 'open';
CREATE INDEX idx_cash_sessions_clinic ON public.cash_sessions (clinic_id, opened_at DESC);

CREATE TABLE public.cash_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('deposit', 'withdrawal')),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 300),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_adjustments_session_same_clinic_fkey
    FOREIGN KEY (session_id, clinic_id) REFERENCES public.cash_sessions(id, clinic_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------------

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  number bigint GENERATED ALWAYS AS IDENTITY,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('quote', 'open', 'completed', 'cancelled')),
  client_id uuid,
  animal_id uuid,
  appointment_id uuid,
  subtotal numeric(12, 2) NOT NULL DEFAULT 0,
  discount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric(12, 2) NOT NULL DEFAULT 0,
  valid_until date,
  notes text CHECK (char_length(notes) <= 2000),
  cash_session_id uuid,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text CHECK (char_length(cancel_reason) <= 500),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_id_clinic_key UNIQUE (id, clinic_id),
  CONSTRAINT sales_client_same_clinic_fkey
    FOREIGN KEY (client_id, clinic_id) REFERENCES public.clients(id, clinic_id) ON DELETE SET NULL (client_id),
  CONSTRAINT sales_animal_same_clinic_fkey
    FOREIGN KEY (animal_id, clinic_id) REFERENCES public.animals(id, clinic_id) ON DELETE SET NULL (animal_id),
  CONSTRAINT sales_appointment_same_clinic_fkey
    FOREIGN KEY (appointment_id, clinic_id) REFERENCES public.appointments(id, clinic_id) ON DELETE SET NULL (appointment_id),
  CONSTRAINT sales_session_same_clinic_fkey
    FOREIGN KEY (cash_session_id, clinic_id) REFERENCES public.cash_sessions(id, clinic_id) ON DELETE SET NULL (cash_session_id)
);

CREATE INDEX idx_sales_clinic ON public.sales (clinic_id, created_at DESC);
CREATE INDEX idx_sales_client ON public.sales (client_id);
CREATE INDEX idx_sales_animal ON public.sales (animal_id);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL,
  item_id uuid,
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 200),
  quantity numeric(12, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  discount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric(12, 2) GENERATED ALWAYS AS (round(quantity * unit_price - discount, 2)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_items_discount_le_gross CHECK (discount <= round(quantity * unit_price, 2)),
  CONSTRAINT sale_items_sale_same_clinic_fkey
    FOREIGN KEY (sale_id, clinic_id) REFERENCES public.sales(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT sale_items_item_same_clinic_fkey
    FOREIGN KEY (item_id, clinic_id) REFERENCES public.catalog_items(id, clinic_id) ON DELETE SET NULL (item_id)
);

CREATE INDEX idx_sale_items_sale ON public.sale_items (sale_id);

-- Movimentações de estoque (depois de sales para a FK de venda).
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase', 'adjustment', 'loss', 'return', 'sale', 'sale_cancel')),
  quantity numeric(12, 3) NOT NULL CHECK (quantity <> 0),
  unit_cost numeric(12, 2) CHECK (unit_cost >= 0),
  batch text CHECK (char_length(batch) <= 60),
  expires_on date,
  supplier text CHECK (char_length(supplier) <= 160),
  document text CHECK (char_length(document) <= 80),
  sale_id uuid,
  notes text CHECK (char_length(notes) <= 500),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_sign CHECK (
    (movement_type IN ('purchase', 'return', 'sale_cancel') AND quantity > 0)
    OR (movement_type IN ('loss', 'sale') AND quantity < 0)
    OR movement_type = 'adjustment'
  ),
  CONSTRAINT stock_movements_item_same_clinic_fkey
    FOREIGN KEY (item_id, clinic_id) REFERENCES public.catalog_items(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT stock_movements_sale_same_clinic_fkey
    FOREIGN KEY (sale_id, clinic_id) REFERENCES public.sales(id, clinic_id) ON DELETE SET NULL (sale_id)
);

CREATE INDEX idx_stock_movements_item ON public.stock_movements (item_id, occurred_at DESC);
CREATE INDEX idx_stock_movements_expiry ON public.stock_movements (clinic_id, expires_on) WHERE expires_on IS NOT NULL;

CREATE FUNCTION private.check_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.movement_type IN ('sale', 'sale_cancel') AND NOT private.in_rpc() THEN
    RAISE EXCEPTION 'Movimentação de venda é gerada pela venda' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_items i WHERE i.id = NEW.item_id AND i.track_stock) THEN
    RAISE EXCEPTION 'Este item não controla estoque' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.sync_stock_qty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.stock_movements := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_delta numeric := CASE WHEN TG_OP = 'DELETE' THEN -OLD.quantity ELSE NEW.quantity END;
BEGIN
  PERFORM set_config('vetclinic.stock_sync', 'on', true);
  UPDATE public.catalog_items SET stock_qty = stock_qty + v_delta WHERE id = v_row.item_id;
  PERFORM set_config('vetclinic.stock_sync', 'off', true);
  RETURN NULL;
END;
$$;

CREATE TRIGGER check_stock_movement BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION private.check_stock_movement();
CREATE TRIGGER sync_stock_qty AFTER INSERT OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION private.sync_stock_qty();

-- Vendas: campos do servidor e estados finais protegidos fora das RPCs.
CREATE FUNCTION private.guard_sale()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF private.in_rpc() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('quote', 'open') THEN
      RAISE EXCEPTION 'Venda nova deve ser orçamento ou venda em aberto' USING ERRCODE = '23514';
    END IF;
    NEW.subtotal := 0;
    NEW.total := 0;
    NEW.completed_at := NULL;
    NEW.cancelled_at := NULL;
    NEW.cancel_reason := NULL;
    NEW.cash_session_id := NULL;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Venda finalizada ou cancelada não pode ser alterada' USING ERRCODE = '42501';
  END IF;
  IF NEW.status NOT IN ('quote', 'open') THEN
    RAISE EXCEPTION 'Use finalizar ou cancelar venda' USING ERRCODE = '42501';
  END IF;
  NEW.subtotal := OLD.subtotal;
  NEW.total := greatest(OLD.subtotal - NEW.discount, 0);
  NEW.completed_at := OLD.completed_at;
  NEW.cancelled_at := OLD.cancelled_at;
  NEW.cancel_reason := OLD.cancel_reason;
  NEW.cash_session_id := OLD.cash_session_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_sale BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION private.guard_sale();

-- O animal da venda precisa ser do cliente da venda.
CREATE FUNCTION private.check_sale_animal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.animal_id IS NOT NULL AND NEW.client_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.animals a WHERE a.id = NEW.animal_id AND a.client_id = NEW.client_id) THEN
    RAISE EXCEPTION 'O animal não pertence a este cliente' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_sale_animal BEFORE INSERT OR UPDATE OF client_id, animal_id ON public.sales
  FOR EACH ROW EXECUTE FUNCTION private.check_sale_animal();

-- Itens só mudam com a venda em orçamento/aberta.
CREATE FUNCTION private.guard_sale_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sale uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.sale_id ELSE NEW.sale_id END;
BEGIN
  IF NOT private.in_rpc()
     AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = v_sale AND s.status IN ('completed', 'cancelled')) THEN
    RAISE EXCEPTION 'Venda finalizada ou cancelada não pode ser alterada' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.sale_id <> OLD.sale_id THEN
    RAISE EXCEPTION 'Item não muda de venda' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE FUNCTION private.sync_sale_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sale uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.sale_id ELSE NEW.sale_id END;
  v_subtotal numeric;
  v_prev text := coalesce(current_setting('vetclinic.rpc', true), '');
BEGIN
  SELECT coalesce(sum(total), 0) INTO v_subtotal FROM public.sale_items WHERE sale_id = v_sale;
  PERFORM private.enter_rpc();
  UPDATE public.sales SET subtotal = v_subtotal, total = greatest(v_subtotal - discount, 0) WHERE id = v_sale;
  PERFORM set_config('vetclinic.rpc', v_prev, true);
  RETURN NULL;
END;
$$;

CREATE TRIGGER guard_sale_item BEFORE INSERT OR UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION private.guard_sale_item();
CREATE TRIGGER sync_sale_totals AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION private.sync_sale_totals();

-- ---------------------------------------------------------------------------
-- Pagamentos e conta corrente
-- ---------------------------------------------------------------------------

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  sale_id uuid,
  client_id uuid,
  method text NOT NULL CHECK (method IN ('cash', 'pix', 'debit_card', 'credit_card', 'bank_transfer', 'client_credit', 'on_account')),
  -- Negativo = estorno.
  amount numeric(12, 2) NOT NULL CHECK (amount <> 0),
  installments integer NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 24),
  cash_session_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  notes text CHECK (char_length(notes) <= 500),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_id_clinic_key UNIQUE (id, clinic_id),
  CONSTRAINT payments_sale_same_clinic_fkey
    FOREIGN KEY (sale_id, clinic_id) REFERENCES public.sales(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT payments_client_same_clinic_fkey
    FOREIGN KEY (client_id, clinic_id) REFERENCES public.clients(id, clinic_id) ON DELETE SET NULL (client_id),
  CONSTRAINT payments_session_same_clinic_fkey
    FOREIGN KEY (cash_session_id, clinic_id) REFERENCES public.cash_sessions(id, clinic_id) ON DELETE SET NULL (cash_session_id)
);

CREATE INDEX idx_payments_session ON public.payments (cash_session_id);
CREATE INDEX idx_payments_sale ON public.payments (sale_id);
CREATE INDEX idx_payments_clinic ON public.payments (clinic_id, received_at DESC);

CREATE TABLE public.client_account_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  -- Positivo = crédito do cliente; negativo = débito (cliente deve).
  amount numeric(12, 2) NOT NULL CHECK (amount <> 0),
  description text NOT NULL CHECK (char_length(description) <= 300),
  sale_id uuid,
  payment_id uuid,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_account_entries_client_same_clinic_fkey
    FOREIGN KEY (client_id, clinic_id) REFERENCES public.clients(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT client_account_entries_sale_same_clinic_fkey
    FOREIGN KEY (sale_id, clinic_id) REFERENCES public.sales(id, clinic_id) ON DELETE SET NULL (sale_id),
  CONSTRAINT client_account_entries_payment_same_clinic_fkey
    FOREIGN KEY (payment_id, clinic_id) REFERENCES public.payments(id, clinic_id) ON DELETE SET NULL (payment_id)
);

CREATE INDEX idx_client_account_entries_client ON public.client_account_entries (client_id, created_at DESC);

-- Saldo por cliente (RLS das tabelas de origem vale: security_invoker).
CREATE VIEW public.client_balances WITH (security_invoker = true) AS
  SELECT clinic_id, client_id, sum(amount)::numeric(12, 2) AS balance, max(created_at) AS last_entry_at
  FROM public.client_account_entries
  GROUP BY clinic_id, client_id;

-- ---------------------------------------------------------------------------
-- Triggers, privilégios e RLS
-- ---------------------------------------------------------------------------

SELECT private.setup_tenant_table('catalog_items', ARRAY['owner', 'admin']);
SELECT private.setup_tenant_table('sales', NULL);
SELECT private.setup_tenant_table('sale_items', NULL);
-- Movimentações: insere (entrada/ajuste/perda), não edita; só owner/admin desfaz.
SELECT private.setup_tenant_table('stock_movements', ARRAY['owner', 'admin'], true, false);
DROP POLICY "tenant_update" ON public.stock_movements;
REVOKE UPDATE ON public.stock_movements FROM authenticated;
-- Somente leitura para o usuário: escrita pelas RPCs.
SELECT private.setup_tenant_table('cash_sessions', NULL, false);
SELECT private.setup_tenant_table('cash_adjustments', NULL, false, false);
SELECT private.setup_tenant_table('payments', NULL, false, false);
SELECT private.setup_tenant_table('client_account_entries', NULL, false, false);
GRANT SELECT ON public.client_balances TO authenticated;

-- Itens de venda de orçamento/venda aberta podem ser removidos por qualquer membro.
CREATE POLICY "tenant_delete" ON public.sale_items FOR DELETE TO authenticated
  USING (private.can_access_clinic(clinic_id));
-- Orçamentos e vendas em aberto podem ser excluídos; finalizadas só canceladas.
CREATE POLICY "tenant_delete" ON public.sales FOR DELETE TO authenticated
  USING (private.can_access_clinic(clinic_id) AND status IN ('quote', 'open'));

CREATE TRIGGER stamp_author BEFORE INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION private.stamp_author();
CREATE TRIGGER stamp_author BEFORE INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION private.stamp_author();
CREATE TRIGGER stamp_author BEFORE INSERT ON public.cash_adjustments FOR EACH ROW EXECUTE FUNCTION private.stamp_author();
CREATE TRIGGER stamp_author BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION private.stamp_author();
CREATE TRIGGER stamp_author BEFORE INSERT ON public.client_account_entries FOR EACH ROW EXECUTE FUNCTION private.stamp_author();

REVOKE ALL ON FUNCTION private.protect_stock_qty() FROM public, anon;
REVOKE ALL ON FUNCTION private.check_stock_movement() FROM public, anon;
REVOKE ALL ON FUNCTION private.sync_stock_qty() FROM public, anon;
REVOKE ALL ON FUNCTION private.guard_sale() FROM public, anon;
REVOKE ALL ON FUNCTION private.check_sale_animal() FROM public, anon;
REVOKE ALL ON FUNCTION private.guard_sale_item() FROM public, anon;
REVOKE ALL ON FUNCTION private.sync_sale_totals() FROM public, anon;

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER com verificação explícita de acesso à clínica)
-- ---------------------------------------------------------------------------

CREATE FUNCTION private.open_session_id(p_clinic_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.cash_sessions WHERE clinic_id = p_clinic_id AND status = 'open';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Abra o caixa antes de registrar pagamentos.' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION private.open_session_id(uuid) FROM public, anon, authenticated;

-- Clínica da sessão: header x-clinic-id ou a única clínica do usuário.
CREATE FUNCTION private.current_clinic_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_id uuid := private.requested_clinic_id();
  v_count integer;
BEGIN
  IF v_id IS NULL THEN
    SELECT count(*), min(m.clinic_id::text)::uuid INTO v_count, v_id
    FROM public.clinic_members m WHERE m.user_id = (SELECT auth.uid());
    IF v_count <> 1 THEN
      v_id := NULL;
    END IF;
  END IF;
  PERFORM private.require_clinic_access(v_id);
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION private.current_clinic_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION private.current_clinic_id() TO authenticated;

CREATE FUNCTION public.open_cash_session(p_opening_amount numeric DEFAULT 0)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clinic uuid := private.current_clinic_id();
  v_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.cash_sessions WHERE clinic_id = v_clinic AND status = 'open') THEN
    RAISE EXCEPTION 'Já existe um caixa aberto.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.cash_sessions (clinic_id, opening_amount, opened_by, opened_by_email)
  VALUES (v_clinic, coalesce(p_opening_amount, 0), auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.add_cash_adjustment(p_kind text, p_amount numeric, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clinic uuid := private.current_clinic_id();
  v_id uuid;
BEGIN
  INSERT INTO public.cash_adjustments (clinic_id, session_id, kind, amount, reason)
  VALUES (v_clinic, private.open_session_id(v_clinic), p_kind, p_amount, btrim(p_reason))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Dinheiro esperado na gaveta de um caixa.
CREATE FUNCTION public.cash_session_expected(p_session_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT s.opening_amount
       + coalesce((SELECT sum(p.amount) FROM public.payments p WHERE p.cash_session_id = s.id AND p.method = 'cash'), 0)
       + coalesce((SELECT sum(CASE WHEN a.kind = 'deposit' THEN a.amount ELSE -a.amount END)
                   FROM public.cash_adjustments a WHERE a.session_id = s.id), 0)
  FROM public.cash_sessions s
  WHERE s.id = p_session_id;
$$;

CREATE FUNCTION public.close_cash_session(p_session_id uuid, p_counted numeric, p_notes text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.cash_sessions;
  v_expected numeric;
BEGIN
  SELECT * INTO v_session FROM public.cash_sessions WHERE id = p_session_id FOR UPDATE;
  PERFORM private.require_clinic_access(v_session.clinic_id);
  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Este caixa já está fechado.' USING ERRCODE = 'P0001';
  END IF;
  v_expected := public.cash_session_expected(p_session_id);
  UPDATE public.cash_sessions
  SET status = 'closed', closed_at = now(), expected_amount = v_expected, closing_amount = p_counted,
      closed_by_email = (SELECT email FROM auth.users WHERE id = auth.uid()),
      notes = nullif(btrim(p_notes), '')
  WHERE id = p_session_id;
  -- Diferença (contado − esperado).
  RETURN p_counted - v_expected;
END;
$$;

-- Finaliza a venda: valida desconto, registra pagamentos (que devem somar o
-- total), lança a conta corrente e baixa o estoque.
-- p_payments: [{"method": "pix", "amount": 50, "installments": 1}, ...]
CREATE FUNCTION public.finalize_sale(p_sale_id uuid, p_payments jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sale public.sales;
  v_session uuid;
  v_gross numeric;
  v_discount numeric;
  v_limit numeric;
  v_paid numeric := 0;
  v_balance numeric;
  v_pay jsonb;
  v_method text;
  v_amount numeric;
  v_payment uuid;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  PERFORM private.require_clinic_access(v_sale.clinic_id);
  IF v_sale.status NOT IN ('quote', 'open') THEN
    RAISE EXCEPTION 'Esta venda já foi finalizada ou cancelada.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sale_items WHERE sale_id = p_sale_id) THEN
    RAISE EXCEPTION 'Adicione ao menos um item.' USING ERRCODE = 'P0001';
  END IF;
  IF v_sale.discount > v_sale.subtotal THEN
    RAISE EXCEPTION 'O desconto é maior que o subtotal.' USING ERRCODE = 'P0001';
  END IF;

  -- Limite de desconto (itens + venda) sobre o valor bruto.
  SELECT coalesce(sum(round(quantity * unit_price, 2)), 0), coalesce(sum(discount), 0)
    INTO v_gross, v_discount
  FROM public.sale_items WHERE sale_id = p_sale_id;
  v_discount := v_discount + v_sale.discount;
  SELECT max_discount_pct INTO v_limit FROM public.clinics WHERE id = v_sale.clinic_id;
  IF v_gross > 0 AND v_discount / v_gross * 100 > v_limit + 0.001
     AND NOT private.has_clinic_role(v_sale.clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]) THEN
    RAISE EXCEPTION '%', format('Desconto acima do limite de %s%%. Peça a um administrador.', v_limit) USING ERRCODE = 'P0001';
  END IF;

  v_session := private.open_session_id(v_sale.clinic_id);
  PERFORM private.enter_rpc();

  FOR v_pay IN SELECT * FROM jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) LOOP
    v_method := v_pay ->> 'method';
    v_amount := round((v_pay ->> 'amount')::numeric, 2);
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Valor de pagamento inválido.' USING ERRCODE = 'P0001';
    END IF;
    IF v_method IN ('client_credit', 'on_account') AND v_sale.client_id IS NULL THEN
      RAISE EXCEPTION 'Selecione o cliente para usar a conta corrente.' USING ERRCODE = 'P0001';
    END IF;
    IF v_method = 'client_credit' THEN
      SELECT coalesce(sum(amount), 0) INTO v_balance FROM public.client_account_entries WHERE client_id = v_sale.client_id;
      IF v_balance < v_amount THEN
        RAISE EXCEPTION 'Crédito insuficiente na conta do cliente.' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    INSERT INTO public.payments (clinic_id, sale_id, client_id, method, amount, installments, cash_session_id)
    VALUES (v_sale.clinic_id, p_sale_id, v_sale.client_id, v_method, v_amount,
            coalesce((v_pay ->> 'installments')::integer, 1), v_session)
    RETURNING id INTO v_payment;

    IF v_method IN ('client_credit', 'on_account') THEN
      INSERT INTO public.client_account_entries (clinic_id, client_id, amount, description, sale_id, payment_id)
      VALUES (v_sale.clinic_id, v_sale.client_id, -v_amount,
              format('Venda #%s %s', v_sale.number, CASE WHEN v_method = 'on_account' THEN '(a prazo)' ELSE '(crédito usado)' END),
              p_sale_id, v_payment);
    END IF;
    v_paid := v_paid + v_amount;
  END LOOP;

  IF v_paid <> v_sale.total THEN
    RAISE EXCEPTION 'Os pagamentos (R$ %) não fecham o total (R$ %).', v_paid, v_sale.total USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.stock_movements (clinic_id, item_id, movement_type, quantity, sale_id, notes)
  SELECT v_sale.clinic_id, si.item_id, 'sale', -si.quantity, p_sale_id, format('Venda #%s', v_sale.number)
  FROM public.sale_items si JOIN public.catalog_items ci ON ci.id = si.item_id
  WHERE si.sale_id = p_sale_id AND ci.track_stock;

  UPDATE public.sales SET status = 'completed', completed_at = now(), cash_session_id = v_session WHERE id = p_sale_id;
  RETURN p_sale_id;
END;
$$;

-- Cancela: orçamento/aberta só muda o status; finalizada (owner/admin) estorna
-- pagamentos no caixa aberto, desfaz a conta corrente e devolve o estoque.
CREATE FUNCTION public.cancel_sale(p_sale_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sale public.sales;
  v_session uuid;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  PERFORM private.require_clinic_access(v_sale.clinic_id);
  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Esta venda já está cancelada.' USING ERRCODE = 'P0001';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM private.enter_rpc();

  IF v_sale.status = 'completed' THEN
    IF NOT private.has_clinic_role(v_sale.clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]) THEN
      RAISE EXCEPTION 'Só proprietário ou administrador cancela venda finalizada.' USING ERRCODE = '42501';
    END IF;
    v_session := private.open_session_id(v_sale.clinic_id);

    INSERT INTO public.payments (clinic_id, sale_id, client_id, method, amount, cash_session_id, notes)
    SELECT clinic_id, sale_id, client_id, method, -amount, v_session, 'Estorno: ' || btrim(p_reason)
    FROM public.payments WHERE sale_id = p_sale_id AND amount > 0;

    INSERT INTO public.client_account_entries (clinic_id, client_id, amount, description, sale_id)
    SELECT clinic_id, client_id, -amount, format('Estorno da venda #%s', v_sale.number), sale_id
    FROM public.client_account_entries WHERE sale_id = p_sale_id;

    INSERT INTO public.stock_movements (clinic_id, item_id, movement_type, quantity, sale_id, notes)
    SELECT clinic_id, item_id, 'sale_cancel', -quantity, sale_id, format('Cancelamento da venda #%s', v_sale.number)
    FROM public.stock_movements WHERE sale_id = p_sale_id AND movement_type = 'sale';
  END IF;

  UPDATE public.sales SET status = 'cancelled', cancelled_at = now(), cancel_reason = btrim(p_reason) WHERE id = p_sale_id;
  RETURN p_sale_id;
END;
$$;

-- Recebimento de dívida ou adiantamento: entra no caixa e vira crédito.
CREATE FUNCTION public.receive_client_payment(p_client_id uuid, p_amount numeric, p_method text, p_notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_client public.clients;
  v_session uuid;
  v_payment uuid;
  v_balance numeric;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
  PERFORM private.require_clinic_access(v_client.clinic_id);
  IF p_method NOT IN ('cash', 'pix', 'debit_card', 'credit_card', 'bank_transfer') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Informe um valor maior que zero.' USING ERRCODE = 'P0001';
  END IF;
  v_session := private.open_session_id(v_client.clinic_id);
  PERFORM private.enter_rpc();

  SELECT coalesce(sum(amount), 0) INTO v_balance FROM public.client_account_entries WHERE client_id = p_client_id;

  INSERT INTO public.payments (clinic_id, client_id, method, amount, cash_session_id, notes)
  VALUES (v_client.clinic_id, p_client_id, p_method, round(p_amount, 2), v_session, nullif(btrim(p_notes), ''))
  RETURNING id INTO v_payment;

  INSERT INTO public.client_account_entries (clinic_id, client_id, amount, description, payment_id)
  VALUES (v_client.clinic_id, p_client_id, round(p_amount, 2),
          CASE WHEN v_balance < 0 THEN 'Recebimento de débito' ELSE 'Adiantamento (crédito)' END
            || coalesce(': ' || nullif(btrim(p_notes), ''), ''),
          v_payment);
  RETURN v_payment;
END;
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.open_cash_session(numeric)',
    'public.add_cash_adjustment(text, numeric, text)',
    'public.cash_session_expected(uuid)',
    'public.close_cash_session(uuid, numeric, text)',
    'public.finalize_sale(uuid, jsonb)',
    'public.cancel_sale(uuid, text)',
    'public.receive_client_payment(uuid, numeric, text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END;
$$;
