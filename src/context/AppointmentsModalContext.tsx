import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { Appointment } from '../lib/supabase';

interface AppointmentsModalContextData {
  isOpen: boolean;
  editingAppointment: Appointment | null;
  openModal: (appointment?: Appointment) => void;
  closeModal: () => void;
  // Incrementa a cada gravação; telas com agenda recarregam quando muda.
  savedVersion: number;
  notifySaved: () => void;
}

const AppointmentsModalContext = createContext<AppointmentsModalContextData | undefined>(undefined);

export function AppointmentsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);

  const openModal = useCallback((appointment?: Appointment) => {
    setEditingAppointment(appointment ?? null);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setEditingAppointment(null);
  }, []);

  const notifySaved = useCallback(() => setSavedVersion((v) => v + 1), []);

  return (
    <AppointmentsModalContext.Provider
      value={{ isOpen, editingAppointment, openModal, closeModal, savedVersion, notifySaved }}
    >
      {children}
    </AppointmentsModalContext.Provider>
  );
}

export function useAppointmentsModal() {
  const context = useContext(AppointmentsModalContext);
  if (!context) {
    throw new Error('useAppointmentsModal deve ser usado dentro de AppointmentsModalProvider');
  }
  return context;
}
