import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { Animal } from '../lib/supabase';

interface AnimalsModalContextData {
  isOpen: boolean;
  editingAnimal: Animal | null;
  openModal: (animal?: Animal) => void;
  closeModal: () => void;
  // Incrementa a cada gravação; telas que listam animais recarregam quando muda.
  savedVersion: number;
  notifySaved: () => void;
}

const AnimalsModalContext = createContext<AnimalsModalContextData | undefined>(undefined);

export function AnimalsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);

  const openModal = useCallback((animal?: Animal) => {
    setEditingAnimal(animal ?? null);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setEditingAnimal(null);
  }, []);

  const notifySaved = useCallback(() => setSavedVersion((v) => v + 1), []);

  return (
    <AnimalsModalContext.Provider value={{ isOpen, editingAnimal, openModal, closeModal, savedVersion, notifySaved }}>
      {children}
    </AnimalsModalContext.Provider>
  );
}

export function useAnimalsModal() {
  const context = useContext(AnimalsModalContext);
  if (!context) {
    throw new Error('useAnimalsModal deve ser usado dentro de AnimalsModalProvider');
  }
  return context;
}
