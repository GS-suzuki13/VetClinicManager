import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { supabase, Animal, Client, Sale, SaleStatus } from '../lib/supabase';
import { todayISO } from '../lib/format';
import { formatBRL, formatDateTime } from '../lib/money';
import PageToolbar, { PageLoader, tdClass, thClass } from '../components/PageToolbar';
import SaleModal, { SaleContext } from '../components/SaleModal';
import { Badge, EmptyRow, SecondaryButton, StatTile, Tabs } from '../components/ui';

type SaleRow = Sale & { clients: Pick<Client, 'full_name'> | null; animals: Pick<Animal, 'name'> | null };

const statusInfo: Record<SaleStatus, { label: string; style: string }> = {
  quote: { label: 'Orçamento', style: 'bg-blue-100 text-blue-700' },
  open: { label: 'Em aberto', style: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Finalizada', style: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', style: 'bg-red-100 text-red-700' },
};

export default function Sales() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SaleStatus>('open');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ saleId: string | null; context?: SaleContext } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('sales')
      .select('*, clients(full_name), animals(name)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) console.error('Erro ao carregar vendas:', error);
    setSales((data as SaleRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayISO();
  const completedToday = sales.filter((s) => s.status === 'completed' && s.completed_at && s.completed_at.slice(0, 10) === today);
  const revenueToday = completedToday.reduce((sum, s) => sum + Number(s.total), 0);
  const count = (status: SaleStatus) => sales.filter((s) => s.status === status).length;

  const term = search.toLowerCase();
  const visible = sales.filter(
    (s) =>
      s.status === tab &&
      (String(s.number).includes(search) || s.clients?.full_name.toLowerCase().includes(term) || s.animals?.name.toLowerCase().includes(term) || !term)
  );

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatTile label="Vendido hoje" value={formatBRL(revenueToday)} tone="emerald" hint={`${completedToday.length} venda(s)`} />
        <StatTile label="Ticket médio hoje" value={formatBRL(completedToday.length ? revenueToday / completedToday.length : 0)} />
        <StatTile label="Vendas em aberto" value={count('open')} tone={count('open') ? 'amber' : 'slate'} hint="Atendimentos a receber" />
        <StatTile label="Orçamentos" value={count('quote')} tone="blue" />
      </div>

      <Tabs
        tabs={[
          ['open', `Em aberto (${count('open')})`],
          ['quote', `Orçamentos (${count('quote')})`],
          ['completed', 'Finalizadas'],
          ['cancelled', 'Canceladas'],
        ]}
        value={tab}
        onChange={setTab}
      />

      <PageToolbar search={search} onSearch={setSearch} placeholder="Número, cliente ou animal..." actionLabel="Nova venda" onAction={() => setModal({ saleId: null })}>
        <SecondaryButton onClick={() => setModal({ saleId: null, context: { quote: true } })}>
          <FileText className="w-4 h-4" />
          Novo orçamento
        </SecondaryButton>
      </PageToolbar>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={thClass}>Nº</th>
                <th className={`${thClass} hidden sm:table-cell`}>Data</th>
                <th className={thClass}>Cliente</th>
                <th className={`${thClass} hidden md:table-cell`}>Status</th>
                <th className={`${thClass} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visible.length === 0 ? (
                <EmptyRow colSpan={5}>
                  {tab === 'open' ? 'Nenhuma venda em aberto. Lance vendas pelo botão acima ou pela ficha do animal durante o atendimento.' : 'Nada por aqui.'}
                </EmptyRow>
              ) : (
                visible.map((s) => (
                  <tr key={s.id} onClick={() => setModal({ saleId: s.id })} className="hover:bg-slate-50 cursor-pointer">
                    <td className={`${tdClass} font-medium text-slate-800`}>#{s.number}</td>
                    <td className={`${tdClass} text-slate-600 hidden sm:table-cell whitespace-nowrap`}>{formatDateTime(s.completed_at ?? s.created_at)}</td>
                    <td className={tdClass}>
                      <p className="text-slate-800">{s.clients?.full_name ?? 'Consumidor'}</p>
                      {s.animals && <p className="text-xs text-slate-500">{s.animals.name}</p>}
                      {s.status === 'quote' && s.valid_until && s.valid_until < today && <p className="text-xs text-red-600">Orçamento vencido</p>}
                    </td>
                    <td className={`${tdClass} hidden md:table-cell`}>
                      <Badge className={statusInfo[s.status].style}>{statusInfo[s.status].label}</Badge>
                    </td>
                    <td className={`${tdClass} text-right font-semibold text-slate-800 whitespace-nowrap`}>{formatBRL(s.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <SaleModal saleId={modal.saleId} context={modal.context} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  );
}
