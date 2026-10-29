import { useState } from 'react';
import { CheckCircle2, ClipboardList, DoorOpen, Play, UserX, XCircle, CalendarCheck, Undo2, MessageCircle, ShoppingCart, Video } from 'lucide-react';
import { supabase, Appointment, AppointmentStatus, Animal, Client } from '../lib/supabase';
import { dbErrorMessage, formatDate, formatMinutes, isLate, statusLabel, statusStyle } from '../lib/format';
import { memberName, useClinicMembers } from '../lib/team';
import { useClinic } from '../context/AuthContext';
import { useAppointmentsModal } from '../context/AppointmentsModalContext';
import Modal, { FormError, fieldClass } from './Modal';
import SaleModal from './SaleModal';
import { fillTemplate, firstName, sendWhatsapp } from '../lib/messages';

export type AppointmentWithDetails = Appointment & {
  clients: Client;
  animals: Animal;
};

interface Props {
  appointment: AppointmentWithDetails;
  onClose: () => void;
  onStatusUpdated: () => void;
  // Abre a ficha do animal (ao iniciar o atendimento ou pelo botão).
  onOpenRecord?: (animalId: string) => void;
}

// Próximos passos do fluxo de atendimento a partir de cada status.
const nextSteps: Record<AppointmentStatus, { to: AppointmentStatus; label: string; icon: typeof Play; primary?: boolean }[]> = {
  Scheduled: [
    { to: 'Confirmed', label: 'Confirmar presença', icon: CalendarCheck },
    { to: 'Waiting', label: 'Registrar chegada', icon: DoorOpen, primary: true },
  ],
  Confirmed: [{ to: 'Waiting', label: 'Registrar chegada', icon: DoorOpen, primary: true }],
  Waiting: [{ to: 'InProgress', label: 'Iniciar atendimento', icon: Play, primary: true }],
  InProgress: [{ to: 'Completed', label: 'Finalizar atendimento', icon: CheckCircle2, primary: true }],
  Completed: [],
  Cancelled: [{ to: 'Scheduled', label: 'Reagendar (voltar para agendado)', icon: Undo2 }],
  NoShow: [{ to: 'Scheduled', label: 'Voltar para agendado', icon: Undo2 }],
};

function minutesBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

function timeOf(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
}

export default function AppointmentDetailsModal({ appointment, onClose, onStatusUpdated, onOpenRecord }: Props) {
  const clinic = useClinic();
  const members = useClinicMembers(clinic.id);
  const { notifySaved } = useAppointmentsModal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [selling, setSelling] = useState(false);
  const [videoUrl, setVideoUrl] = useState(appointment.video_url);

  // Confirmação pelo WhatsApp com o modelo da clínica (registrada na conversa).
  const sendConfirmation = async () => {
    const { data } = await supabase.from('message_templates').select('body').eq('key', 'appointment_confirm').maybeSingle();
    let text = fillTemplate(data?.body ?? 'Olá, {tutor}! Confirmamos o atendimento de {pet} em {data} às {hora}?', {
      tutor: firstName(appointment.clients?.full_name),
      pet: appointment.animals?.name,
      clinica: clinic.name,
      data: formatDate(appointment.appointment_date),
      hora: appointment.appointment_time.slice(0, 5),
    });
    if (videoUrl) text += `
Link da teleconsulta: ${videoUrl}`;
    await sendWhatsapp({ phone: appointment.clients.phone_number, text, clientId: appointment.client_id, animalId: appointment.animal_id, appointmentId: appointment.id, templateKey: 'appointment_confirm' });
  };

  // Teleconsulta: sala de vídeo (Jitsi Meet, sem instalar nada) ligada ao agendamento.
  const createVideoRoom = async () => {
    const url = `https://meet.jit.si/vetclinic-${appointment.id.replace(/-/g, '').slice(0, 20)}`;
    const { error } = await supabase.from('appointments').update({ video_url: url }).eq('id', appointment.id);
    if (error) setError(dbErrorMessage(error, 'Não foi possível criar a sala.'));
    else {
      setVideoUrl(url);
      notifySaved();
    }
  };

  const changeStatus = async (status: AppointmentStatus, extra: Partial<Appointment> = {}) => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('appointments').update({ status, ...extra }).eq('id', appointment.id);
    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível alterar o status.'));
      return;
    }
    onStatusUpdated();
    notifySaved();
    onClose();
    if (status === 'InProgress' && onOpenRecord) onOpenRecord(appointment.animal_id);
  };

  const late = isLate(appointment);
  const wait = minutesBetween(appointment.checked_in_at, appointment.started_at);
  const service = minutesBetween(appointment.started_at, appointment.finished_at);
  const professional = members.find((m) => m.user_id === appointment.professional_id);

  const rows: [string, string][] = [
    ['Animal', appointment.animals?.name ?? '-'],
    ['Tutor', appointment.clients?.full_name ?? '-'],
    ['Data', formatDate(appointment.appointment_date)],
    ['Horário', `${appointment.appointment_time.slice(0, 5)} (${formatMinutes(appointment.duration_minutes)})`],
    ['Tipo', appointment.care_type ?? '-'],
    ['Profissional', appointment.professional_id ? memberName(professional) : 'Não definido'],
  ];

  const steps = nextSteps[appointment.status];
  const canCancel = appointment.status !== 'Completed' && appointment.status !== 'Cancelled' && appointment.status !== 'NoShow';

  return (
    <Modal title="Agendamento" onClose={onClose} size="md">
      <div className="p-4 sm:p-6 space-y-4 text-sm">
        <FormError message={error} />

        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle[appointment.status]}`}>{statusLabel[appointment.status]}</span>
          {late && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Atrasado</span>}
        </div>

        <dl className="grid grid-cols-2 gap-4">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-medium text-slate-800 break-words">{value}</dd>
            </div>
          ))}
          <div className="col-span-2">
            <dt className="text-slate-500">Motivo</dt>
            <dd className="text-slate-700 mt-1">{appointment.reason_for_visit || '—'}</dd>
          </div>
          {appointment.cancel_reason && (
            <div className="col-span-2">
              <dt className="text-slate-500">Motivo do cancelamento</dt>
              <dd className="text-slate-700 mt-1">{appointment.cancel_reason}</dd>
            </div>
          )}
        </dl>

        {(appointment.checked_in_at || appointment.started_at) && (
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center">
            <div>
              <p className="text-xs text-slate-500">Chegada</p>
              <p className="font-semibold text-slate-800">{timeOf(appointment.checked_in_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Espera</p>
              <p className="font-semibold text-slate-800">{wait != null ? formatMinutes(wait) : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Atendimento</p>
              <p className="font-semibold text-slate-800">{service != null ? formatMinutes(service) : appointment.started_at ? 'em curso' : '-'}</p>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 space-y-2">
          {steps.map(({ to, label, icon: Icon, primary }) => (
            <button
              key={to}
              onClick={() => changeStatus(to)}
              disabled={busy}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium disabled:opacity-50 transition-colors ${
                primary ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {appointment.clients?.phone_number && (
              <button onClick={sendConfirmation} className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-medium">
                <MessageCircle className="w-4 h-4" />
                {appointment.status === 'Scheduled' ? 'Pedir confirmação' : 'Mensagem'} no WhatsApp
              </button>
            )}
            <button onClick={() => setSelling(true)} className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium">
              <ShoppingCart className="w-4 h-4" />
              Lançar venda do atendimento
            </button>
            {(appointment.care_type === 'Teleconsulta' || videoUrl) &&
              (videoUrl ? (
                <a href={videoUrl} target="_blank" rel="noreferrer" className="sm:col-span-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">
                  <Video className="w-4 h-4" />
                  Entrar na teleconsulta
                </a>
              ) : (
                <button onClick={createVideoRoom} className="sm:col-span-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">
                  <Video className="w-4 h-4" />
                  Criar sala de teleconsulta
                </button>
              ))}
          </div>

          {onOpenRecord && (
            <button
              onClick={() => {
                onClose();
                onOpenRecord(appointment.animal_id);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              <ClipboardList className="w-4 h-4" />
              Abrir ficha de {appointment.animals?.name}
            </button>
          )}

          {canCancel && !cancelling && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCancelling(true)}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium"
              >
                <XCircle className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={() => changeStatus('NoShow')}
                disabled={busy}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-orange-600 hover:bg-orange-50 font-medium"
              >
                <UserX className="w-4 h-4" />
                Não compareceu
              </button>
            </div>
          )}

          {cancelling && (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <label className="block font-medium text-red-800">Motivo do cancelamento</label>
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={500} className={fieldClass} placeholder="Opcional" />
              <div className="flex gap-2">
                <button onClick={() => setCancelling(false)} className="flex-1 px-3 py-2 rounded-lg bg-white text-slate-700 hover:bg-slate-100 font-medium">
                  Voltar
                </button>
                <button
                  onClick={() => changeStatus('Cancelled', { cancel_reason: cancelReason.trim() || null })}
                  disabled={busy}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  Confirmar cancelamento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {selling && (
        <SaleModal
          context={{ clientId: appointment.client_id, animalId: appointment.animal_id, appointmentId: appointment.id }}
          onClose={() => setSelling(false)}
          onSaved={() => {}}
        />
      )}
    </Modal>
  );
}
