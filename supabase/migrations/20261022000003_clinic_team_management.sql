/*
  # Gestão de equipe da clínica

  `clinic_members` não aceita INSERT/UPDATE/DELETE direto pela API: toda
  alteração passa por funções que validam o papel de quem chama.

  - `list_clinic_members`: membros com e-mail (auth.users não é exposto).
  - `add_clinic_member`: owner/admin adicionam um usuário já cadastrado.
    Só owner concede o papel owner.
  - `remove_clinic_member`: owner/admin removem membros; qualquer membro pode
    sair. A clínica nunca fica sem owner.

  Também restringe a exclusão de tutores, animais, prontuários e vacinas a
  owner, admin e veterinário (histórico clínico não deve ser apagado pela
  recepção). Agendamentos continuam editáveis/excluíveis por toda a equipe.
*/

-- ---------------------------------------------------------------------------
-- 1. Listar equipe
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.list_clinic_members(p_clinic_id uuid)
RETURNS TABLE (user_id uuid, email text, role public.clinic_role, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_clinic_member(p_clinic_id) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT m.user_id, u.email::text, m.role, m.created_at
    FROM public.clinic_members m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.clinic_id = p_clinic_id
    ORDER BY m.created_at;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Adicionar membro
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.add_clinic_member(p_clinic_id uuid, p_email text, p_role public.clinic_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid;
  v_current_role public.clinic_role;
BEGIN
  IF NOT private.has_clinic_role(p_clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  IF p_role = 'owner' AND NOT private.has_clinic_role(p_clinic_id, ARRAY['owner']::public.clinic_role[]) THEN
    RAISE EXCEPTION 'Apenas o proprietário pode conceder o papel de proprietário' USING ERRCODE = '42501';
  END IF;

  SELECT u.id INTO v_user
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email));

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário cadastrado com este e-mail' USING ERRCODE = 'P0002';
  END IF;

  -- Alterar o papel de um owner existente (rebaixar) segue as mesmas regras da remoção.
  SELECT m.role INTO v_current_role
  FROM public.clinic_members m
  WHERE m.clinic_id = p_clinic_id AND m.user_id = v_user;

  IF v_current_role = 'owner' AND p_role <> 'owner' THEN
    IF NOT private.has_clinic_role(p_clinic_id, ARRAY['owner']::public.clinic_role[]) THEN
      RAISE EXCEPTION 'Apenas o proprietário pode alterar o papel de outro proprietário' USING ERRCODE = '42501';
    END IF;
    IF (SELECT count(*) FROM public.clinic_members m
        WHERE m.clinic_id = p_clinic_id AND m.role = 'owner') = 1 THEN
      RAISE EXCEPTION 'A clínica precisa de pelo menos um proprietário' USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (p_clinic_id, v_user, p_role)
  ON CONFLICT (clinic_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Remover membro / sair da clínica
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.remove_clinic_member(p_clinic_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_target_role public.clinic_role;
BEGIN
  SELECT m.role INTO v_target_role
  FROM public.clinic_members m
  WHERE m.clinic_id = p_clinic_id AND m.user_id = p_user_id;

  IF v_target_role IS NULL OR NOT private.is_clinic_member(p_clinic_id) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  IF p_user_id <> v_uid THEN
    IF NOT private.has_clinic_role(p_clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]) THEN
      RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
    END IF;
    IF v_target_role = 'owner' AND NOT private.has_clinic_role(p_clinic_id, ARRAY['owner']::public.clinic_role[]) THEN
      RAISE EXCEPTION 'Apenas o proprietário pode remover outro proprietário' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_target_role = 'owner' AND (
    SELECT count(*) FROM public.clinic_members m
    WHERE m.clinic_id = p_clinic_id AND m.role = 'owner'
  ) = 1 THEN
    RAISE EXCEPTION 'A clínica precisa de pelo menos um proprietário' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.clinic_members m
  WHERE m.clinic_id = p_clinic_id AND m.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_clinic_members(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.add_clinic_member(uuid, text, public.clinic_role) FROM public, anon;
REVOKE ALL ON FUNCTION public.remove_clinic_member(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_clinic_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_clinic_member(uuid, text, public.clinic_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_clinic_member(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Exclusão de histórico clínico restrita a papéis clínicos
-- ---------------------------------------------------------------------------

-- Tutores e animais entram na lista porque a exclusão deles apaga prontuários
-- e vacinas em cascata (ON DELETE CASCADE não passa por RLS).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'animals', 'medical_records', 'animal_vaccinations'] LOOP
    EXECUTE format('DROP POLICY "tenant_delete" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated
         USING (private.has_clinic_role(clinic_id, ARRAY[''owner'', ''admin'', ''veterinarian'']::public.clinic_role[]))', t);
  END LOOP;
END;
$$;
