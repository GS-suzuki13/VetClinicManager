/*
  # Multi-tenant: isolamento completo por clínica

  ## Problema corrigido
  A migração inicial criou políticas `USING (true) WITH CHECK (true)` para os
  papéis `anon` e `authenticated`. Como a anon key é pública (vai no bundle do
  front-end), qualquer pessoa podia ler, alterar e apagar todos os dados de
  todos os tutores e animais via API REST, sem login.

  ## Modelo
  - `clinics`: o tenant.
  - `clinic_members`: vínculo usuário (Supabase Auth) <-> clínica, com papel.
  - Toda tabela de negócio recebe `clinic_id NOT NULL`.
  - RLS: um usuário autenticado só enxerga/altera linhas de clínicas das quais
    é membro. `anon` não tem nenhum privilégio nas tabelas.

  ## Integridade entre tenants
  Chaves estrangeiras compostas `(…_id, clinic_id)` garantem no próprio banco
  que um animal só referencia um tutor da mesma clínica, que um prontuário,
  vacina ou agendamento só referencia um animal da mesma clínica, e que o
  animal de um agendamento pertence ao tutor do agendamento. Isso impede
  "vazamento por referência" (ex.: criar prontuário apontando para animal de
  outra clínica), já que checagens de FK ignoram RLS.

  ## Dados legados
  Se já houver dados, eles são movidos para uma clínica "Clínica principal
  (dados existentes)". Nenhum usuário é membro dela até que o responsável
  execute (no SQL Editor, como admin):

    insert into public.clinic_members (clinic_id, user_id, role)
    select c.id, u.id, 'owner'
    from public.clinics c, auth.users u
    where c.name = 'Clínica principal (dados existentes)'
      and u.email = 'SEU-EMAIL@exemplo.com';
*/

-- ---------------------------------------------------------------------------
-- 1. Tenants e membros
-- ---------------------------------------------------------------------------

CREATE TYPE public.clinic_role AS ENUM ('owner', 'admin', 'veterinarian', 'staff');

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clinic_members (
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.clinic_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, user_id)
);

CREATE INDEX idx_clinic_members_user_id ON public.clinic_members(user_id);

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Funções auxiliares (schema `private` não é exposto pela API REST)
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

-- SECURITY DEFINER para consultar clinic_members sem recursão de RLS.
CREATE FUNCTION private.is_clinic_member(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_members m
    WHERE m.clinic_id = p_clinic_id
      AND m.user_id = (SELECT auth.uid())
  );
$$;

CREATE FUNCTION private.has_clinic_role(p_clinic_id uuid, p_roles public.clinic_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_members m
    WHERE m.clinic_id = p_clinic_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = ANY (p_roles)
  );
$$;

-- Preenche clinic_id quando o cliente não envia e o usuário tem uma única clínica.
CREATE FUNCTION private.set_clinic_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NEW.clinic_id IS NULL THEN
    SELECT count(*), min(m.clinic_id::text)::uuid
      INTO v_count, NEW.clinic_id
    FROM public.clinic_members m
    WHERE m.user_id = (SELECT auth.uid());

    IF v_count <> 1 THEN
      RAISE EXCEPTION 'clinic_id é obrigatório'
        USING ERRCODE = '23502';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Uma linha nunca muda de clínica.
CREATE FUNCTION private.prevent_clinic_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id THEN
    RAISE EXCEPTION 'clinic_id não pode ser alterado'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM public, anon;
GRANT EXECUTE ON FUNCTION private.is_clinic_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_clinic_role(uuid, public.clinic_role[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Coluna clinic_id + migração de dados legados
-- ---------------------------------------------------------------------------

ALTER TABLE public.clients ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;
ALTER TABLE public.animals ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;
ALTER TABLE public.medical_records ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;
ALTER TABLE public.animal_vaccinations ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;

DO $$
DECLARE
  v_clinic uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.clients)
     OR EXISTS (SELECT 1 FROM public.animals)
     OR EXISTS (SELECT 1 FROM public.medical_records)
     OR EXISTS (SELECT 1 FROM public.appointments)
     OR EXISTS (SELECT 1 FROM public.animal_vaccinations) THEN
    INSERT INTO public.clinics (name)
    VALUES ('Clínica principal (dados existentes)')
    RETURNING id INTO v_clinic;

    UPDATE public.clients SET clinic_id = v_clinic;
    UPDATE public.animals SET clinic_id = v_clinic;
    UPDATE public.medical_records SET clinic_id = v_clinic;
    UPDATE public.appointments SET clinic_id = v_clinic;
    UPDATE public.animal_vaccinations SET clinic_id = v_clinic;
  END IF;
END;
$$;

ALTER TABLE public.clients ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.animals ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.medical_records ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.animal_vaccinations ALTER COLUMN clinic_id SET NOT NULL;

CREATE INDEX idx_clients_clinic_id ON public.clients(clinic_id);
CREATE INDEX idx_animals_clinic_id ON public.animals(clinic_id);
CREATE INDEX idx_medical_records_clinic_id ON public.medical_records(clinic_id);
CREATE INDEX idx_appointments_clinic_date ON public.appointments(clinic_id, appointment_date);
CREATE INDEX idx_animal_vaccinations_clinic_id ON public.animal_vaccinations(clinic_id);

-- ---------------------------------------------------------------------------
-- 4. Integridade referencial dentro do tenant
-- ---------------------------------------------------------------------------

-- CPF único por clínica (o UNIQUE global vazava a existência do CPF em outra clínica).
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_cpf_key;
ALTER TABLE public.clients ADD CONSTRAINT clients_clinic_cpf_key UNIQUE (clinic_id, cpf);

ALTER TABLE public.clients ADD CONSTRAINT clients_id_clinic_key UNIQUE (id, clinic_id);
ALTER TABLE public.animals ADD CONSTRAINT animals_id_clinic_key UNIQUE (id, clinic_id);
ALTER TABLE public.animals ADD CONSTRAINT animals_id_client_clinic_key UNIQUE (id, client_id, clinic_id);

-- Remove FKs de coluna única para as tabelas pai; as compostas as substituem
-- (manter as duas também deixaria os embeds do PostgREST ambíguos).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conrelid::regclass AS tbl, con.conname
    FROM pg_constraint con
    WHERE con.contype = 'f'
      AND con.conrelid IN (
        'public.animals'::regclass,
        'public.medical_records'::regclass,
        'public.appointments'::regclass,
        'public.animal_vaccinations'::regclass
      )
      AND con.confrelid IN ('public.clients'::regclass, 'public.animals'::regclass)
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.animals
  ADD CONSTRAINT animals_client_same_clinic_fkey
  FOREIGN KEY (client_id, clinic_id) REFERENCES public.clients(id, clinic_id) ON DELETE CASCADE;

ALTER TABLE public.medical_records
  ADD CONSTRAINT medical_records_animal_same_clinic_fkey
  FOREIGN KEY (animal_id, clinic_id) REFERENCES public.animals(id, clinic_id) ON DELETE CASCADE;

ALTER TABLE public.animal_vaccinations
  ADD CONSTRAINT animal_vaccinations_animal_same_clinic_fkey
  FOREIGN KEY (animal_id, clinic_id) REFERENCES public.animals(id, clinic_id) ON DELETE CASCADE;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_client_same_clinic_fkey
  FOREIGN KEY (client_id, clinic_id) REFERENCES public.clients(id, clinic_id) ON DELETE CASCADE;

-- O animal do agendamento precisa ser do tutor do agendamento. NOT VALID para
-- não bloquear a migração caso existam agendamentos legados inconsistentes;
-- linhas novas e alteradas são sempre verificadas.
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_animal_same_client_fkey
  FOREIGN KEY (animal_id, client_id, clinic_id)
  REFERENCES public.animals(id, client_id, clinic_id) ON DELETE CASCADE
  NOT VALID;

DO $$
BEGIN
  ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_animal_same_client_fkey;
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'Há agendamentos legados cujo animal não pertence ao tutor; revise-os e valide a constraint depois.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'animals', 'medical_records', 'appointments', 'animal_vaccinations'] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_clinic_id BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION private.set_clinic_id()', t);
    EXECUTE format(
      'CREATE TRIGGER prevent_clinic_change BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION private.prevent_clinic_change()', t);
    EXECUTE format(
      'CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()', t);
  END LOOP;
END;
$$;

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Privilégios e políticas RLS
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow all operations on clients" ON public.clients;
DROP POLICY IF EXISTS "Allow all operations on animals" ON public.animals;
DROP POLICY IF EXISTS "Allow all operations on medical_records" ON public.medical_records;
DROP POLICY IF EXISTS "Allow all operations on appointments" ON public.appointments;

-- Remove qualquer outra política pré-existente em vacinas (tabela criada fora do repo).
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'animal_vaccinations' LOOP
    EXECUTE format('DROP POLICY %I ON public.animal_vaccinations', p.policyname);
  END LOOP;
END;
$$;

-- Visitantes não autenticados não têm acesso a nada.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, public;

-- Tenants: leitura para membros, renomear só owner/admin; criação via RPC.
REVOKE ALL ON public.clinics, public.clinic_members FROM authenticated;
GRANT SELECT ON public.clinics TO authenticated;
GRANT UPDATE (name) ON public.clinics TO authenticated;
GRANT SELECT ON public.clinic_members TO authenticated;

CREATE POLICY "Membros veem sua clínica"
  ON public.clinics FOR SELECT TO authenticated
  USING (private.is_clinic_member(id));

CREATE POLICY "Owner/admin renomeiam a clínica"
  ON public.clinics FOR UPDATE TO authenticated
  USING (private.has_clinic_role(id, ARRAY['owner', 'admin']::public.clinic_role[]))
  WITH CHECK (private.has_clinic_role(id, ARRAY['owner', 'admin']::public.clinic_role[]));

CREATE POLICY "Membros veem a equipe da clínica"
  ON public.clinic_members FOR SELECT TO authenticated
  USING (private.is_clinic_member(clinic_id));

-- Tabelas de negócio: CRUD restrito aos membros da clínica dona da linha.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'animals', 'medical_records', 'appointments', 'animal_vaccinations'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);

    EXECUTE format(
      'CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated
         USING (private.is_clinic_member(clinic_id))', t);
    EXECUTE format(
      'CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated
         WITH CHECK (private.is_clinic_member(clinic_id))', t);
    EXECUTE format(
      'CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated
         USING (private.is_clinic_member(clinic_id))
         WITH CHECK (private.is_clinic_member(clinic_id))', t);
    EXECUTE format(
      'CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated
         USING (private.is_clinic_member(clinic_id))', t);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC: criar clínica (o usuário vira owner)
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.create_clinic(p_name text)
RETURNS public.clinics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_clinic public.clinics;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '42501';
  END IF;

  -- Limite simples contra abuso.
  IF (SELECT count(*) FROM public.clinic_members WHERE user_id = v_uid AND role = 'owner') >= 5 THEN
    RAISE EXCEPTION 'Limite de clínicas atingido' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.clinics (name) VALUES (btrim(p_name)) RETURNING * INTO v_clinic;
  INSERT INTO public.clinic_members (clinic_id, user_id, role) VALUES (v_clinic.id, v_uid, 'owner');

  RETURN v_clinic;
END;
$$;

REVOKE ALL ON FUNCTION public.create_clinic(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_clinic(text) TO authenticated;
