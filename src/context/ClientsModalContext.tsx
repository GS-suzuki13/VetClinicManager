import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { Client } from '../lib/supabase';

interface ClientsModalContextData {
  isOpen: boolean;
  editingClient: Client | null;
  openModal: (client?: Client) => void;
  closeModal: () => void;
  // Incrementa a cada gravação; telas que listam clientes recarregam quando muda.
  savedVersion: number;
  notifySaved: () => void;
}

const ClientsModalContext = createContext<ClientsModalContextData | undefined>(undefined);

export function ClientsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);

  const openModal = useCallback((client?: Client) => {
    setEditingClient(client ?? null);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setEditingClient(null);
  }, []);

  const notifySaved = useCallback(() => setSavedVersion((v) => v + 1), []);

  return (
    <ClientsModalContext.Provider value={{ isOpen, editingClient, openModal, closeModal, savedVersion, notifySaved }}>
      {children}
    </ClientsModalContext.Provider>
  );
}

export function useClientsModal() {
  const context = useContext(ClientsModalContext);
  if (!context) {
    throw new Error('useClientsModal deve ser usado dentro de ClientsModalProvider');
  }
  return context;
}
