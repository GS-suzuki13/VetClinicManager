/*
  # Veterinary Clinic Management System Schema

  ## Overview
  This migration creates the complete database schema for a veterinary clinic management system
  that manages clients, their animals, medical records, and appointments.

  ## New Tables

  ### 1. clients
  Stores information about pet owners
  - `id` (uuid, primary key) - Unique identifier
  - `full_name` (text, required) - Client's full name
  - `cpf` (text, unique, required) - Brazilian tax ID
  - `email` (text, required) - Email address
  - `phone_number` (text, required) - Contact phone
  - `date_of_birth` (date, required) - Client's birth date
  - `residential_address` (text, required) - Home address
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. animals
  Stores information about pets (dogs and cats only)
  - `id` (uuid, primary key) - Unique identifier
  - `client_id` (uuid, foreign key) - References clients table
  - `name` (text, required) - Pet's name
  - `species` (text, required) - Either 'Dog' or 'Cat'
  - `breed` (text, required) - Breed of the animal
  - `age` (integer, required) - Age in years
  - `date_of_birth` (date, required) - Birth date
  - `weight` (decimal, required) - Weight in kilograms
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 3. medical_records
  Stores medical history entries for each animal
  - `id` (uuid, primary key) - Unique identifier
  - `animal_id` (uuid, foreign key) - References animals table
  - `consultation_date` (timestamptz, required) - Date and time of consultation
  - `symptoms` (text, required) - Reported symptoms
  - `diagnosis` (text, required) - Veterinarian's diagnosis
  - `procedures` (text) - Procedures performed
  - `prescribed_medication` (text) - Medications prescribed
  - `observations` (text) - Additional notes
  - `veterinarian_name` (text, required) - Name of attending vet
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 4. appointments
  Stores scheduled appointments
  - `id` (uuid, primary key) - Unique identifier
  - `client_id` (uuid, foreign key) - References clients table
  - `animal_id` (uuid, foreign key) - References animals table
  - `appointment_date` (date, required) - Date of appointment
  - `appointment_time` (time, required) - Time of appointment
  - `reason_for_visit` (text, required) - Purpose of visit
  - `status` (text, required) - Status: 'Scheduled', 'Completed', 'Cancelled'
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on all tables
  - Add permissive policies for public access (no authentication required)
  
  ## Indexes
  - Index on client_id in animals table
  - Index on animal_id in medical_records table
  - Index on client_id and animal_id in appointments table
  - Index on appointment_date for faster scheduling queries
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  cpf text UNIQUE NOT NULL,
  email text NOT NULL,
  phone_number text NOT NULL,
  date_of_birth date NOT NULL,
  residential_address text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create animals table
CREATE TABLE IF NOT EXISTS animals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  species text NOT NULL CHECK (species IN ('Dog', 'Cat')),
  breed text NOT NULL,
  age integer NOT NULL CHECK (age >= 0),
  date_of_birth date NOT NULL,
  weight decimal(10, 2) NOT NULL CHECK (weight > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create medical_records table
CREATE TABLE IF NOT EXISTS medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  consultation_date timestamptz NOT NULL,
  symptoms text NOT NULL,
  diagnosis text NOT NULL,
  procedures text DEFAULT '',
  prescribed_medication text DEFAULT '',
  observations text DEFAULT '',
  veterinarian_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  animal_id uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  reason_for_visit text NOT NULL,
  status text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_animals_client_id ON animals(client_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_animal_id ON medical_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_animal_id ON appointments(animal_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for public access (no authentication required)
CREATE POLICY "Allow all operations on clients"
  ON clients
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on animals"
  ON animals
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on medical_records"
  ON medical_records
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on appointments"
  ON appointments
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);