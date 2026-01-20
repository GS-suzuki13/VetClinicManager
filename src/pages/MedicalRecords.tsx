import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, X, Search } from 'lucide-react';
import { supabase, MedicalRecord, Animal, Client } from '../lib/supabase';

type MedicalRecordWithDetails = MedicalRecord & {
  animals: Animal & { clients: Client };
};

export default function MedicalRecords() {
  const [records, setRecords] = useState<MedicalRecordWithDetails[]>([]);
  const [animals, setAnimals] = useState<(Animal & { clients: Client })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    animal_id: '',
    consultation_date: '',
    symptoms: '',
    diagnosis: '',
    procedures: '',
    prescribed_medication: '',
    observations: '',
    veterinarian_name: '',
  });

  useEffect(() => {
    loadRecords();
    loadAnimals();
  }, []);

  const loadRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('medical_records')
        .select('*, animals(*, clients(*))')
        .order('consultation_date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error loading medical records:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnimals = async () => {
    try {
      const { data, error } = await supabase
        .from('animals')
        .select('*, clients(*)')
        .order('name', { ascending: true });

      if (error) throw error;
      setAnimals(data || []);
    } catch (error) {
      console.error('Error loading animals:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingRecord) {
        const { error } = await supabase
          .from('medical_records')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('medical_records').insert([formData]);

        if (error) throw error;
      }

      loadRecords();
      closeModal();
    } catch (error) {
      console.error('Error saving medical record:', error);
      alert('Error saving medical record. Please check the form and try again.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this medical record?')) {
      return;
    }

    try {
      const { error } = await supabase.from('medical_records').delete().eq('id', id);

      if (error) throw error;
      loadRecords();
    } catch (error) {
      console.error('Error deleting medical record:', error);
      alert('Error deleting medical record.');
    }
  };

  const openModal = (record?: MedicalRecordWithDetails) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        animal_id: record.animal_id,
        consultation_date: record.consultation_date.split('T')[0],
        symptoms: record.symptoms,
        diagnosis: record.diagnosis,
        procedures: record.procedures,
        prescribed_medication: record.prescribed_medication,
        observations: record.observations,
        veterinarian_name: record.veterinarian_name,
      });
    } else {
      setEditingRecord(null);
      setFormData({
        animal_id: '',
        consultation_date: new Date().toISOString().split('T')[0],
        symptoms: '',
        diagnosis: '',
        procedures: '',
        prescribed_medication: '',
        observations: '',
        veterinarian_name: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecord(null);
    setFormData({
      animal_id: '',
      consultation_date: new Date().toISOString().split('T')[0],
      symptoms: '',
      diagnosis: '',
      procedures: '',
      prescribed_medication: '',
      observations: '',
      veterinarian_name: '',
    });
  };

  const filteredRecords = records.filter(
    (record) =>
      record.animals.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.animals.clients.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.veterinarian_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
            placeholder="Pesquise por animal, dono ou diagnóstico..."
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
          Adicionar Registro
        </button>
      </div>

      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
            Nenhum registro médico encontrado. Clique em "Adicionar Registro" para criar o primeiro registro.
          </div>
        ) : (
          filteredRecords.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {record.animals.name} ({record.animals.species})
                  </h3>
                  <p className="text-sm text-slate-600">
                    Dono: {record.animals.clients.full_name}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {formatDate(record.consultation_date)} • Dr. {record.veterinarian_name}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openModal(record)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(record.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Sintomas</p>
                  <p className="text-sm text-slate-600">{record.symptoms}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Diagnóstico</p>
                  <p className="text-sm text-slate-600">{record.diagnosis}</p>
                </div>
                {record.procedures && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">Procedimentos</p>
                    <p className="text-sm text-slate-600">{record.procedures}</p>
                  </div>
                )}
                {record.prescribed_medication && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">Medicamento</p>
                    <p className="text-sm text-slate-600">{record.prescribed_medication}</p>
                  </div>
                )}
              </div>

              {record.observations && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-1">Observações</p>
                  <p className="text-sm text-slate-600">{record.observations}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-800">
                {editingRecord ? 'Editar Prontuário' : 'Adicionar Novo Prontuário'}
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Animal *</label>
                <select
                  required
                  value={formData.animal_id}
                  onChange={(e) => setFormData({ ...formData, animal_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione o animal</option>
                  {animals.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animal.name} - {animal.species} (Dono: {animal.clients.full_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Data da Consulta *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.consultation_date}
                    onChange={(e) =>
                      setFormData({ ...formData, consultation_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nome do(a) Veterinário(a) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.veterinarian_name}
                    onChange={(e) =>
                      setFormData({ ...formData, veterinarian_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sintomas *</label>
                <textarea
                  required
                  value={formData.symptoms}
                  onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Diagnóstico *
                </label>
                <textarea
                  required
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Procedimentos</label>
                <textarea
                  value={formData.procedures}
                  onChange={(e) => setFormData({ ...formData, procedures: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prescrição Médica
                </label>
                <textarea
                  value={formData.prescribed_medication}
                  onChange={(e) =>
                    setFormData({ ...formData, prescribed_medication: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observação
                </label>
                <textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
                >
                  {editingRecord ? 'Atualizar' : 'Criar Prontuário'}
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
      )}
    </div>
  );
}
