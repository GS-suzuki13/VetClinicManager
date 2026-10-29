import { useEffect, useState } from 'react';
import { AlertTriangle, BedDouble, CalendarClock, CheckCircle2, Circle, Landmark, Package, ShoppingCart, Syringe, Wallet, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { todayISO } from '../lib/format';
import { formatBRL } from '../lib/money';
import { useClinic } from '../context/AuthContext';

interface Pending {
  key: string;
  label: string;
  detail?: string;
  page: string;
  icon: typeof Syringe;
  tone: string;
}

const steps = [
  { key: 'catalog', label: 'Cadastre seus produtos e serviços', page: 'catalog' },
  { key: 'register', label: 'Abra o caixa pela primeira vez', page: 'register' },
  { key: 'boxes', label: 'Cadastre os boxes de internação', page: 'hospitalization' },
  { key: 'booking', label: 'Ative o agendamento online', page: 'relationship' },
  { key: 'team', label: 'Convide sua equipe', page: 'team' },
] as const;

// "O que precisa de atenção hoje": calculado sozinho, sem configurar widgets
// (no SimplesVet o painel começa vazio e exige montar os widgets).
export default function TodayTasks({ onNavigate, refreshKey }: { onNavigate: (page: string) => void; refreshKey: number }) {
  const clinic = useClinic();
  const isManager = clinic.role === 'owner' || clinic.role === 'admin';
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [hideSteps, setHideSteps] = useState(() => {
    try {
      return localStorage.getItem(`vetclinic:steps-hidden:${clinic.id}`) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const today = todayISO();
    const head = { count: 'exact', head: true } as const;
    (async () => {
      const [doses, bookings, hosp, tasks, stock, balances, openSales, lateEntries, cash, cashAny, boxes, clinicRow, members] = await Promise.all([
        supabase.from('vaccine_doses').select('id', head).eq('status', 'scheduled').lt('due_date', today),
        supabase.from('booking_requests').select('id', head).eq('status', 'pending'),
        supabase.from('hospitalizations').select('id', head).eq('status', 'active'),
        supabase.from('hospital_tasks').select('id', head).eq('status', 'pending').lt('scheduled_at', new Date(Date.now() - 15 * 60000).toISOString()),
        supabase.from('catalog_items').select('id, stock_qty, min_stock').eq('track_stock', true).eq('active', true).not('min_stock', 'is', null),
        supabase.from('client_balances').select('balance').lt('balance', 0),
        supabase.from('sales').select('id', head).eq('status', 'open'),
        supabase.from('financial_entries').select('id', head).is('paid_on', null).lt('due_on', today),
        supabase.from('cash_sessions').select('id', head).eq('status', 'open'),
        supabase.from('cash_sessions').select('id', head),
        supabase.from('hospital_boxes').select('id', head),
        supabase.from('clinics').select('booking_enabled').eq('id', clinic.id).single(),
        supabase.rpc('list_clinic_members', { p_clinic_id: clinic.id }),
      ]);
      const catalogCount = await supabase.from('catalog_items').select('id', head);
      const low = (stock.data ?? []).filter((i) => Number(i.stock_qty) <= Number(i.min_stock)).length;
      const debt = (balances.data ?? []).reduce((s, b) => s - Number(b.balance), 0);

      const list: Pending[] = [];
      if (bookings.count) list.push({ key: 'bookings', label: `${bookings.count} pedido(s) de agendamento online`, page: 'relationship', icon: CalendarClock, tone: 'text-blue-700 bg-blue-50' });
      if (tasks.count) list.push({ key: 'tasks', label: `${tasks.count} tarefa(s) atrasada(s) na internação`, detail: `${hosp.count ?? 0} internado(s)`, page: 'hospitalization', icon: BedDouble, tone: 'text-red-700 bg-red-50' });
      else if (hosp.count) list.push({ key: 'hosp', label: `${hosp.count} paciente(s) internado(s)`, page: 'hospitalization', icon: BedDouble, tone: 'text-orange-700 bg-orange-50' });
      if (doses.count) list.push({ key: 'doses', label: `${doses.count} vacina(s) atrasada(s)`, detail: 'Avise os tutores', page: 'relationship', icon: Syringe, tone: 'text-orange-700 bg-orange-50' });
      if (openSales.count) list.push({ key: 'sales', label: `${openSales.count} venda(s) em aberto para receber`, page: 'sales', icon: ShoppingCart, tone: 'text-amber-800 bg-amber-50' });
      if (debt > 0) list.push({ key: 'debt', label: `${balances.data!.length} cliente(s) devendo`, detail: formatBRL(debt), page: 'clients', icon: Wallet, tone: 'text-red-700 bg-red-50' });
      if (low) list.push({ key: 'stock', label: `${low} produto(s) abaixo do estoque mínimo`, page: 'catalog', icon: Package, tone: 'text-amber-800 bg-amber-50' });
      if (lateEntries.count) list.push({ key: 'finance', label: `${lateEntries.count} conta(s) vencida(s)`, page: 'finance', icon: Landmark, tone: 'text-red-700 bg-red-50' });
      if (!cash.count && (catalogCount.count ?? 0) > 0) list.push({ key: 'cash', label: 'Caixa fechado', detail: 'Abra para receber vendas', page: 'register', icon: AlertTriangle, tone: 'text-slate-700 bg-slate-100' });
      setPending(list);

      setDone({
        catalog: (catalogCount.count ?? 0) > 0,
        register: (cashAny.count ?? 0) > 0,
        boxes: (boxes.count ?? 0) > 0,
        booking: !!clinicRow.data?.booking_enabled,
        team: (members.data?.length ?? 0) > 1,
      });
    })();
  }, [clinic.id, refreshKey]);

  if (!pending) return null;
  const remaining = steps.filter((s) => !done[s.key]).length;
  const showSteps = isManager && !hideSteps && remaining > 0;

  const dismissSteps = () => {
    setHideSteps(true);
    try {
      localStorage.setItem(`vetclinic:steps-hidden:${clinic.id}`, '1');
    } catch {
      // sem armazenamento: some só nesta sessão
    }
  };

  return (
    <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${showSteps ? 'lg:grid-cols-3' : ''}`}>
      <section className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 ${showSteps ? 'lg:col-span-2' : ''}`}>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Precisa de atenção</h3>
        {pending.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-5 h-5" /> Tudo em dia por aqui.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pending.map(({ key, label, detail, page, icon: Icon, tone }) => (
              <li key={key}>
                <button onClick={() => onNavigate(page)} className="w-full flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-left hover:border-emerald-300 hover:shadow-sm transition-all">
                  <span className={`p-2 rounded-lg shrink-0 ${tone}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{label}</span>
                    {detail && <span className="block text-xs text-slate-500">{detail}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showSteps && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Primeiros passos</h3>
              <p className="text-xs text-slate-500">
                {steps.length - remaining} de {steps.length} concluídos
              </p>
            </div>
            <button onClick={dismissSteps} aria-label="Ocultar primeiros passos" title="Ocultar" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 mb-3 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${((steps.length - remaining) / steps.length) * 100}%` }} />
          </div>
          <ul className="space-y-1">
            {steps.map((s) => (
              <li key={s.key}>
                <button onClick={() => onNavigate(s.page)} disabled={done[s.key]} className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left hover:bg-slate-50 disabled:hover:bg-transparent">
                  {done[s.key] ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 shrink-0" />}
                  <span className={done[s.key] ? 'text-slate-400 line-through' : 'text-slate-700'}>{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
