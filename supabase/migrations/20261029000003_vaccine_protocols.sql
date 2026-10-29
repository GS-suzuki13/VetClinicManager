/*
  # Vacinas: protocolos e programação de doses

  ## Protocolo (`vaccine_protocols`, por clínica)
  Nome da vacina/antiparasitário, grupo, espécie, número de doses da série,
  intervalo entre doses e, opcionalmente:
  - `booster_days`: reforço recorrente após a série (ex.: anual = 365). Cada
    reforço aplicado programa o próximo.
  - `next_protocol_id`: protocolo encadeado, programado ao terminar a série
    (ex.: "V10 filhote" → "V10 adulto").

  ## Programação (`vaccine_doses`)
  Uma linha por dose prevista: `scheduled` → `applied` (gera a linha em
  `animal_vaccinations`) ou `skipped` (protocolo interrompido). "Atrasada" é
  calculado: programada com data vencida.

  As regras ficam nas RPCs `apply_vaccine_protocol`, `apply_vaccine_dose` e
  `stop_vaccine_protocol` (transação única; RLS continua valendo: as funções
  rodam com os privilégios do usuário).
*/

CREATE TABLE public.vaccine_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  vaccine_group text NOT NULL DEFAULT 'vaccine' CHECK (vaccine_group IN ('vaccine', 'dewormer', 'antiparasitic')),
  species text CHECK (species IN ('Dog', 'Cat')),
  doses integer NOT NULL DEFAULT 1 CHECK (doses BETWEEN 1 AND 20),
  interval_days integer NOT NULL DEFAULT 21 CHECK (interval_days BETWEEN 1 AND 3650),
  booster_days integer CHECK (booster_days BETWEEN 1 AND 3650),
  next_protocol_id uuid,
  manufacturer text CHECK (char_length(manufacturer) <= 120),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vaccine_protocols_id_clinic_key UNIQUE (id, clinic_id),
  CONSTRAINT vaccine_protocols_next_same_clinic_fkey
    FOREIGN KEY (next_protocol_id, clinic_id) REFERENCES public.vaccine_protocols(id, clinic_id) ON DELETE SET NULL (next_protocol_id),
  CONSTRAINT vaccine_protocols_not_self CHECK (next_protocol_id IS DISTINCT FROM id)
);

CREATE INDEX idx_vaccine_protocols_clinic ON public.vaccine_protocols (clinic_id);

CREATE TABLE public.vaccine_doses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  animal_id uuid NOT NULL,
  protocol_id uuid NOT NULL,
  -- Identifica a aplicação do protocolo no animal (todas as doses da série).
  series_id uuid NOT NULL,
  dose_number integer NOT NULL CHECK (dose_number >= 1),
  is_booster boolean NOT NULL DEFAULT false,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'applied', 'skipped')),
  vaccination_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vaccine_doses_animal_same_clinic_fkey
    FOREIGN KEY (animal_id, clinic_id) REFERENCES public.animals(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT vaccine_doses_protocol_same_clinic_fkey
    FOREIGN KEY (protocol_id, clinic_id) REFERENCES public.vaccine_protocols(id, clinic_id) ON DELETE CASCADE
);

CREATE INDEX idx_vaccine_doses_due ON public.vaccine_doses (clinic_id, status, due_date);
CREATE INDEX idx_vaccine_doses_animal ON public.vaccine_doses (animal_id, due_date);

-- Chaves compostas: nenhuma referência atravessa clínicas.
ALTER TABLE public.animal_vaccinations
  ADD COLUMN protocol_id uuid,
  ADD CONSTRAINT animal_vaccinations_id_clinic_key UNIQUE (id, clinic_id),
  ADD CONSTRAINT animal_vaccinations_protocol_same_clinic_fkey
    FOREIGN KEY (protocol_id, clinic_id) REFERENCES public.vaccine_protocols(id, clinic_id) ON DELETE SET NULL (protocol_id);

ALTER TABLE public.vaccine_doses
  ADD CONSTRAINT vaccine_doses_vaccination_same_clinic_fkey
    FOREIGN KEY (vaccination_id, clinic_id) REFERENCES public.animal_vaccinations(id, clinic_id) ON DELETE SET NULL (vaccination_id);

-- ---------------------------------------------------------------------------
-- Triggers e RLS
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vaccine_protocols', 'vaccine_doses'] LOOP
    EXECUTE format('CREATE TRIGGER set_clinic_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.set_clinic_id()', t);
    EXECUTE format('CREATE TRIGGER prevent_clinic_change BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.prevent_clinic_change()', t);
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()', t);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated USING (private.can_access_clinic(clinic_id))', t);
    EXECUTE format('CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (private.can_access_clinic(clinic_id))', t);
    EXECUTE format('CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated USING (private.can_access_clinic(clinic_id)) WITH CHECK (private.can_access_clinic(clinic_id))', t);
    EXECUTE format(
      'CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated
         USING (private.can_access_clinic(clinic_id)
                AND private.has_clinic_role(clinic_id, ARRAY[''owner'', ''admin'', ''veterinarian'']::public.clinic_role[]))', t);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY INVOKER: RLS do usuário vale em todas as leituras/escritas)
-- ---------------------------------------------------------------------------

-- Programa a série completa do protocolo a partir da data da 1ª dose.
CREATE FUNCTION public.apply_vaccine_protocol(p_animal_id uuid, p_protocol_id uuid, p_start date)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_animal public.animals;
  v_protocol public.vaccine_protocols;
  v_series uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_animal FROM public.animals WHERE id = p_animal_id;
  SELECT * INTO v_protocol FROM public.vaccine_protocols WHERE id = p_protocol_id;
  IF v_animal.id IS NULL OR v_protocol.id IS NULL OR v_animal.clinic_id <> v_protocol.clinic_id THEN
    RAISE EXCEPTION 'Animal ou protocolo não encontrado' USING ERRCODE = '23503';
  END IF;
  IF p_start IS NULL THEN
    RAISE EXCEPTION 'Data da primeira dose é obrigatória' USING ERRCODE = '23502';
  END IF;

  INSERT INTO public.vaccine_doses (clinic_id, animal_id, protocol_id, series_id, dose_number, due_date)
  SELECT v_animal.clinic_id, v_animal.id, v_protocol.id, v_series, n, p_start + (n - 1) * v_protocol.interval_days
  FROM generate_series(1, v_protocol.doses) AS n;

  RETURN v_series;
END;
$$;

-- Aplica uma dose programada: registra a vacinação, marca a dose e, ao fim da
-- série, programa o reforço recorrente ou o protocolo encadeado.
CREATE FUNCTION public.apply_vaccine_dose(
  p_dose_id uuid,
  p_application_date date,
  p_veterinarian_name text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_dose public.vaccine_doses;
  v_protocol public.vaccine_protocols;
  v_next date;
  v_vaccination uuid;
  v_remaining integer;
BEGIN
  SELECT * INTO v_dose FROM public.vaccine_doses WHERE id = p_dose_id FOR UPDATE;
  IF v_dose.id IS NULL THEN
    RAISE EXCEPTION 'Dose não encontrada' USING ERRCODE = '23503';
  END IF;
  IF v_dose.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Esta dose não está pendente' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_protocol FROM public.vaccine_protocols WHERE id = v_dose.protocol_id;
  p_application_date := coalesce(p_application_date, current_date);

  SELECT count(*) INTO v_remaining
  FROM public.vaccine_doses
  WHERE series_id = v_dose.series_id AND status = 'scheduled' AND id <> v_dose.id;

  -- Data da próxima dose desta série (ou do reforço / protocolo encadeado).
  SELECT min(due_date) INTO v_next
  FROM public.vaccine_doses
  WHERE series_id = v_dose.series_id AND status = 'scheduled' AND id <> v_dose.id;

  IF v_remaining = 0 AND v_protocol.booster_days IS NOT NULL THEN
    v_next := p_application_date + v_protocol.booster_days;
    INSERT INTO public.vaccine_doses (clinic_id, animal_id, protocol_id, series_id, dose_number, is_booster, due_date)
    VALUES (v_dose.clinic_id, v_dose.animal_id, v_dose.protocol_id, v_dose.series_id, v_dose.dose_number + 1, true, v_next);
  ELSIF v_remaining = 0 AND v_protocol.next_protocol_id IS NOT NULL THEN
    v_next := p_application_date + v_protocol.interval_days;
    PERFORM public.apply_vaccine_protocol(v_dose.animal_id, v_protocol.next_protocol_id, v_next);
  END IF;

  INSERT INTO public.animal_vaccinations (
    clinic_id, animal_id, protocol_id, vaccine_name, manufacturer, dose_number, total_doses,
    application_date, next_dose_date, veterinarian_name, notes
  )
  VALUES (
    v_dose.clinic_id, v_dose.animal_id, v_protocol.id, v_protocol.name, v_protocol.manufacturer,
    v_dose.dose_number, CASE WHEN v_dose.is_booster THEN NULL ELSE v_protocol.doses END,
    p_application_date, v_next, nullif(btrim(p_veterinarian_name), ''), nullif(btrim(p_notes), '')
  )
  RETURNING id INTO v_vaccination;

  UPDATE public.vaccine_doses SET status = 'applied', vaccination_id = v_vaccination WHERE id = v_dose.id;
  RETURN v_vaccination;
END;
$$;

-- Interrompe o protocolo: doses pendentes da série viram "skipped".
CREATE FUNCTION public.stop_vaccine_protocol(p_series_id uuid)
RETURNS integer
LANGUAGE sql
SET search_path = ''
AS $$
  WITH upd AS (
    UPDATE public.vaccine_doses SET status = 'skipped'
    WHERE series_id = p_series_id AND status = 'scheduled'
    RETURNING 1
  )
  SELECT count(*)::integer FROM upd;
$$;

REVOKE ALL ON FUNCTION public.apply_vaccine_protocol(uuid, uuid, date) FROM public, anon;
REVOKE ALL ON FUNCTION public.apply_vaccine_dose(uuid, date, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.stop_vaccine_protocol(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_vaccine_protocol(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_vaccine_dose(uuid, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_vaccine_protocol(uuid) TO authenticated;
