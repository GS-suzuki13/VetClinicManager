import type { Animal, Client, VaccineDose, VaccineGroup, VaccineProtocol } from './supabase';

export const vaccineGroupLabel: Record<VaccineGroup, string> = {
  vaccine: 'Vacina',
  dewormer: 'Vermífugo',
  antiparasitic: 'Antiparasitário',
};

export type DoseWithDetails = VaccineDose & {
  vaccine_protocols: Pick<VaccineProtocol, 'name' | 'doses'>;
  animals?: Pick<Animal, 'id' | 'name'> & { clients?: Pick<Client, 'full_name'> };
};

export const doseSelect = '*, vaccine_protocols(name, doses), animals(id, name, clients(full_name))';

export function doseLabel(dose: DoseWithDetails) {
  return dose.is_booster ? 'Reforço' : `Dose ${dose.dose_number}/${dose.vaccine_protocols.doses}`;
}
