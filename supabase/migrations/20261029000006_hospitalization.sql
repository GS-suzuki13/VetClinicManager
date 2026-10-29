/*
  # Internação

  - `hospital_boxes`: baias/boxes (canil, gatil, isolamento, UTI).
  - `hospitalizations`: internação do animal com triagem (cor de risco), box,
    motivo e desfecho (alta, óbito, transferência). Um box só tem uma
    internação ativa; um animal também.
  - `hospital_prescriptions`: medicação/procedimento com intervalo em horas.
    Ao criar, o servidor gera as tarefas do mapa de execução até o fim da
    prescrição (máximo de 7 dias por vez).
  - `hospital_tasks`: mapa de execução (pendente → feito ou não feito), com
    quem executou e quando.

  O desfecho (`finish_hospitalization`) cancela tarefas pendentes, registra o
  evento na ficha do animal e, no óbito, marca o animal como falecido.
*/

ALTER TABLE public.animals ADD COLUMN deceased_on date;

CREATE TABLE public.hospital_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  kind text NOT NULL DEFAULT 'kennel' CHECK (kind IN ('kennel', 'cattery', 'isolation', 'icu', 'other')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hospital_boxes_id_clinic_key UNIQUE (id, clinic_id)
);

CREATE TABLE public.hospitalizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  animal_id uuid NOT NULL,
  box_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discharged', 'deceased', 'transferred')),
  triage text NOT NULL DEFAULT 'yellow' CHECK (triage IN ('red', 'orange', 'yellow', 'green', 'blue')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  diet text CHECK (char_length(diet) <= 500),
  responsible text CHECK (char_length(responsible) <= 120),
  admitted_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  outcome_notes text CHECK (char_length(outcome_notes) <= 2000),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hospitalizations_id_clinic_key UNIQUE (id, clinic_id),
  CONSTRAINT hospitalizations_ended CHECK ((status = 'active') = (ended_at IS NULL)),
  CONSTRAINT hospitalizations_animal_same_clinic_fkey
    FOREIGN KEY (animal_id, clinic_id) REFERENCES public.animals(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT hospitalizations_box_same_clinic_fkey
    FOREIGN KEY (box_id, clinic_id) REFERENCES public.hospital_boxes(id, clinic_id) ON DELETE SET NULL (box_id)
);

CREATE UNIQUE INDEX hospitalizations_one_per_box ON public.hospitalizations (box_id) WHERE status = 'active' AND box_id IS NOT NULL;
CREATE UNIQUE INDEX hospitalizations_one_per_animal ON public.hospitalizations (animal_id) WHERE status = 'active';
CREATE INDEX idx_hospitalizations_clinic ON public.hospitalizations (clinic_id, status, admitted_at DESC);

CREATE TABLE public.hospital_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  hospitalization_id uuid NOT NULL,
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 300),
  dose text CHECK (char_length(dose) <= 120),
  route text CHECK (char_length(route) <= 40),
  interval_hours numeric(5, 2) NOT NULL CHECK (interval_hours > 0 AND interval_hours <= 168),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hospital_prescriptions_id_clinic_key UNIQUE (id, clinic_id),
  CONSTRAINT hospital_prescriptions_period CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT hospital_prescriptions_hosp_same_clinic_fkey
    FOREIGN KEY (hospitalization_id, clinic_id) REFERENCES public.hospitalizations(id, clinic_id) ON DELETE CASCADE
);

CREATE TABLE public.hospital_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  hospitalization_id uuid NOT NULL,
  prescription_id uuid,
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 300),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  done_at timestamptz,
  done_by_email text,
  notes text CHECK (char_length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hospital_tasks_hosp_same_clinic_fkey
    FOREIGN KEY (hospitalization_id, clinic_id) REFERENCES public.hospitalizations(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT hospital_tasks_prescription_same_clinic_fkey
    FOREIGN KEY (prescription_id, clinic_id) REFERENCES public.hospital_prescriptions(id, clinic_id) ON DELETE CASCADE
);

CREATE INDEX idx_hospital_tasks_schedule ON public.hospital_tasks (clinic_id, status, scheduled_at);
CREATE INDEX idx_hospital_tasks_hosp ON public.hospital_tasks (hospitalization_id, scheduled_at);

-- ---------------------------------------------------------------------------
-- Regras
-- ---------------------------------------------------------------------------

-- Gera as tarefas pendentes de uma prescrição (substitui as pendentes futuras).
CREATE FUNCTION private.schedule_prescription_tasks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_end timestamptz;
  v_label text;
BEGIN
  DELETE FROM public.hospital_tasks
  WHERE prescription_id = NEW.id AND status = 'pending' AND scheduled_at >= now();

  IF NOT NEW.active THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.hospitalizations h WHERE h.id = NEW.hospitalization_id AND h.status = 'active') THEN
    RETURN NULL;
  END IF;

  v_end := least(coalesce(NEW.ends_at, NEW.starts_at + interval '7 days'), greatest(NEW.starts_at, now()) + interval '7 days');
  v_label := NEW.description || coalesce(' ' || nullif(btrim(NEW.dose), ''), '') || coalesce(' (' || nullif(btrim(NEW.route), '') || ')', '');

  INSERT INTO public.hospital_tasks (clinic_id, hospitalization_id, prescription_id, description, scheduled_at)
  SELECT NEW.clinic_id, NEW.hospitalization_id, NEW.id, v_label, t
  FROM generate_series(NEW.starts_at, v_end, make_interval(secs => NEW.interval_hours * 3600)) AS t
  WHERE t >= now() - interval '1 hour'
    AND (NEW.ends_at IS NULL OR t < NEW.ends_at)
  LIMIT 200;
  RETURN NULL;
END;
$$;

CREATE TRIGGER schedule_prescription_tasks
  AFTER INSERT OR UPDATE OF interval_hours, starts_at, ends_at, active, description, dose, route ON public.hospital_prescriptions
  FOR EACH ROW EXECUTE FUNCTION private.schedule_prescription_tasks();

-- Tarefa executada: quem e quando vêm do servidor.
CREATE FUNCTION private.stamp_hospital_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    NEW.done_at := NULL;
    NEW.done_by_email := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.done_at := now();
    NEW.done_by_email := (SELECT u.email FROM auth.users u WHERE u.id = (SELECT auth.uid()));
  ELSE
    NEW.done_at := OLD.done_at;
    NEW.done_by_email := OLD.done_by_email;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stamp_hospital_task BEFORE INSERT OR UPDATE ON public.hospital_tasks
  FOR EACH ROW EXECUTE FUNCTION private.stamp_hospital_task();

-- Desfecho só pela RPC.
CREATE FUNCTION private.guard_hospitalization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF private.in_rpc() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'active';
    NEW.ended_at := NULL;
    NEW.outcome_notes := NULL;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'active' THEN
    RAISE EXCEPTION 'Internação encerrada não pode ser alterada' USING ERRCODE = '42501';
  END IF;
  NEW.status := OLD.status;
  NEW.ended_at := OLD.ended_at;
  NEW.outcome_notes := OLD.outcome_notes;
  NEW.animal_id := OLD.animal_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_hospitalization BEFORE INSERT OR UPDATE ON public.hospitalizations
  FOR EACH ROW EXECUTE FUNCTION private.guard_hospitalization();

SELECT private.setup_tenant_table('hospital_boxes', ARRAY['owner', 'admin']);
SELECT private.setup_tenant_table('hospitalizations', ARRAY['owner', 'admin']);
SELECT private.setup_tenant_table('hospital_prescriptions', ARRAY['owner', 'admin', 'veterinarian']);
SELECT private.setup_tenant_table('hospital_tasks', ARRAY['owner', 'admin', 'veterinarian']);
CREATE TRIGGER stamp_author BEFORE INSERT OR UPDATE ON public.hospitalizations FOR EACH ROW EXECUTE FUNCTION private.stamp_author();
CREATE TRIGGER stamp_author BEFORE INSERT OR UPDATE ON public.hospital_prescriptions FOR EACH ROW EXECUTE FUNCTION private.stamp_author();

REVOKE ALL ON FUNCTION private.schedule_prescription_tasks() FROM public, anon;
REVOKE ALL ON FUNCTION private.stamp_hospital_task() FROM public, anon;
REVOKE ALL ON FUNCTION private.guard_hospitalization() FROM public, anon;

-- Encerra a internação (alta, óbito ou transferência).
CREATE FUNCTION public.finish_hospitalization(p_id uuid, p_outcome text, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_h public.hospitalizations;
  v_title text;
BEGIN
  SELECT * INTO v_h FROM public.hospitalizations WHERE id = p_id FOR UPDATE;
  IF v_h.id IS NULL THEN
    RAISE EXCEPTION 'Internação não encontrada' USING ERRCODE = '23503';
  END IF;
  IF v_h.status <> 'active' THEN
    RAISE EXCEPTION 'Esta internação já foi encerrada.' USING ERRCODE = 'P0001';
  END IF;
  IF p_outcome NOT IN ('discharged', 'deceased', 'transferred') THEN
    RAISE EXCEPTION 'Desfecho inválido.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM private.enter_rpc();
  UPDATE public.hospitalizations
  SET status = p_outcome, ended_at = now(), outcome_notes = nullif(btrim(p_notes), '')
  WHERE id = p_id;
  UPDATE public.hospital_tasks SET status = 'skipped', notes = coalesce(notes, 'Internação encerrada')
  WHERE hospitalization_id = p_id AND status = 'pending';
  UPDATE public.hospital_prescriptions SET active = false WHERE hospitalization_id = p_id;

  v_title := CASE p_outcome WHEN 'discharged' THEN 'Alta da internação' WHEN 'deceased' THEN 'Óbito durante a internação'
                            ELSE 'Transferência da internação' END;
  INSERT INTO public.clinical_events (clinic_id, animal_id, event_type, title, content)
  VALUES (v_h.clinic_id, v_h.animal_id, 'note', v_title,
          format('Internado em %s. Motivo: %s.%s', to_char(v_h.admitted_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
                 v_h.reason, coalesce(E'\n' || nullif(btrim(p_notes), ''), '')));

  IF p_outcome = 'deceased' THEN
    UPDATE public.animals SET deceased_on = (now() AT TIME ZONE 'America/Sao_Paulo')::date WHERE id = v_h.animal_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_hospitalization(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finish_hospitalization(uuid, text, text) TO authenticated;
