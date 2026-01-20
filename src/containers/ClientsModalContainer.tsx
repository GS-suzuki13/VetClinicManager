import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useClientsModal } from '../context/ClientsModalContext';
import ClientsModal from '../components/ClientsModal';


const initialForm = {
  full_name: '',
  cpf: '',
  email: '',
  phone_number: '',
  date_of_birth: '',
  residential_address: '',
};

export default function ClientsModalContainer() {
  const { isOpen, editingClient, closeModal } = useClientsModal();
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (editingClient) {
      setFormData(editingClient);
    } else {
      setFormData(initialForm);
    }
  }, [editingClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingClient) {
      await supabase
        .from('clients')
        .update(formData)
        .eq('id', editingClient.id);
    } else {
      await supabase.from('clients').insert(formData);
    }

    closeModal();
  };

  return (
    <ClientsModal
      showModal={isOpen}
      editingClient={editingClient}
      formData={formData}
      setFormData={setFormData}
      handleSubmit={handleSubmit}
      closeModal={closeModal}
    />
  );
}
