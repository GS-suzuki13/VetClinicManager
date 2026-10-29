import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, UserPlus } from 'lucide-react';
import { supabase, ClinicMember, ClinicRole, clinicRoleLabels } from '../lib/supabase';
import { canManageTeam, useAuth, useClinic } from '../context/AuthContext';
import { askConfirm } from '../lib/dialogs';

const ROLES: ClinicRole[] = ['owner', 'admin', 'veterinarian', 'staff'];

const roleDescriptions: Record<ClinicRole, string> = {
  owner: 'Acesso total, inclusive à equipe e a outros proprietários.',
  admin: 'Gerencia equipe e dados da clínica.',
  veterinarian: 'Cadastra e exclui prontuários, vacinas, tutores e animais.',
  staff: 'Cadastra e edita dados e agenda; não exclui histórico clínico.',
};

function rpcErrorMessage(error: { code?: string; message: string }) {
  if (error.code === 'P0002') return 'Nenhum usuário cadastrado com este e-mail. Peça para a pessoa criar uma conta primeiro.';
  if (error.code === '23514') return 'A clínica precisa de pelo menos um proprietário.';
  if (error.code === '42501') return error.message.includes('proprietário') ? error.message : 'Você não tem permissão para esta ação.';
  return 'Não foi possível concluir a operação.';
}

export default function Team() {
  const clinic = useClinic();
  const { user, refreshClinics } = useAuth();
  const canManage = canManageTeam(clinic.role);

  const [members, setMembers] = useState<ClinicMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clinicName, setClinicName] = useState(clinic.name);
  const [savingName, setSavingName] = useState(false);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ClinicRole>('staff');
  const [adding, setAdding] = useState(false);

  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_clinic_members', { p_clinic_id: clinic.id });
    if (error) setError(rpcErrorMessage(error));
    else setMembers(data ?? []);
    setLoading(false);
  }, [clinic.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRename = async (e: FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    const { error } = await supabase.from('clinics').update({ name: clinicName.trim() }).eq('id', clinic.id);
    setSavingName(false);
    if (error) setError('Não foi possível renomear a clínica.');
    else refreshClinics();
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    const { error } = await supabase.rpc('add_clinic_member', { p_clinic_id: clinic.id, p_email: email, p_role: role });
    setAdding(false);
    if (error) {
      setError(rpcErrorMessage(error));
      return;
    }
    setEmail('');
    loadMembers();
  };

  const handleRemove = async (member: ClinicMember) => {
    const self = member.user_id === user?.id;
    const question = self ? 'Deseja sair desta clínica?' : `Remover ${member.email} da equipe?`;
    if (!(await askConfirm(question, { danger: true, title: self ? 'Sair da clínica' : 'Remover da equipe', confirmLabel: self ? 'Sair' : 'Remover' }))) return;

    setError(null);
    const { error } = await supabase.rpc('remove_clinic_member', { p_clinic_id: clinic.id, p_user_id: member.user_id });
    if (error) {
      setError(rpcErrorMessage(error));
      return;
    }
    if (self) refreshClinics();
    else loadMembers();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {error && (
        <div role="alert" className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800">Clínica</h2>
        <form onSubmit={handleRename} className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            disabled={!canManage}
            minLength={2}
            maxLength={120}
            required
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
          />
          {canManage && (
            <button
              type="submit"
              disabled={savingName || clinicName.trim() === clinic.name}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-medium"
            >
              Salvar
            </button>
          )}
        </form>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Equipe</h2>
          <p className="text-sm text-slate-500">Somente membros da equipe acessam os dados desta clínica.</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {members.map((m) => {
              const self = m.user_id === user?.id;
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {m.email} {self && <span className="text-slate-400 font-normal">(você)</span>}
                    </p>
                    <p className="text-xs text-slate-500">{clinicRoleLabels[m.role]}</p>
                  </div>
                  {(canManage || self) && (
                    <button
                      onClick={() => handleRemove(m)}
                      title={self ? 'Sair da clínica' : 'Remover'}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canManage && (
          <form onSubmit={handleAdd} className="p-6 bg-slate-50 border-t border-slate-200 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Adicionar ou alterar membro</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ClinicRole)}
                className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {ROLES.filter((r) => r !== 'owner' || clinic.role === 'owner').map((r) => (
                  <option key={r} value={r}>
                    {clinicRoleLabels[r]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={adding}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-medium"
              >
                <UserPlus className="w-4 h-4" /> Adicionar
              </button>
            </div>
            <p className="text-xs text-slate-500">{roleDescriptions[role]} A pessoa precisa já ter uma conta no VetClinic.</p>
          </form>
        )}
      </section>
    </div>
  );
}
