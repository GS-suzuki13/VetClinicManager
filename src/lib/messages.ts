import { supabase, MessageChannel, TemplateKey } from './supabase';

export const templateKeyLabel: Record<TemplateKey, string> = {
  appointment_confirm: 'Confirmação de agendamento',
  vaccine_due: 'Vacina a vencer',
  return: 'Acompanhamento pós-consulta',
  debt: 'Lembrete de pagamento',
  birthday: 'Aniversário do pet',
  inactive: 'Cliente inativo',
  nps: 'Pesquisa de satisfação',
  custom: 'Personalizada',
};

export const channelLabel: Record<MessageChannel, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'E-mail',
  phone: 'Telefone',
  in_person: 'Presencial',
};

export type TemplateVars = Partial<Record<'tutor' | 'pet' | 'clinica' | 'data' | 'hora' | 'vacina' | 'valor' | 'link', string>>;

// Troca {etiqueta} pelos valores; etiquetas sem valor ficam vazias.
export function fillTemplate(body: string, vars: TemplateVars) {
  return body.replace(/\{(\w+)\}/g, (_, key: keyof TemplateVars) => vars[key] ?? '');
}

export function firstName(fullName: string | null | undefined) {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

// Link do WhatsApp (app ou web). Números sem DDI recebem 55 (Brasil).
export function whatsappUrl(phone: string, text: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// Abre o WhatsApp e registra a mensagem no histórico do cliente.
export async function sendWhatsapp(opts: {
  phone: string;
  text: string;
  clientId: string;
  animalId?: string | null;
  appointmentId?: string | null;
  templateKey?: TemplateKey;
}) {
  window.open(whatsappUrl(opts.phone, opts.text), '_blank', 'noopener');
  const { error } = await supabase.from('client_messages').insert({
    client_id: opts.clientId,
    animal_id: opts.animalId ?? null,
    appointment_id: opts.appointmentId ?? null,
    channel: 'whatsapp',
    direction: 'outbound',
    body: opts.text,
    template_key: opts.templateKey ?? null,
  });
  if (error) console.error('Erro ao registrar mensagem:', error);
}

export function publicUrl(param: string, value: string) {
  return `${window.location.origin}/?${param}=${encodeURIComponent(value)}`;
}

// Links públicos (sem login) tratados por PublicRoute.
export function isPublicLink() {
  const params = new URLSearchParams(window.location.search);
  return ['nps', 'agendar', 'pet'].some((key) => params.get(key));
}
