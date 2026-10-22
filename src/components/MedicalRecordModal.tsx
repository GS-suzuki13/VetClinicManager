import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase, MedicalRecord, Animal, Client } from '../lib/supabase';

interface Props {
    record: (MedicalRecord & { animals?: Animal & { clients?: Client } }) | null;
    onClose: () => void;
    onSaved: () => void;
}

export default function MedicalRecordModal({ record, onClose, onSaved }: Props) {
    const [clients, setClients] = useState<Client[]>([]);
    const [animals, setAnimals] = useState<Animal[]>([]);
    const [selectedClient, setSelectedClient] = useState('');

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
        loadClients();

        if (record) {
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

            if (record.animals?.clients?.id) {
                setSelectedClient(record.animals.clients.id);
                loadAnimals(record.animals.clients.id);
            }
        }
    }, [record]);

    const loadClients = async () => {
        const { data } = await supabase
            .from('clients')
            .select('*')
            .order('full_name');
        setClients(data || []);
    };

    const loadAnimals = async (clientId: string) => {
        const { data } = await supabase
            .from('animals')
            .select('*')
            .eq('client_id', clientId)
            .order('name');

        setAnimals(data || []);
    };

    const handleClientChange = (clientId: string) => {
        setSelectedClient(clientId);
        setFormData((p) => ({ ...p, animal_id: '' }));
        loadAnimals(clientId);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (record) {
            await supabase
                .from('medical_records')
                .update({ ...formData, updated_at: new Date().toISOString() })
                .eq('id', record.id);
        } else {
            await supabase.from('medical_records').insert([formData]);
        }

        onSaved();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl">
                <div className="flex justify-between items-center p-6 border-b">
                    <h3 className="text-xl font-semibold">
                        {record ? 'Editar Prontuário' : 'Novo Prontuário'}
                    </h3>
                    <button onClick={onClose}>
                        <X />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Dono */}
                    <div>
                        <label className="text-sm font-medium">Dono *</label>
                        <select
                            required
                            value={selectedClient}
                            onChange={(e) => handleClientChange(e.target.value)}
                            className="w-full border rounded px-3 py-2"
                        >
                            <option value="">Selecione o dono</option>
                            {clients.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.full_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Animal */}
                    <div>
                        <label className="text-sm font-medium">Animal *</label>
                        <select
                            required
                            value={formData.animal_id}
                            onChange={(e) =>
                                setFormData({ ...formData, animal_id: e.target.value })
                            }
                            className="w-full border rounded px-3 py-2"
                            disabled={!selectedClient}
                        >
                            <option value="">Selecione o animal</option>
                            {animals.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name} ({a.species})
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
                        <button className="flex-1 bg-emerald-500 text-white py-2 rounded">
                            {record ? 'Atualizar' : 'Criar'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 rounded"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
