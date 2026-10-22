import { FormEvent, useState } from 'react';
import { supabase, Client } from '../lib/supabase';
import { dbErrorMessage } from '../lib/format';
import { useClientsModal } from '../context/ClientsModalContext';
import Modal, { FormActions, FormError, fieldClass, labelClass } from './Modal';

type ClientForm = Pick<Client, 'full_name' | 'cpf' | 'email' | 'phone_number' | 'date_of_birth' | 'residential_address'>;

const emptyForm: ClientForm = {
  full_name: '',
  cpf: '',
  email: '',
  phone_number: '',
  date_of_birth: '',
  residential_address: '',
};

export default function ClientsModal() {
  const { isOpen, editingClient } = useClientsModal();
  if (!isOpen) return null;
  // key: o formulário reinicia a cada abertura.
  return <ClientFormModal key={editingClient?.id ?? 'new'} editingClient={editingClient} />;
}

function ClientFormModal({ editingClient }: { editingClient: Client | null }) {
  const { closeModal, notifySaved } = useClientsModal();
  const [formData, setFormData] = useState<ClientForm>(() =>
    editingClient
      ? {
          full_name: editingClient.full_name,
          cpf: editingClient.cpf,
          email: editingClient.email,
          phone_number: editingClient.phone_number,
          date_of_birth: editingClient.date_of_birth,
          residential_address: editingClient.residential_address,
        }
      : emptyForm
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof ClientForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = editingClient
      ? await supabase.from('clients').update(formData).eq('id', editingClient.id)
      : await supabase.from('clients').insert(formData);

    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível salvar o cliente.'));
      return;
    }
    notifySaved();
    closeModal();
  };

  return (
    <Modal title={editingClient ? 'Editar Cliente' : 'Adicionar Cliente'} onClose={closeModal}>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />

        <div>
          <label className={labelClass}>Nome Completo *</label>
          <input type="text" required value={formData.full_name} onChange={set('full_name')} className={fieldClass} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>CPF *</label>
            <input type="text" required value={formData.cpf} onChange={set('cpf')} placeholder="000.000.000-00" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Data de Nascimento *</label>
            <input type="date" required value={formData.date_of_birth} onChange={set('date_of_birth')} className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Email *</label>
            <input type="email" required value={formData.email} onChange={set('email')} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Telefone *</label>
            <input type="tel" required value={formData.phone_number} onChange={set('phone_number')} placeholder="(00) 00000-0000" className={fieldClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Endereço *</label>
          <input
            type="text"
            required
            value={formData.residential_address}
            onChange={set('residential_address')}
            placeholder="Rua, número, bairro, cidade - estado"
            className={fieldClass}
          />
        </div>

        <FormActions submitLabel={editingClient ? 'Atualizar Cliente' : 'Criar Cliente'} onCancel={closeModal} busy={busy} />
      </form>
    </Modal>
  );
}
