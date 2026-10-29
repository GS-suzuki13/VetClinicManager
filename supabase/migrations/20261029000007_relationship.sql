/*
  # Relacionamento com o tutor

  - `message_templates`: modelos de mensagem por clínica (confirmação de
    agenda, vacina a vencer, retorno, cobrança, aniversário, cliente inativo,
    pesquisa de satisfação). Etiquetas: {tutor} {pet} {clinica} {data} {hora}
    {vacina} {valor} {link}.
  - `client_messages`: histórico de comunicação nos dois sentidos (enviada e
    recebida), por canal, ligado ao cliente/animal. É a "conversa registrada"
    que falta no SimplesVet (lá só há disparo).
  - `nps_surveys`: pesquisa de satisfação por link (token); o tutor responde
    sem login pela RPC `submit_nps`.
  - Agendamento online: configuração na clínica (`booking_*`), horários livres
    por `online_booking_slots` e pedidos em `booking_requests`, aceitos pela
    recepção (vira agendamento confirmado).
  - `pet_share_links`: cartão do pet (vacinas, próximas doses e consultas) por
    link, sem login — o portal do tutor que o SimplesVet cobra à parte.
  - `appointments.video_url`: link da teleconsulta.

  As RPCs públicas (anon) são SECURITY DEFINER, recebem só tokens/slug e
  devolvem o mínimo necessário.
*/

ALTER TABLE public.clinics
  ADD COLUMN booking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN booking_slug text UNIQUE CHECK (booking_slug ~ '^[a-z0-9][a-z0-9-]{2,40}$'),
  ADD COLUMN booking_open time NOT NULL DEFAULT '08:00',
  ADD COLUMN booking_close time NOT NULL DEFAULT '18:00',
  ADD COLUMN booking_slot_minutes integer NOT NULL DEFAULT 30 CHECK (booking_slot_minutes BETWEEN 10 AND 240),
  ADD COLUMN booking_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN phone text CHECK (char_length(phone) <= 30),
  ADD COLUMN address text CHECK (char_length(address) <= 300),
  ADD CONSTRAINT clinics_booking_hours CHECK (booking_close > booking_open),
  ADD CONSTRAINT clinics_booking_days CHECK (booking_days <@ '{1,2,3,4,5,6,7}'::integer[]);

GRANT UPDATE (booking_enabled, booking_slug, booking_open, booking_close, booking_slot_minutes, booking_days, phone, address)
  ON public.clinics TO authenticated;

ALTER TABLE public.appointments
  ADD COLUMN video_url text CHECK (video_url ~ '^https://');

-- ---------------------------------------------------------------------------
-- Modelos e histórico de mensagens
-- ---------------------------------------------------------------------------

CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key IN ('appointment_confirm', 'vaccine_due', 'return', 'debt', 'birthday', 'inactive', 'nps', 'custom')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX message_templates_key ON public.message_templates (clinic_id, key) WHERE key <> 'custom';

CREATE TABLE public.client_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  animal_id uuid,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email', 'phone', 'in_person')),
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  template_key text,
  appointment_id uuid,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_messages_client_same_clinic_fkey
    FOREIGN KEY (client_id, clinic_id) REFERENCES public.clients(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT client_messages_animal_same_clinic_fkey
    FOREIGN KEY (animal_id, clinic_id) REFERENCES public.animals(id, clinic_id) ON DELETE SET NULL (animal_id),
  CONSTRAINT client_messages_appointment_same_clinic_fkey
    FOREIGN KEY (appointment_id, clinic_id) REFERENCES public.appointments(id, clinic_id) ON DELETE SET NULL (appointment_id)
);

CREATE INDEX idx_client_messages_client ON public.client_messages (client_id, created_at DESC);
CREATE INDEX idx_client_messages_clinic ON public.client_messages (clinic_id, created_at DESC);

CREATE FUNCTION private.seed_message_templates(p_clinic_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
  INSERT INTO public.message_templates (clinic_id, key, name, body)
  SELECT p_clinic_id, t.key, t.name, t.body
  FROM (VALUES
    ('appointment_confirm', 'Confirmação de agendamento',
     'Olá, {tutor}! Aqui é da {clinica}. Confirmamos o atendimento de {pet} em {data} às {hora}? Responda SIM para confirmar ou nos avise se precisar remarcar.'),
    ('vaccine_due', 'Vacina a vencer',
     'Olá, {tutor}! A vacina {vacina} de {pet} vence em {data}. Quer agendar a aplicação? Equipe {clinica}.'),
    ('return', 'Acompanhamento pós-consulta',
     'Olá, {tutor}! Como {pet} está depois do atendimento de {data}? Se tiver qualquer dúvida, é só responder esta mensagem. Equipe {clinica}.'),
    ('debt', 'Lembrete de pagamento',
     'Olá, {tutor}! Consta um saldo em aberto de {valor} na {clinica}. Podemos ajudar com Pix ou parcelamento? Se já pagou, desconsidere.'),
    ('birthday', 'Aniversário do pet',
     'Parabéns para {pet}! 🎉 Toda a equipe da {clinica} deseja muita saúde e alegria.'),
    ('inactive', 'Cliente inativo',
     'Olá, {tutor}! Faz tempo que não vemos {pet} por aqui. Que tal agendar um check-up? Equipe {clinica}.'),
    ('nps', 'Pesquisa de satisfação',
     'Olá, {tutor}! De 0 a 10, quanto você recomendaria a {clinica}? Leva 10 segundos: {link}')
  ) AS t(key, name, body)
  ON CONFLICT DO NOTHING;
$$;

CREATE FUNCTION private.seed_clinic_templates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.seed_message_templates(NEW.id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER seed_clinic_templates AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION private.seed_clinic_templates();

-- ---------------------------------------------------------------------------
-- NPS, agendamento online e cartão do pet
-- ---------------------------------------------------------------------------

CREATE TABLE public.nps_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  appointment_id uuid,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  score smallint CHECK (score BETWEEN 0 AND 10),
  comment text CHECK (char_length(comment) <= 1000),
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nps_surveys_answered CHECK ((score IS NULL) = (answered_at IS NULL)),
  CONSTRAINT nps_surveys_client_same_clinic_fkey
    FOREIGN KEY (client_id, clinic_id) REFERENCES public.clients(id, clinic_id) ON DELETE CASCADE,
  CONSTRAINT nps_surveys_appointment_same_clinic_fkey
    FOREIGN KEY (appointment_id, clinic_id) REFERENCES public.appointments(id, clinic_id) ON DELETE SET NULL (appointment_id)
);

CREATE INDEX idx_nps_surveys_clinic ON public.nps_surveys (clinic_id, created_at DESC);

-- A resposta só vem do tutor (RPC pública); a equipe não altera nota.
CREATE FUNCTION private.guard_nps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF private.in_rpc() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.score := NULL;
    NEW.comment := NULL;
    NEW.answered_at := NULL;
    NEW.token := gen_random_uuid();
  ELSE
    NEW.score := OLD.score;
    NEW.comment := OLD.comment;
    NEW.answered_at := OLD.answered_at;
    NEW.token := OLD.token;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_nps BEFORE INSERT OR UPDATE ON public.nps_surveys
  FOR EACH ROW EXECUTE FUNCTION private.guard_nps();

CREATE TABLE public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  tutor_name text NOT NULL CHECK (char_length(btrim(tutor_name)) BETWEEN 2 AND 120),
  phone text NOT NULL CHECK (phone ~ '^[0-9]{10,13}$'),
  email text CHECK (char_length(email) <= 160),
  pet_name text NOT NULL CHECK (char_length(btrim(pet_name)) BETWEEN 1 AND 80),
  species text NOT NULL CHECK (species IN ('Dog', 'Cat')),
  care_type text NOT NULL CHECK (char_length(care_type) <= 40),
  requested_date date NOT NULL,
  requested_time time NOT NULL,
  notes text CHECK (char_length(notes) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  appointment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_requests_appointment_same_clinic_fkey
    FOREIGN KEY (appointment_id, clinic_id) REFERENCES public.appointments(id, clinic_id) ON DELETE SET NULL (appointment_id)
);

CREATE INDEX idx_booking_requests_clinic ON public.booking_requests (clinic_id, status, requested_date);

CREATE TABLE public.pet_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  animal_id uuid NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '180 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pet_share_links_animal_same_clinic_fkey
    FOREIGN KEY (animal_id, clinic_id) REFERENCES public.animals(id, clinic_id) ON DELETE CASCADE
);

SELECT private.setup_tenant_table('message_templates', ARRAY['owner', 'admin']);
SELECT private.setup_tenant_table('client_messages', ARRAY['owner', 'admin'], true, false);
SELECT private.setup_tenant_table('nps_surveys', ARRAY['owner', 'admin']);
SELECT private.setup_tenant_table('booking_requests', ARRAY['owner', 'admin']);
SELECT private.setup_tenant_table('pet_share_links', ARRAY['owner', 'admin', 'veterinarian', 'staff'], true, false);
-- Pedidos de agendamento só chegam pela RPC pública.
DROP POLICY "tenant_insert" ON public.booking_requests;
CREATE TRIGGER stamp_author BEFORE INSERT OR UPDATE ON public.client_messages FOR EACH ROW EXECUTE FUNCTION private.stamp_author();

REVOKE ALL ON FUNCTION private.seed_message_templates(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.seed_clinic_templates() FROM public, anon;
REVOKE ALL ON FUNCTION private.guard_nps() FROM public, anon;

SELECT private.seed_message_templates(id) FROM public.clinics;

-- ---------------------------------------------------------------------------
-- RPCs públicas (anon)
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.get_nps_survey(p_token uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'clinic_name', c.name,
    'tutor_first_name', split_part(btrim(cl.full_name), ' ', 1),
    'answered', s.answered_at IS NOT NULL
  )
  FROM public.nps_surveys s
  JOIN public.clinics c ON c.id = s.clinic_id
  JOIN public.clients cl ON cl.id = s.client_id
  WHERE s.token = p_token;
$$;

CREATE FUNCTION public.submit_nps(p_token uuid, p_score integer, p_comment text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_score IS NULL OR p_score NOT BETWEEN 0 AND 10 THEN
    RAISE EXCEPTION 'Nota inválida' USING ERRCODE = '22023';
  END IF;
  PERFORM private.enter_rpc();
  UPDATE public.nps_surveys
  SET score = p_score, comment = left(nullif(btrim(p_comment), ''), 1000), answered_at = now()
  WHERE token = p_token AND answered_at IS NULL;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.online_booking_info(p_slug text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'clinic_name', c.name,
    'phone', c.phone,
    'address', c.address,
    'open', to_char(c.booking_open, 'HH24:MI'),
    'close', to_char(c.booking_close, 'HH24:MI'),
    'slot_minutes', c.booking_slot_minutes,
    'days', c.booking_days
  )
  FROM public.clinics c
  WHERE c.booking_enabled AND c.booking_slug = lower(btrim(p_slug));
$$;

-- Horários livres: respeita dias/horário de atendimento, agendamentos em aberto
-- (capacidade = número de veterinários, mínimo 1) e pedidos pendentes.
CREATE FUNCTION public.online_booking_slots(p_slug text, p_date date)
RETURNS SETOF text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clinic public.clinics;
  v_now timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
  v_capacity integer;
BEGIN
  SELECT * INTO v_clinic FROM public.clinics WHERE booking_enabled AND booking_slug = lower(btrim(p_slug));
  IF v_clinic.id IS NULL OR p_date < v_now::date OR p_date > v_now::date + 60
     OR NOT (extract(isodow FROM p_date)::integer = ANY (v_clinic.booking_days)) THEN
    RETURN;
  END IF;
  SELECT greatest(count(*), 1) INTO v_capacity
  FROM public.clinic_members WHERE clinic_id = v_clinic.id AND role = 'veterinarian';

  RETURN QUERY
  SELECT to_char(g.t, 'HH24:MI')
  FROM generate_series(p_date + v_clinic.booking_open,
                       p_date + v_clinic.booking_close - make_interval(mins => v_clinic.booking_slot_minutes),
                       make_interval(mins => v_clinic.booking_slot_minutes)) AS g(t)
  WHERE g.t > v_now
    AND (
      SELECT count(*) FROM public.appointments a
      WHERE a.clinic_id = v_clinic.id AND a.appointment_date = p_date
        AND a.status IN ('Scheduled', 'Confirmed', 'Waiting', 'InProgress')
        AND tsrange(p_date + a.appointment_time, p_date + a.appointment_time + make_interval(mins => a.duration_minutes))
            && tsrange(g.t, g.t + make_interval(mins => v_clinic.booking_slot_minutes))
    ) + (
      SELECT count(*) FROM public.booking_requests r
      WHERE r.clinic_id = v_clinic.id AND r.status = 'pending'
        AND r.requested_date = p_date AND r.requested_time = g.t::time
    ) < v_capacity;
END;
$$;

CREATE FUNCTION public.request_online_booking(
  p_slug text, p_tutor_name text, p_phone text, p_email text, p_pet_name text, p_species text,
  p_care_type text, p_date date, p_time text, p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clinic uuid;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_id uuid;
BEGIN
  SELECT id INTO v_clinic FROM public.clinics WHERE booking_enabled AND booking_slug = lower(btrim(p_slug));
  IF v_clinic IS NULL THEN
    RAISE EXCEPTION 'Agendamento online indisponível.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.online_booking_slots(p_slug, p_date) AS s WHERE s = p_time) THEN
    RAISE EXCEPTION 'Este horário não está mais disponível. Escolha outro.' USING ERRCODE = 'P0001';
  END IF;
  -- Limites contra abuso do formulário público.
  IF (SELECT count(*) FROM public.booking_requests WHERE clinic_id = v_clinic AND phone = v_phone AND status = 'pending') >= 3
     OR (SELECT count(*) FROM public.booking_requests WHERE clinic_id = v_clinic AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'Muitos pedidos em aberto. Aguarde o contato da clínica.' USING ERRCODE = 'P0001';
  END IF;
  IF p_care_type NOT IN ('Consulta', 'Retorno', 'Vacinação', 'Exame', 'Banho e tosa', 'Teleconsulta') THEN
    RAISE EXCEPTION 'Tipo de atendimento inválido.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.booking_requests (clinic_id, tutor_name, phone, email, pet_name, species, care_type, requested_date, requested_time, notes)
  VALUES (v_clinic, btrim(p_tutor_name), v_phone, nullif(btrim(p_email), ''), btrim(p_pet_name), p_species, p_care_type,
          p_date, p_time::time, nullif(btrim(p_notes), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.get_pet_card(p_token uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'clinic_name', c.name,
    'clinic_phone', c.phone,
    'pet', json_build_object('name', a.name, 'species', a.species, 'breed', a.breed, 'date_of_birth', a.date_of_birth),
    'vaccinations', coalesce((
      SELECT json_agg(json_build_object('name', v.vaccine_name, 'date', v.application_date, 'next', v.next_dose_date)
                      ORDER BY v.application_date DESC)
      FROM public.animal_vaccinations v WHERE v.animal_id = a.id), '[]'::json),
    'scheduled_doses', coalesce((
      SELECT json_agg(json_build_object('name', p.name, 'due', d.due_date) ORDER BY d.due_date)
      FROM public.vaccine_doses d JOIN public.vaccine_protocols p ON p.id = d.protocol_id
      WHERE d.animal_id = a.id AND d.status = 'scheduled'), '[]'::json),
    'appointments', coalesce((
      SELECT json_agg(json_build_object('date', ap.appointment_date, 'time', to_char(ap.appointment_time, 'HH24:MI'),
                                        'type', ap.care_type, 'video_url', ap.video_url)
                      ORDER BY ap.appointment_date, ap.appointment_time)
      FROM public.appointments ap
      WHERE ap.animal_id = a.id AND ap.appointment_date >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
        AND ap.status IN ('Scheduled', 'Confirmed')), '[]'::json)
  )
  FROM public.pet_share_links l
  JOIN public.animals a ON a.id = l.animal_id
  JOIN public.clinics c ON c.id = l.clinic_id
  WHERE l.token = p_token AND l.expires_at > now();
$$;

-- Recepção aceita o pedido: vira agendamento confirmado.
CREATE FUNCTION public.accept_booking_request(p_request_id uuid, p_client_id uuid, p_animal_id uuid, p_professional_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_req public.booking_requests;
  v_appointment uuid;
BEGIN
  SELECT * INTO v_req FROM public.booking_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado' USING ERRCODE = '23503';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Este pedido já foi respondido.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.appointments (
    clinic_id, client_id, animal_id, appointment_date, appointment_time, reason_for_visit, status, care_type, professional_id
  )
  VALUES (
    v_req.clinic_id, p_client_id, p_animal_id, v_req.requested_date, v_req.requested_time,
    coalesce(v_req.notes, 'Agendamento online'), 'Confirmed', v_req.care_type, p_professional_id
  )
  RETURNING id INTO v_appointment;
  UPDATE public.booking_requests SET status = 'accepted', appointment_id = v_appointment WHERE id = p_request_id;
  RETURN v_appointment;
END;
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.get_nps_survey(uuid)',
    'public.submit_nps(uuid, integer, text)',
    'public.online_booking_info(text)',
    'public.online_booking_slots(text, date)',
    'public.request_online_booking(text, text, text, text, text, text, text, date, text, text)',
    'public.get_pet_card(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_booking_request(uuid, uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_booking_request(uuid, uuid, uuid, uuid) TO authenticated;
