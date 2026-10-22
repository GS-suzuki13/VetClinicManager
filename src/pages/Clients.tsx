import { useCallback, useEffect, useState } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { supabase, Client } from '../lib/supabase';
import { dbErrorMessage } from '../lib/format';
import { canDeleteClinicalData, useClinic } from '../context/AuthContext';
import { useClientsModal } from '../context/ClientsModalContext';
import PageToolbar, { IconButton, PageLoader, tdClass, thClass } from '../components/PageToolbar';

export default function Clients() {
  const canDelete = canDeleteClinicalData(useClinic().role);
  const { openModal, savedVersion } = useClientsModal();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadClients = useCallback(async () => {
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (error) console.error('Erro ao carregar clientes:', error);
    setClients(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients, savedVersion]);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente? Isso também excluirá seus animais, prontuários, vacinas e agendamentos.')) {
      return;
    }
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) alert(dbErrorMessage(error, 'Erro ao excluir o cliente.'));
    else loadClients();
  };

  const term = searchTerm.toLowerCase();
  const filteredClients = clients.filter(
    (client) =>
      client.full_name.toLowerCase().includes(term) || client.cpf.includes(searchTerm) || client.email.toLowerCase().includes(term)
  );

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageToolbar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Procurar por nome, CPF ou e-mail..."
        actionLabel="Adicionar Cliente"
        onAction={() => openModal()}
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={thClass}>Nome</th>
                <th className={`${thClass} hidden md:table-cell`}>CPF</th>
                <th className={`${thClass} hidden lg:table-cell`}>Email</th>
                <th className={`${thClass} hidden sm:table-cell`}>Telefone</th>
                <th className={`${thClass} text-right`}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhum cliente encontrado. Clique em "Adicionar Cliente" para criar seu primeiro cliente.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className={`${tdClass} font-medium text-slate-800`}>
                      {client.full_name}
                      <span className="block sm:hidden text-xs font-normal text-slate-500">{client.phone_number}</span>
                    </td>
                    <td className={`${tdClass} text-slate-600 hidden md:table-cell`}>{client.cpf}</td>
                    <td className={`${tdClass} text-slate-600 hidden lg:table-cell`}>{client.email}</td>
                    <td className={`${tdClass} text-slate-600 hidden sm:table-cell`}>{client.phone_number}</td>
                    <td className={tdClass}>
                      <div className="flex justify-end gap-1">
                        <IconButton tone="blue" title="Editar" onClick={() => openModal(client)}>
                          <Edit className="w-4 h-4" />
                        </IconButton>
                        {canDelete && (
                          <IconButton tone="red" title="Excluir" onClick={() => handleDelete(client.id)}>
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
