import { createContext, useContext, useState, ReactNode } from 'react';
import { Animal } from '../lib/supabase';

interface AnimalsModalContextData {
  isOpen: boolean;
  editingAnimal: Animal | null;
  openModal: (animal?: Animal) => void;
  closeModal: () => void;
}

const AnimalsModalContext = createContext<AnimalsModalContextData | undefined>(
  undefined
);

interface AnimalsModalProviderProps {
  children: ReactNode;
}

export function AnimalsModalProvider({
  children,
}: AnimalsModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);

  const openModal = (animal?: Animal) => {
    if (animal) {
      setEditingAnimal(animal);
    } else {
      setEditingAnimal(null);
    }
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingAnimal(null);
  };

  return (
    <AnimalsModalContext.Provider
      value={{
        isOpen,
        editingAnimal,
        openModal,
        closeModal,
      }}
    >
      {children}
    </AnimalsModalContext.Provider>
  );
}

export function useAnimalsModal() {
  const context = useContext(AnimalsModalContext);

  if (!context) {
    throw new Error(
      'useAnimalsModal deve ser usado dentro de AnimalsModalProvider'
    );
  }

  return context;
}
