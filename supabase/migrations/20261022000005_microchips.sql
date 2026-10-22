/*
  # Microchips de identificação animal

  ## Contexto
  O microchip é um transponder RFID passivo (sem bateria, sem GPS) que guarda
  apenas um número. Todo o resto (tutor, contato, histórico) vive em bancos de
  dados; por isso o valor do sistema está em registrar e consultar bem esse
  número.

  Formatos aceitos (somente o número, sem espaços):
  - ISO 11784/11785 (FDX-B/HDX, 134,2 kHz): 15 dígitos. Os 3 primeiros são o
    código do fabricante (900–998) ou do país (ISO 3166, ex.: 076 = Brasil).
  - FDX-A (125 kHz, legado): 10 caracteres hexadecimais.
  - AVID legado: 9 dígitos.

  ## Modelo
  - `microchips`: um chip registrado por clínica (o mesmo número pode estar em
    mais de uma clínica sem que uma saiba da outra). Pode estar sem animal
    (chip lido em animal ainda não cadastrado).
  - `microchip_events`: histórico imutável. Eventos automáticos (cadastro,
    vínculo, troca de status, registro externo, alteração de código) são
    gravados por trigger; usuários só inserem leituras e anotações.
  - `lookup_microchip`: busca entre clínicas para animais encontrados. Só
    revela o NOME da clínica, e apenas de chips com `public_lookup = true`
    (opt-in por chip). Nenhum dado de tutor ou animal sai da clínica.
*/

-- ---------------------------------------------------------------------------
-- 1. Microchips
-- ---------------------------------------------------------------------------

CREATE TABLE public.microchips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  animal_id uuid,
  code text NOT NULL CHECK (code ~ '^([0-9]{15}|[0-9A-F]{10}|[0-9]{9})$'),
  manufacturer text CHECK (char_length(manufacturer) <= 120),
  implanted_at date,
  implant_site text CHECK (char_length(implant_site) <= 200),
  implanted_by text CHECK (char_length(implanted_by) <= 120),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed', 'defective')),
  external_registry text CHECK (char_length(external_registry) <= 120),
  external_registry_id text CHECK (char_length(external_registry_id) <= 120),
  public_lookup boolean NOT NULL DEFAULT false,
  notes text CHECK (char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT microchips_clinic_code_key UNIQUE (clinic_id, code),
  CONSTRAINT microchips_id_clinic_key UNIQUE (id, clinic_id),
  -- Animal da mesma clínica; se o animal for excluído, o chip fica sem vínculo.
  CONSTRAINT microchips_animal_same_clinic_fkey
    FOREIGN KEY (animal_id, clinic_id) REFERENCES public.animals(id, clinic_id)
    ON DELETE SET NULL (animal_id)
);

-- Um animal tem no máximo um chip ativo. Inclui clinic_id para a checagem nunca
-- acusar conflito com animal de outra clínica (o que revelaria que ele tem chip).
CREATE UNIQUE INDEX microchips_one_active_per_animal
  ON public.microchips (clinic_id, animal_id) WHERE status = 'active' AND animal_id IS NOT NULL;
CREATE INDEX idx_microchips_clinic_id ON public.microchips (clinic_id);
CREATE INDEX idx_microchips_animal_id ON public.microchips (animal_id);
-- Busca entre clínicas por código.
CREATE INDEX idx_microchips_code_public ON public.microchips (code) WHERE public_lookup;

-- ---------------------------------------------------------------------------
-- 2. Histórico
-- ---------------------------------------------------------------------------

CREATE TABLE public.microchip_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  microchip_id uuid NOT NULL,
  -- Cópia sem FK: o histórico sobrevive à exclusão do animal.
  animal_id uuid,
  event_type text NOT NULL CHECK (event_type IN (
    'registered', 'linked', 'unlinked', 'status_changed', 'external_registry', 'code_changed', 'scanned', 'note'
  )),
  old_value text,
  new_value text,
  details text CHECK (char_length(details) <= 2000),
  performed_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT microchip_events_chip_same_clinic_fkey
    FOREIGN KEY (microchip_id, clinic_id) REFERENCES public.microchips(id, clinic_id) ON DELETE CASCADE
);

CREATE INDEX idx_microchip_events_chip ON public.microchip_events (microchip_id, created_at DESC);
CREATE INDEX idx_microchip_events_clinic ON public.microchip_events (clinic_id);

-- ---------------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------------

-- Normaliza o código (sem espaços, pontos, traços; maiúsculas) antes das checagens.
CREATE FUNCTION private.normalize_microchip_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.code := upper(regexp_replace(NEW.code, '[^0-9A-Za-z]', '', 'g'));
  RETURN NEW;
END;
$$;

-- Grava eventos automáticos. SECURITY DEFINER: usuários não inserem esses tipos diretamente.
CREATE FUNCTION private.log_microchip_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_email text := (SELECT u.email FROM auth.users u WHERE u.id = v_uid);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.microchip_events (clinic_id, microchip_id, animal_id, event_type, new_value, performed_by, performed_by_email)
    VALUES (NEW.clinic_id, NEW.id, NEW.animal_id, 'registered', NEW.code, v_uid, v_email);
    RETURN NEW;
  END IF;

  IF NEW.code IS DISTINCT FROM OLD.code THEN
    INSERT INTO public.microchip_events (clinic_id, microchip_id, animal_id, event_type, old_value, new_value, performed_by, performed_by_email)
    VALUES (NEW.clinic_id, NEW.id, NEW.animal_id, 'code_changed', OLD.code, NEW.code, v_uid, v_email);
  END IF;

  IF NEW.animal_id IS DISTINCT FROM OLD.animal_id THEN
    IF OLD.animal_id IS NOT NULL THEN
      INSERT INTO public.microchip_events (clinic_id, microchip_id, animal_id, event_type, old_value, performed_by, performed_by_email)
      VALUES (NEW.clinic_id, NEW.id, OLD.animal_id, 'unlinked', OLD.animal_id::text, v_uid, v_email);
    END IF;
    IF NEW.animal_id IS NOT NULL THEN
      INSERT INTO public.microchip_events (clinic_id, microchip_id, animal_id, event_type, new_value, performed_by, performed_by_email)
      VALUES (NEW.clinic_id, NEW.id, NEW.animal_id, 'linked', NEW.animal_id::text, v_uid, v_email);
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.microchip_events (clinic_id, microchip_id, animal_id, event_type, old_value, new_value, performed_by, performed_by_email)
    VALUES (NEW.clinic_id, NEW.id, NEW.animal_id, 'status_changed', OLD.status, NEW.status, v_uid, v_email);
  END IF;

  IF (NEW.external_registry, NEW.external_registry_id) IS DISTINCT FROM (OLD.external_registry, OLD.external_registry_id) THEN
    INSERT INTO public.microchip_events (clinic_id, microchip_id, animal_id, event_type, old_value, new_value, performed_by, performed_by_email)
    VALUES (
      NEW.clinic_id, NEW.id, NEW.animal_id, 'external_registry',
      nullif(concat_ws(' ', OLD.external_registry, OLD.external_registry_id), ''),
      nullif(concat_ws(' ', NEW.external_registry, NEW.external_registry_id), ''),
      v_uid, v_email
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Leituras/anotações manuais: autor e e-mail vêm da sessão, nunca do cliente.
CREATE FUNCTION private.stamp_microchip_event_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    NEW.performed_by := (SELECT auth.uid());
    NEW.performed_by_email := (SELECT u.email FROM auth.users u WHERE u.id = NEW.performed_by);
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_code BEFORE INSERT OR UPDATE OF code ON public.microchips
  FOR EACH ROW EXECUTE FUNCTION private.normalize_microchip_code();
CREATE TRIGGER set_clinic_id BEFORE INSERT ON public.microchips
  FOR EACH ROW EXECUTE FUNCTION private.set_clinic_id();
CREATE TRIGGER prevent_clinic_change BEFORE UPDATE ON public.microchips
  FOR EACH ROW EXECUTE FUNCTION private.prevent_clinic_change();
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.microchips
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER log_event AFTER INSERT OR UPDATE ON public.microchips
  FOR EACH ROW EXECUTE FUNCTION private.log_microchip_event();

CREATE TRIGGER set_clinic_id BEFORE INSERT ON public.microchip_events
  FOR EACH ROW EXECUTE FUNCTION private.set_clinic_id();
CREATE TRIGGER stamp_author BEFORE INSERT ON public.microchip_events
  FOR EACH ROW EXECUTE FUNCTION private.stamp_microchip_event_author();

REVOKE ALL ON FUNCTION private.normalize_microchip_code() FROM public, anon;
REVOKE ALL ON FUNCTION private.log_microchip_event() FROM public, anon;
REVOKE ALL ON FUNCTION private.stamp_microchip_event_author() FROM public, anon;

-- ---------------------------------------------------------------------------
-- 4. Privilégios e RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.microchips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microchip_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.microchips, public.microchip_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.microchips TO authenticated;
-- Histórico: só leitura e inserção (sem UPDATE/DELETE = imutável).
GRANT SELECT, INSERT ON public.microchip_events TO authenticated;

CREATE POLICY "tenant_select" ON public.microchips FOR SELECT TO authenticated
  USING (private.can_access_clinic(clinic_id));
CREATE POLICY "tenant_insert" ON public.microchips FOR INSERT TO authenticated
  WITH CHECK (private.can_access_clinic(clinic_id));
CREATE POLICY "tenant_update" ON public.microchips FOR UPDATE TO authenticated
  USING (private.can_access_clinic(clinic_id))
  WITH CHECK (private.can_access_clinic(clinic_id));
-- Exclusão apaga o histórico; restrita a owner/admin (o normal é mudar o status).
CREATE POLICY "tenant_delete" ON public.microchips FOR DELETE TO authenticated
  USING (private.can_access_clinic(clinic_id)
         AND private.has_clinic_role(clinic_id, ARRAY['owner', 'admin']::public.clinic_role[]));

CREATE POLICY "tenant_select" ON public.microchip_events FOR SELECT TO authenticated
  USING (private.can_access_clinic(clinic_id));
CREATE POLICY "tenant_insert_manual" ON public.microchip_events FOR INSERT TO authenticated
  WITH CHECK (private.can_access_clinic(clinic_id) AND event_type IN ('scanned', 'note'));

-- ---------------------------------------------------------------------------
-- 5. Busca entre clínicas (animal encontrado)
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.lookup_microchip(p_code text)
RETURNS TABLE (clinic_name text, own_clinic boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '42501';
  END IF;
  IF v_code !~ '^([0-9]{15}|[0-9A-F]{10}|[0-9]{9})$' THEN
    RAISE EXCEPTION 'Código de microchip inválido' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
    SELECT DISTINCT c.name, private.is_clinic_member(c.id)
    FROM public.microchips m
    JOIN public.clinics c ON c.id = m.clinic_id
    WHERE m.code = v_code
      AND (m.public_lookup OR private.is_clinic_member(m.clinic_id));
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_microchip(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.lookup_microchip(text) TO authenticated;
