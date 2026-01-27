import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, X, Search, FileText } from 'lucide-react';
import { supabase, Animal, Client } from '../lib/supabase';
import AnimalsModal from '../components/AnimalsModal';
import AnimalProfileModal from '../components/AnimalProfileModal';

type AnimalWithClient = Animal & { clients: Client };

export default function Animals() {
  const [animals, setAnimals] = useState<AnimalWithClient[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalWithClient | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showVaccinesModal, setShowVaccinesModal] = useState(false);
  const [showMedicalRecordsModal, setShowMedicalRecordsModal] = useState(false);
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBreeds, setShowBreeds] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    species: 'Dog' as 'Dog' | 'Cat',
    breed: '',
    age: 0,
    date_of_birth: '',
    weight: 0,
  });

  useEffect(() => {
    loadAnimals();
    loadClients();
  }, []);

  const loadAnimals = async () => {
    try {
      const { data, error } = await supabase
        .from('animals')
        .select('*, clients(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnimals(data || []);
    } catch (error) {
      console.error('Error loading animals:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingAnimal) {
        const { error } = await supabase
          .from('animals')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingAnimal.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('animals').insert([formData]);

        if (error) throw error;
      }

      loadAnimals();
      closeModal();
    } catch (error) {
      console.error('Error saving animal:', error);
      alert('Error saving animal. Please check the form and try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza de que deseja excluir este animal? Isso também excluirá todos os registros médicos associados.')) {
      return;
    }

    try {
      const { error } = await supabase.from('animals').delete().eq('id', id);

      if (error) throw error;
      loadAnimals();
    } catch (error) {
      console.error('Error deleting animal:', error);
      alert('Error deleting animal.');
    }
  };

  const openModal = (animal?: AnimalWithClient) => {
    if (animal) {
      setEditingAnimal(animal);
      setFormData({
        client_id: animal.client_id,
        name: animal.name,
        species: animal.species,
        breed: animal.breed,
        age: animal.age,
        date_of_birth: animal.date_of_birth,
        weight: animal.weight,
      });
    } else {
      setEditingAnimal(null);
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
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAnimal(null);
    setFormData({
      client_id: '',
      name: '',
      species: 'Dog',
      breed: '',
      age: 0,
      date_of_birth: '',
      weight: 0,
    });
  };


  const openVaccinesModal = () => setShowVaccinesModal(true);
  const openMedicalRecordsModal = () => setShowMedicalRecordsModal(true);
  const openAppointmentsModal = () => setShowAppointmentsModal(true);
  const openAnimalProfile = (animal: AnimalWithClient) =>{
    setSelectedAnimal(animal);
    setShowProfileModal(true);
  }
  
  const closeVaccinesModal = () => setShowVaccinesModal(false);
  const closeMedicalRecordsModal = () => setShowMedicalRecordsModal(false);
  const closeAppointmentsModal = () => setShowAppointmentsModal(false);
  const closeAnimalProfile = () =>{
    setSelectedAnimal(null);
    setShowProfileModal(false);
  }

  const filteredAnimals = animals.filter(
    (animal) =>
      animal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      animal.breed.toLowerCase().includes(searchTerm.toLowerCase()) ||
      animal.clients.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Procure animais por nome, raça ou dono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <button
          onClick={() => openModal()}
          className="ml-4 flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Adicionar Animal
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Espécie
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Raça
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Idade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Dono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAnimals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Nenhum animal encontrado. Clique em "Adicionar animal" para registrar seu primeiro animal de estimação.
                  </td>
                </tr>
              ) : (
                filteredAnimals.map((animal) => (
                  <tr
                      key={animal.id}
                      onClick={() => openAnimalProfile(animal)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      {animal.name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          animal.species === 'Dog'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {animal.species === 'Dog' ? 'Cachorro' : 'Gato'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{animal.breed}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{animal.age} anos</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {animal.clients.full_name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="View Medical Records"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                             openModal(animal)
                            }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(animal.id)
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimalsModal
        showModal={showModal}
        editingAnimal={editingAnimal}
        clients={clients}
        formData={formData}
        setFormData={setFormData}
        handleSubmit={handleSubmit}
        closeModal={closeModal}
        showBreeds={showBreeds}
        setShowBreeds={setShowBreeds}
      />
      
      {showProfileModal && selectedAnimal && (
        <div>
          <AnimalProfileModal
            animal={selectedAnimal}
            onClose={closeAnimalProfile}
            onOpenVaccines={openVaccinesModal}
            onOpenMedicalRecords={openMedicalRecordsModal}
            onOpenAppointments={openAppointmentsModal}
          />
        </div>
      )}

      {showVaccinesModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl">
            <p className="font-medium">Modal de Vacinação (em breve)</p>
            <button onClick={closeVaccinesModal} className="mt-4 text-emerald-600">
              Fechar
            </button>
          </div>
        </div>
      )}

      {showMedicalRecordsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl">
            <p className="font-medium">Modal de Prontuários (em breve)</p>
            <button onClick={closeMedicalRecordsModal} className="mt-4 text-blue-600">
              Fechar
            </button>
          </div>
        </div>
      )}

      {showAppointmentsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl">
            <p className="font-medium">Modal de Agendamentos (em breve)</p>
            <button onClick={closeAppointmentsModal} className="mt-4 text-purple-600">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
