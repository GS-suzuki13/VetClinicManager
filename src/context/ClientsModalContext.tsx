import { createContext, useContext, useState, ReactNode } from 'react';
import { Client } from '../lib/supabase';

interface ClientsModalContextData {
  isOpen: boolean;
  editingClient: Client | null;
  openModal: (client?: Client) => void;
  closeModal: () => void;
}

const ClientsModalContext = createContext<
  ClientsModalContextData | undefined
>(undefined);

export function ClientsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const openModal = (client?: Client) => {
    setEditingClient(client ?? null);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingClient(null);
  };

  return (
    <ClientsModalContext.Provider
      value={{ isOpen, editingClient, openModal, closeModal }}
    >
      {children}
    </ClientsModalContext.Provider>
  );
}

export function useClientsModal() {
  const context = useContext(ClientsModalContext);
  if (!context) {
    throw new Error(
      'useClientsModal deve ser usado dentro de ClientsModalProvider'
    );
  }
  return context;
}
