import { useEffect, useState } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { supabase, MedicalRecord, Animal, Client } from '../lib/supabase';
import MedicalRecordModal from '../components/MedicalRecordModal';
import { canDeleteClinicalData, useClinic } from '../context/AuthContext';

type MedicalRecordWithDetails = MedicalRecord & {
  animals: Animal & { clients: Client };
};

export default function MedicalRecordsPage() {
  const canDelete = canDeleteClinicalData(useClinic().role);
  const [records, setRecords] = useState<MedicalRecordWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<MedicalRecordWithDetails | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('medical_records')
      .select('*, animals(*, clients(*))')
      .order('consultation_date', { ascending: false });

    setRecords(data || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditingRecord(null);
    setModalOpen(true);
  };

  const openEdit = (record: MedicalRecordWithDetails) => {
    setEditingRecord(record);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este prontuário?')) return;
    await supabase.from('medical_records').delete().eq('id', id);
    loadRecords();
  };

  const filteredRecords = records.filter(
    (r) =>
      r.animals.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.animals.clients.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 rounded-full border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            placeholder="Buscar por animal ou dono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>

        <button
          onClick={openNew}
          className="ml-4 flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg"
        >
          <Plus className="w-5 h-5" />
          Adicionar Registro
        </button>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {filteredRecords.map((record) => (
          <div
            key={record.id}
            className="bg-white p-6 rounded-xl border shadow-sm"
          >
            <div className="flex justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  {record.animals.name} ({record.animals.species})
                </h3>
                <p className="text-sm text-slate-600">
                  Dono: {record.animals.clients.full_name}
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => openEdit(record)}>
                  <Edit className="w-4 h-4 text-blue-600" />
                </button>
                {canDelete && (
                  <button onClick={() => handleDelete(record.id)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <MedicalRecordModal
          record={editingRecord}
          onClose={() => setModalOpen(false)}
          onSaved={loadRecords}
        />
      )}
    </div>
  );
}
