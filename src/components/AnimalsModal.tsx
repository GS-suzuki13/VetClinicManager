import { X } from 'lucide-react';
import { Animal, Client } from '../lib/supabase';

interface Props {
  showModal: boolean;
  editingAnimal: Animal | null;
  clients: Client[];
  formData: any;
  setFormData: (data: any) => void;
  handleSubmit: (e: React.FormEvent) => void;
  closeModal: () => void;
  showBreeds: boolean;
  setShowBreeds: (value: boolean) => void;
}

export default function AnimalsModal({
  showModal,
  editingAnimal,
  clients,
  formData,
  setFormData,
  handleSubmit,
  closeModal,
  showBreeds,
  setShowBreeds,
}: Props) {
  if (!showModal) return null;

  const BREEDS = [
      "Akita",
      "American Bully",
      "American Pit Bull Terrier",
      "Basset Hound",
      "Beagle",
      "Bernese Mountain Dog (Boiadeiro de Berna)",
      "Bichon Frisé",
      "Border Collie",
      "Boston Terrier",
      "Boxer",
      "Bull Terrier",
      "Bulldog Francês",
      "Bulldog Inglês",
      "Cane Corso",
      "Chihuahua",
      "Chow Chow",
      "Cocker Spaniel Inglês",
      "Dachshund (Salsisha)",
      "Dálmata",
      "Doberman",
      "Dogo Argentino",
      "Fila Brasileiro",
      "Golden Retriever",
      "Grande Dinamarquês",
      "Greyhound (Galgo Inglês)",
      "Husky Siberiano",
      "Jack Russell Terrier",
      "Labrador Retriever",
      "Lhasa Apso",
      "Maltês",
      "Mastiff Inglês",
      "Pastor Alemão",
      "Pastor Australiano",
      "Pastor de Shetland",
      "Pequinês",
      "Pinscher",
      "Poodle",
      "Pug",
      "Rottweiler",
      "Samoieda",
      "São Bernardo",
      "Schnauzer",
      "Shar Pei",
      "Shiba Inu",
      "Shih Tzu",
      "SRD (Sem Raça Definida)",
      "Staffordshire Bull Terrier",
      "Weimaraner",
      "West Highland White Terrier",
      "Whippet",
      "Yorkshire Terrier",
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-800">
            {editingAnimal ? 'Editar Animal' : 'Adicionar Animal'}
          </h3>
          <button
            onClick={closeModal}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dono *</label>
            <select
              required
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecione o Dono</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Espécie *</label>
            <select
              required
              value={formData.species}
              onChange={(e) =>
                setFormData({ ...formData, species: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Dog">Cachorro</option>
              <option value="Cat">Gato</option>
            </select>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Raça *
            </label>

            <input
              type="text"
              required
              value={formData.breed}
              onChange={(e) =>
                setFormData({ ...formData, breed: e.target.value })
              }
              onFocus={() => setShowBreeds(true)}
              placeholder="Comece a digitar a raça"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {showBreeds && (
              <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-300 bg-white shadow-lg">
                {BREEDS.filter((breed) =>
                  breed.toLowerCase().includes(formData.breed.toLowerCase())
                )
                  .slice(0, 100)
                  .map((breed) => (
                    <li
                      key={breed}
                      onClick={() => {
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Idade *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.age}
                onChange={(e) =>
                  setFormData({ ...formData, age: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data de nascimento *
              </label>
              <input
                type="date"
                required
                value={formData.date_of_birth}
                onChange={(e) =>
                  setFormData({ ...formData, date_of_birth: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Peso (kg) *
            </label>
            <input
              type="number"
              required
              step="0.01"
              min="0"
              value={formData.weight}
              onChange={(e) =>
                setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
            >
              {editingAnimal ? 'Atualizar' : 'Registrar Animal'}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
