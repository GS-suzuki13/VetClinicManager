/*
  # Ficha do animal: eventos clínicos

  A ficha reúne num único histórico tudo o que acontece com o animal. Consultas
  (`medical_records`) e vacinas (`animal_vaccinations`) continuam nas tabelas
  próprias; esta tabela guarda os demais tipos de evento:

  - weight       Pesagem (atualiza `animals.weight` com o peso mais recente)
  - vitals       Sinais vitais estruturados (temperatura, FC, FR, escore
                 corporal 1–9, escala de dor 0–10), para acompanhar evolução
  - pathology    Patologia/diagnóstico identificado
  - exam         Exame (pedido ou resultado)
  - prescription Receita
  - document     Documento (atestado, termo, guia...)
  - note         Observação
  - alert        Alerta clínico (alergia, comportamento...). Fica fixo no topo
                 da ficha até ser resolvido (`resolved_at`).

  O autor vem sempre da sessão (trigger), nunca do cliente.
*/

CREATE TABLE public.clinical_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  animal_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'weight', 'vitals', 'pathology', 'exam', 'prescription', 'document', 'note', 'alert'
  )),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  title text CHECK (char_length(title) <= 200),
  content text CHECK (char_length(content) <= 20000),
  weight_kg numeric(7, 3) CHECK (weight_kg > 0 AND weight_kg < 10000),
  temperature_c numeric(4, 1) CHECK (temperature_c BETWEEN 25 AND 46),
  heart_rate integer CHECK (heart_rate BETWEEN 1 AND 500),
  respiratory_rate integer CHECK (respiratory_rate BETWEEN 1 AND 300),
  body_condition_score smallint CHECK (body_condition_score BETWEEN 1 AND 9),
  pain_score smallint CHECK (pain_score BETWEEN 0 AND 10),
  resolved_at timestamptz,
  author_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinical_events_animal_same_clinic_fkey
    FOREIGN KEY (animal_id, clinic_id) REFERENCES public.animals(id, clinic_id) ON DELETE CASCADE,
  -- Peso só em pesagem, e pesagem sempre com peso.
  CONSTRAINT clinical_events_weight_check CHECK ((event_type = 'weight') = (weight_kg IS NOT NULL)),
  -- Sinais vitais só no tipo vitals, com ao menos um valor.
  CONSTRAINT clinical_events_vitals_check CHECK (
    CASE WHEN event_type = 'vitals'
      THEN num_nonnulls(temperature_c, heart_rate, respiratory_rate, body_condition_score, pain_score) > 0
      ELSE num_nonnulls(temperature_c, heart_rate, respiratory_rate, body_condition_score, pain_score) = 0
    END
  ),
  -- Os tipos textuais precisam de título.
  CONSTRAINT clinical_events_title_required_check CHECK (
    event_type IN ('weight', 'vitals') OR char_length(btrim(coalesce(title, ''))) > 0
  ),
  CONSTRAINT clinical_events_resolved_check CHECK (resolved_at IS NULL OR event_type = 'alert')
);

CREATE INDEX idx_clinical_events_animal ON public.clinical_events (animal_id, occurred_at DESC);
CREATE INDEX idx_clinical_events_clinic ON public.clinical_events (clinic_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Autor sempre da sessão; na edição, o autor original é preservado.
CREATE FUNCTION private.stamp_clinical_event_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := (SELECT auth.uid());
    NEW.author_email := (SELECT u.email FROM auth.users u WHERE u.id = NEW.author_id);
    NEW.created_at := now();
  ELSE
    NEW.author_id := OLD.author_id;
    NEW.author_email := OLD.author_email;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

-- O peso do cadastro do animal acompanha a pesagem mais recente.
CREATE FUNCTION private.sync_animal_weight()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_animal uuid := coalesce(NEW.animal_id, OLD.animal_id);
  v_weight numeric;
BEGIN
  SELECT e.weight_kg INTO v_weight
  FROM public.clinical_events e
  WHERE e.animal_id = v_animal AND e.event_type = 'weight'
  ORDER BY e.occurred_at DESC, e.created_at DESC
  LIMIT 1;

  -- animals.weight tem 2 casas e precisa ser > 0 (filhotes de poucos gramas).
  v_weight := greatest(round(v_weight, 2), 0.01);
  IF v_weight IS NOT NULL THEN
    UPDATE public.animals SET weight = v_weight
    WHERE id = v_animal AND weight IS DISTINCT FROM v_weight;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER set_clinic_id BEFORE INSERT ON public.clinical_events
  FOR EACH ROW EXECUTE FUNCTION private.set_clinic_id();
CREATE TRIGGER prevent_clinic_change BEFORE UPDATE ON public.clinical_events
  FOR EACH ROW EXECUTE FUNCTION private.prevent_clinic_change();
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.clinical_events
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER stamp_author BEFORE INSERT OR UPDATE ON public.clinical_events
  FOR EACH ROW EXECUTE FUNCTION private.stamp_clinical_event_author();
CREATE TRIGGER sync_animal_weight AFTER INSERT OR UPDATE OR DELETE ON public.clinical_events
  FOR EACH ROW EXECUTE FUNCTION private.sync_animal_weight();

REVOKE ALL ON FUNCTION private.stamp_clinical_event_author() FROM public, anon;
REVOKE ALL ON FUNCTION private.sync_animal_weight() FROM public, anon;

-- ---------------------------------------------------------------------------
-- Privilégios e RLS (mesmo padrão das demais tabelas clínicas)
-- ---------------------------------------------------------------------------

ALTER TABLE public.clinical_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.clinical_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_events TO authenticated;

CREATE POLICY "tenant_select" ON public.clinical_events FOR SELECT TO authenticated
  USING (private.can_access_clinic(clinic_id));
CREATE POLICY "tenant_insert" ON public.clinical_events FOR INSERT TO authenticated
  WITH CHECK (private.can_access_clinic(clinic_id));
CREATE POLICY "tenant_update" ON public.clinical_events FOR UPDATE TO authenticated
  USING (private.can_access_clinic(clinic_id))
  WITH CHECK (private.can_access_clinic(clinic_id));
-- Histórico clínico: exclusão só por owner/admin/veterinário.
CREATE POLICY "tenant_delete" ON public.clinical_events FOR DELETE TO authenticated
  USING (private.can_access_clinic(clinic_id)
         AND private.has_clinic_role(clinic_id, ARRAY['owner', 'admin', 'veterinarian']::public.clinic_role[]));
