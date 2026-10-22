/*
  # Escopo pela clínica ativa

  Um usuário pode ser membro de mais de uma clínica. O front-end envia a clínica
  selecionada no header `x-clinic-id`; as políticas passam a restringir as
  linhas a essa clínica, e o trigger de INSERT a usa para preencher `clinic_id`.

  O header só ESTREITA o acesso: as políticas continuam exigindo que o usuário
  seja membro da clínica da linha. Um header com a clínica de outro tenant não
  dá acesso a nada. Sem header (scripts, testes), vale apenas a membership.
*/

-- Clínica enviada no header, ou NULL se ausente/inválida.
CREATE FUNCTION private.requested_clinic_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v text := nullif(current_setting('request.headers', true), '')::json ->> 'x-clinic-id';
BEGIN
  IF v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN v::uuid;
  END IF;
  RETURN NULL;
END;
$$;

-- Membro da clínica da linha E (sem header OU header = clínica da linha).
CREATE FUNCTION private.can_access_clinic(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT private.is_clinic_member(p_clinic_id)
     AND coalesce(private.requested_clinic_id() = p_clinic_id, true);
$$;

CREATE OR REPLACE FUNCTION private.set_clinic_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := private.requested_clinic_id();
  END IF;

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

REVOKE ALL ON FUNCTION private.requested_clinic_id() FROM public, anon;
REVOKE ALL ON FUNCTION private.can_access_clinic(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.requested_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_clinic(uuid) TO authenticated;

DO $$
DECLARE
  t text;
  v_delete_roles text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'animals', 'medical_records', 'appointments', 'animal_vaccinations'] LOOP
    EXECUTE format('DROP POLICY "tenant_select" ON public.%I', t);
    EXECUTE format('DROP POLICY "tenant_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY "tenant_update" ON public.%I', t);
    EXECUTE format('DROP POLICY "tenant_delete" ON public.%I', t);

    EXECUTE format(
      'CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated
         USING (private.can_access_clinic(clinic_id))', t);
    EXECUTE format(
      'CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated
         WITH CHECK (private.can_access_clinic(clinic_id))', t);
    EXECUTE format(
      'CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated
         USING (private.can_access_clinic(clinic_id))
         WITH CHECK (private.can_access_clinic(clinic_id))', t);

    -- Agendamentos: toda a equipe; histórico clínico: owner/admin/veterinário.
    v_delete_roles := CASE WHEN t = 'appointments'
      THEN 'owner,admin,veterinarian,staff'
      ELSE 'owner,admin,veterinarian' END;
    EXECUTE format(
      'CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated
         USING (private.can_access_clinic(clinic_id)
                AND private.has_clinic_role(clinic_id, string_to_array(%L, '','')::public.clinic_role[]))',
      t, v_delete_roles);
  END LOOP;
END;
$$;
