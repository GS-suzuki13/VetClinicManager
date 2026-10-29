/*
  # Agenda: fluxo de atendimento, profissional e duração

  ## Status (fluxo de atendimento)
    Scheduled (Agendado) → Confirmed (Confirmado) → Waiting (Em espera, o
    animal chegou) → InProgress (Em atendimento) → Completed (Atendido).
    Saídas: Cancelled (Cancelado) e NoShow (Não compareceu).
  "Atrasado" não é status gravado: é calculado na tela (horário passou e o
  animal ainda não chegou).

  ## Tempos
  As transições gravam automaticamente a chegada (`checked_in_at`), o início
  (`started_at`) e o fim (`finished_at`), que dão o tempo de espera e o tempo
  de atendimento. Voltar o status apaga os tempos posteriores.

  ## Profissional e conflito de horário
  `professional_id` é um membro da própria clínica (FK composta com
  `clinic_members`; se ele sair da equipe, o campo fica nulo). O mesmo
  profissional não pode ter dois agendamentos ativos sobrepostos
  (constraint de exclusão sobre o intervalo início + duração).
*/

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('Scheduled', 'Confirmed', 'Waiting', 'InProgress', 'Completed', 'Cancelled', 'NoShow'));

ALTER TABLE public.appointments
  ADD COLUMN care_type text CHECK (char_length(care_type) <= 80),
  ADD COLUMN duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 5 AND 720),
  ADD COLUMN professional_id uuid,
  ADD COLUMN checked_in_at timestamptz,
  ADD COLUMN started_at timestamptz,
  ADD COLUMN finished_at timestamptz,
  ADD COLUMN cancel_reason text CHECK (char_length(cancel_reason) <= 500),
  ADD CONSTRAINT appointments_professional_member_fkey
    FOREIGN KEY (clinic_id, professional_id) REFERENCES public.clinic_members(clinic_id, user_id)
    ON DELETE SET NULL (professional_id);

-- Intervalo ocupado (timestamp local da clínica, sem fuso: data + hora + duração).
ALTER TABLE public.appointments
  ADD COLUMN slot tsrange GENERATED ALWAYS AS (
    tsrange(appointment_date + appointment_time, appointment_date + appointment_time + make_interval(mins => duration_minutes))
  ) STORED;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_professional_overlap
  EXCLUDE USING gist (clinic_id WITH =, professional_id WITH =, slot WITH &&)
  WHERE (professional_id IS NOT NULL AND status NOT IN ('Cancelled', 'NoShow'));

CREATE INDEX idx_appointments_professional ON public.appointments (clinic_id, professional_id, appointment_date);

-- Tempos do fluxo gravados pelo banco (o cliente não envia horários).
CREATE FUNCTION private.stamp_appointment_flow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Tempos só mudam com o status; edições comuns não os alteram.
    NEW.checked_in_at := OLD.checked_in_at;
    NEW.started_at := OLD.started_at;
    NEW.finished_at := OLD.finished_at;
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RETURN NEW;
    END IF;
  ELSE
    NEW.checked_in_at := NULL;
    NEW.started_at := NULL;
    NEW.finished_at := NULL;
  END IF;

  CASE NEW.status
    WHEN 'Scheduled', 'Confirmed' THEN
      NEW.checked_in_at := NULL;
      NEW.started_at := NULL;
      NEW.finished_at := NULL;
    WHEN 'Waiting' THEN
      NEW.checked_in_at := coalesce(NEW.checked_in_at, now());
      NEW.started_at := NULL;
      NEW.finished_at := NULL;
    WHEN 'InProgress' THEN
      NEW.checked_in_at := coalesce(NEW.checked_in_at, now());
      NEW.started_at := coalesce(NEW.started_at, now());
      NEW.finished_at := NULL;
    WHEN 'Completed' THEN
      NEW.checked_in_at := coalesce(NEW.checked_in_at, NEW.started_at, now());
      NEW.started_at := coalesce(NEW.started_at, now());
      NEW.finished_at := now();
    ELSE
      -- Cancelled / NoShow: mantém o que já aconteceu.
      NULL;
  END CASE;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.stamp_appointment_flow() FROM public, anon;

CREATE TRIGGER stamp_flow BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION private.stamp_appointment_flow();
