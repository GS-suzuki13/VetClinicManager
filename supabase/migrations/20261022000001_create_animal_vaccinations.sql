/*
  # Tabela de vacinações

  A tabela `animal_vaccinations` já é usada pelo front-end (páginas/modais de
  vacinas), mas não existia em nenhuma migração do repositório. Esta migração
  versiona o schema esperado pelo código.

  Em bancos onde a tabela já foi criada manualmente, `IF NOT EXISTS` evita erro;
  a migração seguinte (multi-tenant) adiciona o isolamento por clínica.
*/

CREATE TABLE IF NOT EXISTS animal_vaccinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  vaccine_name text NOT NULL,
  vaccine_type text,
  manufacturer text,
  dose_number integer CHECK (dose_number IS NULL OR dose_number > 0),
  total_doses integer CHECK (total_doses IS NULL OR total_doses > 0),
  application_date date NOT NULL,
  next_dose_date date,
  veterinarian_name text,
  clinic_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_animal_vaccinations_animal_id ON animal_vaccinations(animal_id);

ALTER TABLE animal_vaccinations ENABLE ROW LEVEL SECURITY;
