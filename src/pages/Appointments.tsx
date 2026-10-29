import { useCallback, useEffect, useState } from 'react';
import { Edit, Trash2, Clock } from 'lucide-react';
import { supabase, Appointment } from '../lib/supabase';
import { dbErrorMessage, formatDate, formatMinutes, isLate, statusLabel, statusStyle } from '../lib/format';
import { memberName, useClinicMembers } from '../lib/team';
import { useClinic } from '../context/AuthContext';
import { useAppointmentsModal } from '../context/AppointmentsModalContext';
import PageToolbar, { IconButton, PageLoader } from '../components/PageToolbar';
import AppointmentDetailsModal, { AppointmentWithDetails } from '../components/AppointmentDetailsModal';
import { askConfirm, notify } from '../lib/dialogs';

export default function Appointments({ onOpenRecord }: { onOpenRecord: (animalId: string) => void }) {
  const { openModal, savedVersion } = useAppointmentsModal();
  const members = useClinicMembers(useClinic().id);
  const [details, setDetails] = useState<AppointmentWithDetails | null>(null);
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<Appointment['status'] | 'all'>('all');

  const loadAppointments = useCallback(async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, clients(*), animals(*)')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });
    if (error) console.error('Erro ao carregar os agendamentos:', error);
    setAppointments(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments, savedVersion]);

  const handleDelete = async (id: string) => {
    if (!(await askConfirm('Tem certeza de que deseja excluir este agendamento?', { danger: true, title: 'Excluir', confirmLabel: 'Excluir' }))) return;
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) notify(dbErrorMessage(error, 'Erro ao excluir o agendamento.'));
    else loadAppointments();
  };

  const term = searchTerm.toLowerCase();
  const filteredAppointments = appointments.filter((appointment) => {
    const matchesSearch =
      appointment.clients.full_name.toLowerCase().includes(term) ||
      appointment.animals.name.toLowerCase().includes(term) ||
      appointment.reason_for_visit.toLowerCase().includes(term);
    return matchesSearch && (filterStatus === 'all' || appointment.status === filterStatus);
  });

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageToolbar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Buscar agendamentos..."
        actionLabel="Novo Agendamento"
        onAction={() => openModal()}
      >
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as Appointment['status'] | 'all')}
          className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Todos os status</option>
          {Object.entries(statusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </PageToolbar>

      <div className="space-y-4">
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
            Não foram encontrados agendamentos. Clique em "Novo Agendamento" para marcar um.
          </div>
        ) : (
          filteredAppointments.map((appointment) => (
            <div
              key={appointment.id}
              onClick={() => setDetails(appointment)}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="bg-emerald-50 p-2 rounded-lg shrink-0">
                    <Clock className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-slate-800 break-words">
                      {appointment.animals.name} - {appointment.clients.full_name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {formatDate(appointment.appointment_date)} às {appointment.appointment_time.slice(0, 5)} • {formatMinutes(appointment.duration_minutes)}
                      {appointment.care_type && <> • {appointment.care_type}</>}
                      {appointment.professional_id && <> • {memberName(members.find((m) => m.user_id === appointment.professional_id))}</>}
                    </p>
                    <p className="text-sm text-slate-700 mt-2 break-words">
                      <span className="font-medium">Motivo: </span>
                      {appointment.reason_for_visit}
                    </p>
                    <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${statusStyle[appointment.status]}`}>
                      {statusLabel[appointment.status]}
                    </span>
                    {isLate(appointment) && (
                      <span className="inline-block mt-2 ml-2 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Atrasado</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <IconButton
                    tone="blue"
                    title="Editar"
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(appointment);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </IconButton>
                  <IconButton
                    tone="red"
                    title="Excluir"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(appointment.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {details && (
        <AppointmentDetailsModal appointment={details} onClose={() => setDetails(null)} onStatusUpdated={loadAppointments} onOpenRecord={onOpenRecord} />
      )}
    </div>
  );
}
