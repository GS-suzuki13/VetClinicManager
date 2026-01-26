import { createContext, useContext, useState, ReactNode } from 'react';
import { Animal } from '../lib/supabase';

interface AnimalFormData {
  name: string;
  species: string;
  breed: string;
  weight: string;
  date_of_birth: string;
  client_id: string;
}

interface AnimalsModalContextData {
  isOpen: boolean;
  editingAnimal: Animal | null;
  formData: AnimalFormData;
  setFormData: React.Dispatch<React.SetStateAction<AnimalFormData>>;
  openModal: (animal?: Animal) => void;
  closeModal: () => void;
}

const initialFormData: AnimalFormData = {
  name: '',
  species: '',
  breed: '',
  weight: '',
  date_of_birth: '',
  client_id: '',
};

const AnimalsModalContext = createContext<AnimalsModalContextData | undefined>(
  undefined
);

export function AnimalsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [formData, setFormData] = useState<AnimalFormData>(initialFormData);

  const openModal = (animal?: Animal) => {
    if (animal) {
      setEditingAnimal(animal);
      setFormData({
        name: animal.name,
        species: animal.species,
        breed: animal.breed || '',
        weight: animal.weight?.toString() || '',
        date_of_birth: animal.date_of_birth || '',
        client_id: animal.client_id,
      });
    } else {
      setEditingAnimal(null);
      setFormData(initialFormData);
    }

    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);

    setEditingAnimal(null);
    setFormData(initialFormData);
  };

  return (
    <AnimalsModalContext.Provider
      value={{
        isOpen,
        editingAnimal,
        formData,
        setFormData,
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
