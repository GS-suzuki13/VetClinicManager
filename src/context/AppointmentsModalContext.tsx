import { createContext, useContext, useState, ReactNode } from 'react';
import { Appointment } from '../lib/supabase';

interface AppointmentsModalContextData {
  isOpen: boolean;
  editingAppointment: Appointment | null;
  openModal: (appointment?: Appointment) => void;
  closeModal: () => void;
}

const AppointmentsModalContext = createContext<
  AppointmentsModalContextData | undefined
>(undefined);

export function AppointmentsModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);

  const openModal = (appointment?: Appointment) => {
    setEditingAppointment(appointment ?? null);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingAppointment(null);
  };

  return (
    <AppointmentsModalContext.Provider
      value={{ isOpen, editingAppointment, openModal, closeModal }}
    >
      {children}
    </AppointmentsModalContext.Provider>
  );
}

export function useAppointmentsModal() {
  const context = useContext(AppointmentsModalContext);
  if (!context) {
    throw new Error(
      'useAppointmentsModal deve ser usado dentro de AppointmentsModalProvider'
    );
  }
  return context;
}
