import { useEffect, useState } from 'react';
import { supabase, Animal, Client } from '../lib/supabase';
import { useAnimalsModal } from '../context/AnimalsModalContext';
import AnimalsModal from '../components/AnimalsModal';


export default function AnimalsModalContainer() {
  const { isOpen, editingAnimal, closeModal } = useAnimalsModal();

  const [clients, setClients] = useState<Client[]>([]);
  const [showBreeds, setShowBreeds] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    species: 'Dog',
    breed: '',
    age: 0,
    date_of_birth: '',
    weight: 0,
  });

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (editingAnimal) {
      setFormData({
        client_id: editingAnimal.client_id,
        name: editingAnimal.name,
        species: editingAnimal.species,
        breed: editingAnimal.breed,
        age: editingAnimal.age,
        date_of_birth: editingAnimal.date_of_birth,
        weight: editingAnimal.weight,
      });
    } else {
      setFormData({
        client_id: '',
        name: '',
        species: 'Dog',
        breed: '',
        age: 0,
        date_of_birth: '',
        weight: 0,
      });
    }
  }, [editingAnimal]);

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('full_name');
    setClients(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingAnimal) {
      await supabase
        .from('animals')
        .update(formData)
        .eq('id', editingAnimal.id);
    } else {
      await supabase.from('animals').insert([formData]);
    }

    closeModal();
  };

  return (
    <AnimalsModal
      showModal={isOpen}
      editingAnimal={editingAnimal}
      clients={clients}
      formData={formData}
      setFormData={setFormData}
      handleSubmit={handleSubmit}
      closeModal={closeModal}
      showBreeds={showBreeds}
      setShowBreeds={setShowBreeds}
    />
  );
}
