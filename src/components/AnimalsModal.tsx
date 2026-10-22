import { FormEvent, useEffect, useState } from 'react';
import { supabase, Animal, Client } from '../lib/supabase';
import { dbErrorMessage } from '../lib/format';
import { useAnimalsModal } from '../context/AnimalsModalContext';
import Modal, { FormActions, FormError, fieldClass, labelClass } from './Modal';

const BREEDS = [
  'Akita',
  'American Bully',
  'American Pit Bull Terrier',
  'Basset Hound',
  'Beagle',
  'Bernese Mountain Dog (Boiadeiro de Berna)',
  'Bichon Frisé',
  'Border Collie',
  'Boston Terrier',
  'Boxer',
  'Bull Terrier',
  'Bulldog Francês',
  'Bulldog Inglês',
  'Cane Corso',
  'Chihuahua',
  'Chow Chow',
  'Cocker Spaniel Inglês',
  'Dachshund (Salsisha)',
  'Dálmata',
  'Doberman',
  'Dogo Argentino',
  'Fila Brasileiro',
  'Golden Retriever',
  'Grande Dinamarquês',
  'Greyhound (Galgo Inglês)',
  'Husky Siberiano',
  'Jack Russell Terrier',
  'Labrador Retriever',
  'Lhasa Apso',
  'Maltês',
  'Mastiff Inglês',
  'Pastor Alemão',
  'Pastor Australiano',
  'Pastor de Shetland',
  'Pequinês',
  'Pinscher',
  'Poodle',
  'Pug',
  'Rottweiler',
  'Samoieda',
  'São Bernardo',
  'Schnauzer',
  'Shar Pei',
  'Shiba Inu',
  'Shih Tzu',
  'SRD (Sem Raça Definida)',
  'Staffordshire Bull Terrier',
  'Weimaraner',
  'West Highland White Terrier',
  'Whippet',
  'Yorkshire Terrier',
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

type AnimalForm = Pick<Animal, 'client_id' | 'name' | 'species' | 'breed' | 'age' | 'date_of_birth' | 'weight'>;

const emptyForm: AnimalForm = {
  client_id: '',
  name: '',
  species: 'Dog',
  breed: '',
  age: 0,
  date_of_birth: '',
  weight: 0,
};

export default function AnimalsModal() {
  const { isOpen, editingAnimal } = useAnimalsModal();
  if (!isOpen) return null;
  return <AnimalFormModal key={editingAnimal?.id ?? 'new'} editingAnimal={editingAnimal} />;
}

function AnimalFormModal({ editingAnimal }: { editingAnimal: Animal | null }) {
  const { closeModal, notifySaved } = useAnimalsModal();
  const [clients, setClients] = useState<Client[]>([]);
  const [showBreeds, setShowBreeds] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AnimalForm>(() =>
    editingAnimal
      ? {
          client_id: editingAnimal.client_id,
          name: editingAnimal.name,
          species: editingAnimal.species,
          breed: editingAnimal.breed,
          age: editingAnimal.age,
          date_of_birth: editingAnimal.date_of_birth,
          weight: editingAnimal.weight,
        }
      : emptyForm
  );

  // Carrega a cada abertura para incluir tutores cadastrados há pouco.
  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .order('full_name')
      .then(({ data }) => setClients(data ?? []));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = editingAnimal
      ? await supabase.from('animals').update(formData).eq('id', editingAnimal.id)
      : await supabase.from('animals').insert(formData);

    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível salvar o animal.'));
      return;
    }
    notifySaved();
    closeModal();
  };

  const breedQuery = formData.breed.toLowerCase();

  return (
    <Modal title={editingAnimal ? 'Editar Animal' : 'Adicionar Animal'} onClose={closeModal}>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />

        <div>
          <label className={labelClass}>Dono *</label>
          <select
            required
            value={formData.client_id}
            onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
            className={fieldClass}
          >
            <option value="">Selecione o Dono</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Espécie *</label>
            <select
              required
              value={formData.species}
              onChange={(e) => setFormData({ ...formData, species: e.target.value as Animal['species'] })}
              className={fieldClass}
            >
              <option value="Dog">Cachorro</option>
              <option value="Cat">Gato</option>
            </select>
          </div>
        </div>

        <div className="relative">
          <label className={labelClass}>Raça *</label>
          <input
            type="text"
            required
            value={formData.breed}
            onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
            onFocus={() => setShowBreeds(true)}
            onBlur={() => setTimeout(() => setShowBreeds(false), 150)}
            placeholder="Comece a digitar a raça"
            className={fieldClass}
          />
          {showBreeds && (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-300 bg-white shadow-lg">
              {BREEDS.filter((breed) => breed.toLowerCase().includes(breedQuery)).map((breed) => (
                <li
                  key={breed}
                  onMouseDown={() => {
                    setFormData({ ...formData, breed });
                    setShowBreeds(false);
                  }}
                  className="cursor-pointer px-3 py-2 hover:bg-emerald-50 text-sm"
                >
                  {breed}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Idade (anos) *</label>
            <input
              type="number"
              required
              min="0"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Nascimento *</label>
            <input
              type="date"
              required
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Peso (kg) *</label>
            <input
              type="number"
              required
              step="0.01"
              min="0.01"
              value={formData.weight || ''}
              onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
              className={fieldClass}
            />
          </div>
        </div>

        <FormActions submitLabel={editingAnimal ? 'Atualizar' : 'Registrar Animal'} onCancel={closeModal} busy={busy} />
      </form>
    </Modal>
  );
}
