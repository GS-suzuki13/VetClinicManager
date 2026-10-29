import { useEffect, useState } from 'react';
import { supabase, ClinicMember } from './supabase';

// Equipe não tem nome cadastrado; o e-mail identifica o profissional.
export function memberName(member: Pick<ClinicMember, 'email'> | undefined) {
  if (!member) return 'Sem profissional';
  const local = member.email.split('@')[0].replace(/[._-]+/g, ' ');
  return local.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function useClinicMembers(clinicId: string) {
  const [members, setMembers] = useState<ClinicMember[]>([]);
  useEffect(() => {
    supabase.rpc('list_clinic_members', { p_clinic_id: clinicId }).then(({ data, error }) => {
      if (error) console.error('Erro ao carregar a equipe:', error);
      setMembers(data ?? []);
    });
  }, [clinicId]);
  return members;
}
