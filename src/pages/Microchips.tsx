import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Building2, Cpu, Plus, ScanLine, Search } from 'lucide-react';
import { supabase, Animal, Client, Microchip, MicrochipStatus } from '../lib/supabase';
import { formatDate } from '../lib/format';
import { describeChipCode, formatChipCode, microchipStatusLabel, microchipStatusStyle, normalizeChipCode } from '../lib/microchip';
import MicrochipModal from '../components/MicrochipModal';
import MicrochipHistoryModal from '../components/MicrochipHistoryModal';
import { PageLoader, tdClass, thClass } from '../components/PageToolbar';

type MicrochipRow = Microchip & {
  animals: (Pick<Animal, 'id' | 'name' | 'species'> & { clients: Pick<Client, 'full_name'> | null }) | null;
};

type ModalState =
  | { kind: 'form'; chip: Microchip | null; initialCode?: string }
  | { kind: 'history'; chip: Microchip }
  | null;

interface ScanResult {
  code: string;
  otherClinics: string[];
  error?: string;
}

export default function Microchips() {
  const [chips, setChips] = useState<MicrochipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<MicrochipStatus | 'all' | 'unlinked' | 'unregistered'>('all');
  const scanRef = useRef<HTMLInputElement>(null);

  const loadChips = useCallback(async () => {
    const { data, error } = await supabase
      .from('microchips')
      .select('*, animals(id, name, species, clients(full_name))')
      .order('created_at', { ascending: false });
    if (error) console.error('Erro ao carregar microchips:', error);
    setChips((data as MicrochipRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadChips();
  }, [loadChips]);

  // Leitores USB/Bluetooth funcionam como teclado: digitam o número e enviam Enter.
  const handleScan = async (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeChipCode(scanInput);
    if (!code) return;
    setScanResult(null);

    const info = describeChipCode(code);
    if (!info.valid) {
      setScanResult({ code, otherClinics: [], error: info.warning ?? 'Código inválido.' });
      return;
    }

    const own = chips.find((c) => c.code === code);
    if (own) {
      setScanInput('');
      setModal({ kind: 'history', chip: own });
      return;
    }

    setScanning(true);
    const { data, error } = await supabase.rpc('lookup_microchip', { p_code: code });
    setScanning(false);
    setScanResult({
      code,
      otherClinics: ((data as { clinic_name: string; own_clinic: boolean }[]) ?? []).filter((r) => !r.own_clinic).map((r) => r.clinic_name),
      error: error ? 'Não foi possível consultar outras clínicas.' : undefined,
    });
  };

  const closeModal = () => {
    setModal(null);
    scanRef.current?.focus();
  };

  const term = filter.toLowerCase();
  const filtered = chips.filter((c) => {
    const matchesText =
      c.code.toLowerCase().includes(normalizeChipCode(filter).toLowerCase() || term) ||
      c.animals?.name.toLowerCase().includes(term) ||
      c.animals?.clients?.full_name.toLowerCase().includes(term);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'unlinked' && !c.animal_id) ||
      (statusFilter === 'unregistered' && c.status === 'active' && !c.external_registry) ||
      c.status === statusFilter;
    return matchesText && matchesStatus;
  });

  if (loading) return <PageLoader />;

  const stats = [
    { label: 'Chips ativos', value: chips.filter((c) => c.status === 'active').length, filter: 'active' as const },
    { label: 'Sem animal vinculado', value: chips.filter((c) => !c.animal_id).length, filter: 'unlinked' as const },
    {
      label: 'Ativos sem registro externo',
      value: chips.filter((c) => c.status === 'active' && !c.external_registry).length,
      filter: 'unregistered' as const,
    },
    { label: 'Sem leitura / defeito', value: chips.filter((c) => c.status === 'defective').length, filter: 'defective' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Leitor */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <ScanLine className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-800">Ler microchip</h2>
        </div>
        <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              ref={scanRef}
              autoFocus
              autoComplete="off"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Aproxime o leitor ou digite o número e pressione Enter"
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={scanning}
            className="px-5 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60 font-medium"
          >
            {scanning ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        {scanResult && (
          <div
            role="status"
            className={`mt-4 rounded-lg border p-4 text-sm ${scanResult.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
          >
            {scanResult.error ? (
              <p className="flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {scanResult.error}
              </p>
            ) : (
              <div className="space-y-3">
                <p>
                  <span className="font-mono font-semibold">{formatChipCode(scanResult.code)}</span> não está cadastrado nesta clínica.
                </p>
                {scanResult.otherClinics.length > 0 ? (
                  <div className="rounded-lg bg-white border border-amber-200 p-3 text-slate-700">
                    <p className="font-medium flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600" /> Chip localizado em outra clínica VetClinic:
                    </p>
                    <ul className="mt-1 list-disc list-inside">
                      {scanResult.otherClinics.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-slate-500">
                      Por privacidade, apenas o nome da clínica é exibido. Entre em contato com ela para localizar o tutor.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs">
                    Nenhuma outra clínica VetClinic compartilhou este chip. Consulte também o SinPatinhas e o banco de dados do fabricante.
                  </p>
                )}
                <button
                  onClick={() => setModal({ kind: 'form', chip: null, initialCode: scanResult.code })}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium"
                >
                  <Plus className="w-4 h-4" /> Registrar este chip
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={() => setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
            className={`text-left bg-white rounded-xl border p-4 transition-shadow hover:shadow-md ${
              statusFilter === s.filter ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'
            }`}
          >
            <p className="text-xs sm:text-sm text-slate-600">{s.label}</p>
            <p className="text-2xl font-bold text-slate-800">{s.value}</p>
          </button>
        ))}
      </div>

      {/* Lista */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por código, animal ou tutor..."
            className="flex-1 sm:max-w-md px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todos</option>
            {Object.entries(microchipStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="unlinked">Sem animal vinculado</option>
            <option value="unregistered">Ativos sem registro externo</option>
          </select>
          <button
            onClick={() => setModal({ kind: 'form', chip: null })}
            className="sm:ml-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium whitespace-nowrap"
          >
            <Plus className="w-5 h-5" /> Registrar Microchip
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={thClass}>Código</th>
                  <th className={`${thClass} hidden sm:table-cell`}>Animal</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} hidden md:table-cell`}>Implantação</th>
                  <th className={`${thClass} hidden lg:table-cell`}>Registro externo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      <Cpu className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      Nenhum microchip encontrado. Leia um chip acima ou clique em "Registrar Microchip".
                    </td>
                  </tr>
                ) : (
                  filtered.map((chip) => (
                    <tr key={chip.id} onClick={() => setModal({ kind: 'history', chip })} className="hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className={`${tdClass} font-mono text-slate-800`}>
                        {formatChipCode(chip.code)}
                        <span className="block sm:hidden font-sans text-xs text-slate-500">{chip.animals?.name ?? 'Sem vínculo'}</span>
                      </td>
                      <td className={`${tdClass} hidden sm:table-cell`}>
                        {chip.animals ? (
                          <>
                            <span className="font-medium text-slate-800">{chip.animals.name}</span>
                            <span className="block text-xs text-slate-500">{chip.animals.clients?.full_name}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">Sem vínculo</span>
                        )}
                      </td>
                      <td className={tdClass}>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${microchipStatusStyle[chip.status]}`}>
                          {microchipStatusLabel[chip.status]}
                        </span>
                      </td>
                      <td className={`${tdClass} text-slate-600 hidden md:table-cell`}>{formatDate(chip.implanted_at)}</td>
                      <td className={`${tdClass} text-slate-600 hidden lg:table-cell`}>
                        {chip.external_registry ?? <span className="text-amber-600">Pendente</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal?.kind === 'form' && (
        <MicrochipModal
          microchip={modal.chip}
          initialCode={modal.initialCode}
          onClose={closeModal}
          onSaved={(saved) => {
            setScanResult(null);
            setScanInput('');
            loadChips();
            if (modal.chip) setModal({ kind: 'history', chip: saved });
          }}
        />
      )}
      {modal?.kind === 'history' && (
        <MicrochipHistoryModal
          microchip={modal.chip}
          onClose={closeModal}
          onEdit={() => setModal({ kind: 'form', chip: modal.chip })}
          onChanged={loadChips}
        />
      )}
    </div>
  );
}
