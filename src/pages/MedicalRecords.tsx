import { useCallback, useEffect, useState } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { supabase, MedicalRecord, Animal, Client } from '../lib/supabase';
import { dbErrorMessage, formatDate, speciesLabel } from '../lib/format';
import MedicalRecordModal from '../components/MedicalRecordModal';
import PageToolbar, { IconButton, PageLoader } from '../components/PageToolbar';
import { canDeleteClinicalData, useClinic } from '../context/AuthContext';
import { askConfirm, notify } from '../lib/dialogs';

type MedicalRecordWithDetails = MedicalRecord & {
  animals: Animal & { clients: Client };
};

export default function MedicalRecordsPage() {
  const canDelete = canDeleteClinicalData(useClinic().role);
  const [records, setRecords] = useState<MedicalRecordWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecordWithDetails | null>(null);

  const loadRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from('medical_records')
      .select('*, animals(*, clients(*))')
      .order('consultation_date', { ascending: false });
    if (error) console.error('Erro ao carregar prontuários:', error);
    setRecords(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const openModal = (record: MedicalRecordWithDetails | null) => {
    setEditingRecord(record);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await askConfirm('Deseja excluir este prontuário?', { danger: true, title: 'Excluir', confirmLabel: 'Excluir' }))) return;
    const { error } = await supabase.from('medical_records').delete().eq('id', id);
    if (error) notify(dbErrorMessage(error, 'Erro ao excluir o prontuário.'));
    else loadRecords();
  };

  const term = searchTerm.toLowerCase();
  const filteredRecords = records.filter(
    (r) => r.animals.name.toLowerCase().includes(term) || r.animals.clients.full_name.toLowerCase().includes(term)
  );

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageToolbar
        search={searchTerm}
        onSearch={setSearchTerm}
        placeholder="Buscar por animal ou dono..."
        actionLabel="Adicionar Registro"
        onAction={() => openModal(null)}
      />

      <div className="space-y-4">
        {filteredRecords.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
            Nenhum prontuário encontrado.
          </div>
        )}

        {filteredRecords.map((record) => (
          <div key={record.id} className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-lg text-slate-800">
                  {record.animals.name} ({speciesLabel[record.animals.species]})
                </h3>
                <p className="text-sm text-slate-600">
                  Dono: {record.animals.clients.full_name} • {formatDate(record.consultation_date)} • {record.veterinarian_name}
                </p>
                <p className="text-sm text-slate-700 mt-2 break-words">
                  <span className="font-medium">Diagnóstico: </span>
                  {record.diagnosis}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                <IconButton tone="blue" title="Editar" onClick={() => openModal(record)}>
                  <Edit className="w-4 h-4" />
                </IconButton>
                {canDelete && (
                  <IconButton tone="red" title="Excluir" onClick={() => handleDelete(record.id)}>
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && <MedicalRecordModal record={editingRecord} onClose={() => setModalOpen(false)} onSaved={loadRecords} />}
    </div>
  );
}
