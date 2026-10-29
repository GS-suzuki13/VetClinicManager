import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileUp, Link2, Pencil, Trash2 } from 'lucide-react';
import { supabase, DreGroup, FinancialAccount, FinancialCategory, FinancialEntry, StatementLine } from '../lib/supabase';
import { dbErrorMessage, formatDate, parseISODate, todayISO, toISODate } from '../lib/format';
import { formatBRL, parseMoney } from '../lib/money';
import { parseOfx } from '../lib/imports';
import PageToolbar, { IconButton, PageLoader, tdClass, thClass } from '../components/PageToolbar';
import Modal, { FormActions, FormError, fieldClass, labelClass } from '../components/Modal';
import { Badge, Card, EmptyRow, StatTile, Tabs } from '../components/ui';
import { askConfirm, notify } from '../lib/dialogs';

type Tab = 'entries' | 'cashflow' | 'dre' | 'reconcile' | 'setup';

const dreLabel: Record<DreGroup, string> = {
  revenue: 'Receita bruta',
  deductions: 'Deduções e estornos',
  cogs: 'Custos (insumos, exames)',
  operating_expense: 'Despesas operacionais',
  payroll: 'Pessoal',
  taxes: 'Impostos',
  financial: 'Despesas financeiras',
  other: 'Outros',
};

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso: string) => {
  const d = parseISODate(monthStart(iso));
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

export default function Finance() {
  const [tab, setTab] = useState<Tab>('entries');
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [status, setStatus] = useState<'all' | 'open' | 'paid' | 'late'>('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ entry: FinancialEntry | null } | null>(null);

  const load = useCallback(async () => {
    const [e, a, c, l] = await Promise.all([
      supabase.from('financial_entries').select('*').order('due_on', { ascending: false }).limit(5000),
      supabase.from('financial_accounts').select('*').order('name'),
      supabase.from('financial_categories').select('*').order('name'),
      supabase.from('bank_statement_lines').select('*').order('posted_on', { ascending: false }).limit(1000),
    ]);
    if (e.error) console.error('Erro ao carregar lançamentos:', e.error);
    setEntries(e.data ?? []);
    setAccounts(a.data ?? []);
    setCategories(c.data ?? []);
    setLines(l.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayISO();
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Sem categoria';
  const openIncome = entries.filter((e) => !e.paid_on && e.kind === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const openExpense = entries.filter((e) => !e.paid_on && e.kind === 'expense').reduce((s, e) => s + Number(e.amount), 0);
  const late = entries.filter((e) => !e.paid_on && e.due_on < today);

  const balanceNow = useMemo(() => {
    const opening = accounts.reduce((s, a) => s + Number(a.opening_balance), 0);
    return entries.filter((e) => e.paid_on && e.paid_on <= today).reduce((s, e) => s + (e.kind === 'income' ? 1 : -1) * Number(e.amount), opening);
  }, [accounts, entries, today]);

  const markPaid = async (entry: FinancialEntry) => {
    const accountId = entry.account_id ?? accounts.find((a) => a.system_key === 'bank')?.id ?? null;
    const { error } = await supabase.from('financial_entries').update({ paid_on: today, account_id: accountId }).eq('id', entry.id);
    if (error) notify(dbErrorMessage(error, 'Não foi possível baixar o lançamento.'));
    else load();
  };

  const remove = async (entry: FinancialEntry) => {
    if (!(await askConfirm(`Excluir "${entry.description}"?`, { danger: true, title: 'Excluir', confirmLabel: 'Excluir' }))) return;
    const { error } = await supabase.from('financial_entries').delete().eq('id', entry.id);
    if (error) notify(dbErrorMessage(error, 'Não foi possível excluir.'));
    else load();
  };

  if (loading) return <PageLoader />;

  const from = monthStart(`${month}-01`);
  const to = monthEnd(`${month}-01`);
  const term = search.toLowerCase();
  const visible = entries
    .filter((e) => e.due_on >= from && e.due_on <= to)
    .filter((e) => filter === 'all' || e.kind === filter)
    .filter((e) => status === 'all' || (status === 'paid' ? !!e.paid_on : status === 'open' ? !e.paid_on : !e.paid_on && e.due_on < today))
    .filter((e) => !term || e.description.toLowerCase().includes(term) || e.supplier?.toLowerCase().includes(term))
    .sort((a, b) => a.due_on.localeCompare(b.due_on));

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatTile label="Saldo realizado (contas)" value={formatBRL(balanceNow)} tone={balanceNow < 0 ? 'red' : 'emerald'} />
        <StatTile label="A receber em aberto" value={formatBRL(openIncome)} tone="blue" />
        <StatTile label="A pagar em aberto" value={formatBRL(openExpense)} tone="amber" />
        <StatTile label="Vencidos" value={late.length} tone={late.length ? 'red' : 'slate'} hint={late.length ? formatBRL(late.reduce((s, e) => s + Number(e.amount), 0)) : undefined} />
      </div>

      <Tabs
        tabs={[
          ['entries', 'Contas a pagar e receber'],
          ['cashflow', 'Fluxo de caixa'],
          ['dre', 'DRE'],
          ['reconcile', `Conciliação bancária${lines.some((l) => !l.entry_id) ? ` (${lines.filter((l) => !l.entry_id).length})` : ''}`],
          ['setup', 'Contas e categorias'],
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'entries' && (
        <>
          <PageToolbar search={search} onSearch={setSearch} placeholder="Descrição ou fornecedor..." actionLabel="Novo lançamento" onAction={() => setModal({ entry: null })}>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm" />
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm">
              <option value="all">Receitas e despesas</option>
              <option value="income">A receber</option>
              <option value="expense">A pagar</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm">
              <option value="all">Todos</option>
              <option value="open">Em aberto</option>
              <option value="late">Vencidos</option>
              <option value="paid">Pagos</option>
            </select>
          </PageToolbar>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={thClass}>Vencimento</th>
                    <th className={thClass}>Descrição</th>
                    <th className={`${thClass} hidden md:table-cell`}>Categoria</th>
                    <th className={`${thClass} text-right`}>Valor</th>
                    <th className={`${thClass} hidden sm:table-cell`}>Situação</th>
                    <th className={`${thClass} text-right`}>Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visible.length === 0 ? (
                    <EmptyRow colSpan={6}>Nenhum lançamento neste mês com esses filtros. As vendas entram aqui automaticamente.</EmptyRow>
                  ) : (
                    visible.map((e) => {
                      const isLate = !e.paid_on && e.due_on < today;
                      return (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className={`${tdClass} whitespace-nowrap ${isLate ? 'text-red-600 font-medium' : 'text-slate-600'}`}>{formatDate(e.due_on)}</td>
                          <td className={tdClass}>
                            <p className="text-slate-800">{e.description}</p>
                            <p className="text-xs text-slate-500">{[e.supplier, e.document && `doc. ${e.document}`].filter(Boolean).join(' • ')}</p>
                          </td>
                          <td className={`${tdClass} text-slate-600 hidden md:table-cell`}>{catName(e.category_id)}</td>
                          <td className={`${tdClass} text-right font-medium whitespace-nowrap ${e.kind === 'income' ? 'text-emerald-700' : 'text-red-600'}`}>
                            {e.kind === 'income' ? '+' : '−'}
                            {formatBRL(e.amount)}
                          </td>
                          <td className={`${tdClass} hidden sm:table-cell`}>
                            {e.paid_on ? (
                              <Badge className="bg-green-100 text-green-700">Pago {formatDate(e.paid_on, { day: '2-digit', month: '2-digit' })}</Badge>
                            ) : isLate ? (
                              <Badge className="bg-red-100 text-red-700">Vencido</Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-700">Em aberto</Badge>
                            )}
                          </td>
                          <td className={tdClass}>
                            <div className="flex justify-end gap-1">
                              {!e.paid_on && (
                                <IconButton tone="blue" title="Baixar como pago hoje" onClick={() => markPaid(e)}>
                                  <CheckCircle2 className="w-4 h-4" />
                                </IconButton>
                              )}
                              <IconButton tone="blue" title="Editar" onClick={() => setModal({ entry: e })}>
                                <Pencil className="w-4 h-4" />
                              </IconButton>
                              {!e.payment_id && (
                                <IconButton tone="red" title="Excluir" onClick={() => remove(e)}>
                                  <Trash2 className="w-4 h-4" />
                                </IconButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'cashflow' && <CashFlow entries={entries} openingBalance={balanceNow} />}
      {tab === 'dre' && <Dre entries={entries} categories={categories} />}
      {tab === 'reconcile' && <Reconciliation accounts={accounts} categories={categories} entries={entries} lines={lines} onChanged={load} />}
      {tab === 'setup' && <Setup accounts={accounts} categories={categories} onChanged={load} />}

      {modal && <EntryModal entry={modal.entry} accounts={accounts} categories={categories} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  );
}

function EntryModal({ entry, accounts, categories, onClose, onSaved }: { entry: FinancialEntry | null; accounts: FinancialAccount[]; categories: FinancialCategory[]; onClose: () => void; onSaved: () => void }) {
  const auto = !!entry?.payment_id;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: entry?.kind ?? ('expense' as 'income' | 'expense'),
    description: entry?.description ?? '',
    amount: entry ? String(entry.amount).replace('.', ',') : '',
    due_on: entry?.due_on ?? todayISO(),
    paid: !!entry?.paid_on,
    paid_on: entry?.paid_on ?? todayISO(),
    category_id: entry?.category_id ?? '',
    account_id: entry?.account_id ?? '',
    supplier: entry?.supplier ?? '',
    document: entry?.document ?? '',
    notes: entry?.notes ?? '',
    repeat: '1',
  });
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = parseMoney(form.amount);
    if (!amount || Number.isNaN(amount)) {
      setError('Valor inválido.');
      return;
    }
    setBusy(true);
    setError(null);
    const base = {
      kind: form.kind,
      description: form.description.trim(),
      amount,
      due_on: form.due_on,
      paid_on: form.paid ? form.paid_on : null,
      category_id: form.category_id || null,
      account_id: form.account_id || null,
      supplier: form.supplier.trim() || null,
      document: form.document.trim() || null,
      notes: form.notes.trim() || null,
    };
    let result;
    if (entry) {
      result = await supabase.from('financial_entries').update(base).eq('id', entry.id);
    } else {
      // Repetição mensal (aluguel, salários...): uma conta por mês, só a primeira paga.
      const times = Math.min(Math.max(Number(form.repeat) || 1, 1), 24);
      const rows = Array.from({ length: times }, (_, i) => {
        const d = parseISODate(form.due_on);
        const due = toISODate(new Date(d.getFullYear(), d.getMonth() + i, d.getDate()));
        return { ...base, due_on: due, paid_on: i === 0 ? base.paid_on : null, description: times > 1 ? `${base.description} (${i + 1}/${times})` : base.description };
      });
      result = await supabase.from('financial_entries').insert(rows);
    }
    setBusy(false);
    if (result.error) {
      setError(dbErrorMessage(result.error, 'Não foi possível salvar.'));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal title={entry ? 'Editar lançamento' : 'Novo lançamento'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />
        {auto && <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">Lançamento gerado por venda: valor e datas só mudam cancelando a venda.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tipo</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind, category_id: '' })} className={fieldClass} disabled={auto}>
              <option value="expense">Despesa (a pagar)</option>
              <option value="income">Receita (a receber)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Valor (R$) *</label>
            <input required inputMode="decimal" value={form.amount} onChange={set('amount')} className={fieldClass} disabled={auto} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Descrição *</label>
            <input required maxLength={200} value={form.description} onChange={set('description')} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Vencimento *</label>
            <input type="date" required value={form.due_on} onChange={set('due_on')} className={fieldClass} disabled={auto} />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
              <input type="checkbox" checked={form.paid} disabled={auto} onChange={(e) => setForm({ ...form, paid: e.target.checked })} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              Pago em
            </label>
            <input type="date" value={form.paid_on} onChange={set('paid_on')} disabled={!form.paid || auto} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Categoria</label>
            <select value={form.category_id} onChange={set('category_id')} className={fieldClass}>
              <option value="">Sem categoria</option>
              {categories
                .filter((c) => c.kind === form.kind && c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Conta</label>
            <select value={form.account_id} onChange={set('account_id')} className={fieldClass}>
              <option value="">—</option>
              {accounts
                .filter((a) => a.active)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{form.kind === 'expense' ? 'Fornecedor' : 'Pagador'}</label>
            <input maxLength={160} value={form.supplier} onChange={set('supplier')} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Documento</label>
            <input maxLength={80} value={form.document} onChange={set('document')} className={fieldClass} />
          </div>
          {!entry && (
            <div>
              <label className={labelClass}>Repetir mensalmente</label>
              <select value={form.repeat} onChange={set('repeat')} className={fieldClass}>
                {[1, 2, 3, 6, 12, 24].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'Não repetir' : `${n} meses`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={labelClass}>Observações</label>
            <textarea rows={2} maxLength={1000} value={form.notes} onChange={set('notes')} className={fieldClass} />
          </div>
        </div>
        <FormActions submitLabel={entry ? 'Atualizar' : 'Lançar'} onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}

// Fluxo de caixa dos próximos 60 dias: saldo atual + recebimentos − pagamentos
// em aberto por vencimento (vencidos entram hoje).
function CashFlow({ entries, openingBalance }: { entries: FinancialEntry[]; openingBalance: number }) {
  const today = todayISO();
  const end = new Date();
  end.setDate(end.getDate() + 60);
  const last = toISODate(end);
  const days = new Map<string, { income: number; expense: number }>();
  for (const e of entries) {
    if (e.paid_on) continue;
    const day = e.due_on < today ? today : e.due_on;
    if (day > last) continue;
    const d = days.get(day) ?? { income: 0, expense: 0 };
    d[e.kind] += Number(e.amount);
    days.set(day, d);
  }
  let running = openingBalance;
  const rows = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => {
      running += v.income - v.expense;
      return { day, ...v, balance: running };
    });
  const lowest = rows.reduce((min, r) => Math.min(min, r.balance), openingBalance);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatTile label="Saldo hoje" value={formatBRL(openingBalance)} />
        <StatTile label="Saldo previsto em 60 dias" value={formatBRL(running)} tone={running < 0 ? 'red' : 'emerald'} />
        <StatTile label="Menor saldo no período" value={formatBRL(lowest)} tone={lowest < 0 ? 'red' : 'slate'} hint={lowest < 0 ? 'Atenção: o caixa fica negativo' : undefined} />
      </div>
      <Card title="Movimentos previstos (contas em aberto)">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={thClass}>Dia</th>
                <th className={`${thClass} text-right`}>Entradas</th>
                <th className={`${thClass} text-right`}>Saídas</th>
                <th className={`${thClass} text-right`}>Saldo previsto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.length === 0 ? (
                <EmptyRow colSpan={4}>Nenhuma conta em aberto nos próximos 60 dias.</EmptyRow>
              ) : (
                rows.map((r) => (
                  <tr key={r.day}>
                    <td className={`${tdClass} text-slate-700`}>{r.day === today ? 'Hoje (inclui vencidos)' : formatDate(r.day)}</td>
                    <td className={`${tdClass} text-right text-emerald-700`}>{r.income ? formatBRL(r.income) : '—'}</td>
                    <td className={`${tdClass} text-right text-red-600`}>{r.expense ? formatBRL(r.expense) : '—'}</td>
                    <td className={`${tdClass} text-right font-semibold ${r.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatBRL(r.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// DRE gerencial por regime de caixa (data de pagamento).
function Dre({ entries, categories }: { entries: FinancialEntry[]; categories: FinancialCategory[] }) {
  const [period, setPeriod] = useState(todayISO().slice(0, 7));
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const groupOf = (id: string | null, kind: 'income' | 'expense'): DreGroup => categories.find((c) => c.id === id)?.dre_group ?? (kind === 'income' ? 'revenue' : 'other');

  const sums = useMemo(() => {
    const prefix = mode === 'month' ? period : period.slice(0, 4);
    const acc: Record<DreGroup, number> = { revenue: 0, deductions: 0, cogs: 0, operating_expense: 0, payroll: 0, taxes: 0, financial: 0, other: 0 };
    const byCategory = new Map<string, number>();
    for (const e of entries) {
      if (!e.paid_on || !e.paid_on.startsWith(prefix)) continue;
      const sign = e.kind === 'income' ? 1 : -1;
      acc[groupOf(e.category_id, e.kind)] += sign * Number(e.amount);
      const name = categories.find((c) => c.id === e.category_id)?.name ?? (e.kind === 'income' ? 'Receitas sem categoria' : 'Despesas sem categoria');
      byCategory.set(name, (byCategory.get(name) ?? 0) + sign * Number(e.amount));
    }
    return { acc, byCategory };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, categories, period, mode]);

  const { acc } = sums;
  const net = acc.revenue + acc.deductions;
  const gross = net + acc.cogs;
  const operating = gross + acc.operating_expense + acc.payroll + acc.taxes;
  const result = operating + acc.financial + acc.other;
  const pct = (v: number) => (acc.revenue ? `${((v / acc.revenue) * 100).toFixed(1)}%` : '');
  const row = (label: string, value: number, strong = false) => (
    <tr className={strong ? 'bg-slate-50 font-semibold' : ''}>
      <td className={`${tdClass} ${strong ? 'text-slate-800' : 'text-slate-600 pl-8'}`}>{label}</td>
      <td className={`${tdClass} text-right ${value < 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatBRL(value)}</td>
      <td className={`${tdClass} text-right text-slate-500 text-xs hidden sm:table-cell`}>{pct(value)}</td>
    </tr>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card
        className="lg:col-span-2"
        title="Demonstrativo de resultado (regime de caixa)"
        actions={
          <div className="flex gap-2">
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm">
              <option value="month">Mês</option>
              <option value="year">Ano</option>
            </select>
            <input type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-sm" />
          </div>
        }
      >
        <table className="w-full">
          <tbody className="divide-y divide-slate-100">
            {row(dreLabel.revenue, acc.revenue)}
            {row(`(−) ${dreLabel.deductions}`, acc.deductions)}
            {row('Receita líquida', net, true)}
            {row(`(−) ${dreLabel.cogs}`, acc.cogs)}
            {row('Lucro bruto', gross, true)}
            {row(`(−) ${dreLabel.operating_expense}`, acc.operating_expense)}
            {row(`(−) ${dreLabel.payroll}`, acc.payroll)}
            {row(`(−) ${dreLabel.taxes}`, acc.taxes)}
            {row('Resultado operacional', operating, true)}
            {row(`(−) ${dreLabel.financial}`, acc.financial)}
            {row(`(±) ${dreLabel.other}`, acc.other)}
            {row('Resultado do período', result, true)}
          </tbody>
        </table>
      </Card>
      <Card title="Por categoria">
        <ul className="divide-y divide-slate-100 text-sm">
          {[...sums.byCategory.entries()]
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .map(([name, value]) => (
              <li key={name} className="flex justify-between gap-2 px-4 sm:px-6 py-2">
                <span className="text-slate-600">{name}</span>
                <span className={value < 0 ? 'text-red-600' : 'text-emerald-700'}>{formatBRL(value)}</span>
              </li>
            ))}
          {sums.byCategory.size === 0 && <li className="p-6 text-center text-slate-500">Nada pago no período.</li>}
        </ul>
      </Card>
    </div>
  );
}

function Reconciliation({ accounts, categories, entries, lines, onChanged }: { accounts: FinancialAccount[]; categories: FinancialCategory[]; entries: FinancialEntry[]; lines: StatementLine[]; onChanged: () => void }) {
  const [accountId, setAccountId] = useState(accounts.find((a) => a.system_key === 'bank')?.id ?? accounts[0]?.id ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickCategory, setPickCategory] = useState<Record<string, string>>({});
  const [showDone, setShowDone] = useState(false);

  const accountLines = lines.filter((l) => l.account_id === accountId && (showDone || !l.entry_id));
  const usedEntries = new Set(lines.map((l) => l.entry_id).filter(Boolean));

  // Sugestão: mesmo valor e sentido, sem conciliação, vencimento/pagamento até 5 dias de diferença.
  const suggestion = (line: StatementLine) => {
    const kind = Number(line.amount) > 0 ? 'income' : 'expense';
    const day = parseISODate(line.posted_on).getTime();
    return entries
      .filter((e) => e.kind === kind && Number(e.amount) === Math.abs(Number(line.amount)) && !usedEntries.has(e.id))
      .map((e) => ({ e, diff: Math.abs(parseISODate(e.paid_on ?? e.due_on).getTime() - day) / 86400000 }))
      .filter((x) => x.diff <= 5)
      .sort((a, b) => a.diff - b.diff)[0]?.e;
  };

  const importFile = async (file: File | undefined) => {
    if (!file || !accountId) return;
    setError(null);
    setMessage(null);
    const parsed = parseOfx(await file.text());
    if (parsed.length === 0) {
      setError('Nenhuma transação encontrada. Confira se o arquivo é OFX.');
      return;
    }
    const { error, count } = await supabase
      .from('bank_statement_lines')
      .upsert(
        parsed.map((l) => ({ ...l, account_id: accountId })),
        { onConflict: 'account_id,fitid', ignoreDuplicates: true, count: 'exact' }
      );
    if (error) setError(dbErrorMessage(error, 'Não foi possível importar o extrato.'));
    else setMessage(`${count ?? parsed.length} de ${parsed.length} transações importadas (repetidas são ignoradas).`);
    onChanged();
  };

  const reconcile = async (line: StatementLine, entry: FinancialEntry) => {
    const { error } = await supabase.rpc('reconcile_statement_line', { p_line_id: line.id, p_entry_id: entry.id });
    if (error) setError(dbErrorMessage(error, 'Não foi possível conciliar.'));
    onChanged();
  };

  const createEntry = async (line: StatementLine) => {
    const { error } = await supabase.rpc('create_entry_from_statement_line', { p_line_id: line.id, p_category_id: pickCategory[line.id] || null, p_description: line.description });
    if (error) setError(dbErrorMessage(error, 'Não foi possível criar o lançamento.'));
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm">
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <label className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium text-sm cursor-pointer">
          <FileUp className="w-4 h-4" />
          Importar extrato OFX
          <input type="file" accept=".ofx,.OFX" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 sm:ml-auto">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
          Mostrar conciliadas
        </label>
      </div>
      <FormError message={error} />
      {message && <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg p-3">{message}</p>}
      <p className="text-xs text-slate-500">Baixe o extrato em OFX no internet banking. Cada linha é ligada a um lançamento (que vira pago na data do banco) ou vira um lançamento novo, como tarifas.</p>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={thClass}>Data</th>
                <th className={thClass}>Descrição no banco</th>
                <th className={`${thClass} text-right`}>Valor</th>
                <th className={thClass}>Conciliação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {accountLines.length === 0 ? (
                <EmptyRow colSpan={4}>{lines.length ? 'Tudo conciliado nesta conta.' : 'Importe um extrato OFX para começar.'}</EmptyRow>
              ) : (
                accountLines.map((line) => {
                  const match = !line.entry_id ? suggestion(line) : null;
                  const linked = line.entry_id ? entries.find((e) => e.id === line.entry_id) : null;
                  const kind = Number(line.amount) > 0 ? 'income' : 'expense';
                  return (
                    <tr key={line.id} className={line.entry_id ? 'opacity-60' : ''}>
                      <td className={`${tdClass} text-slate-600 whitespace-nowrap`}>{formatDate(line.posted_on)}</td>
                      <td className={`${tdClass} text-slate-800`}>{line.description || '-'}</td>
                      <td className={`${tdClass} text-right font-medium whitespace-nowrap ${Number(line.amount) > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatBRL(line.amount)}</td>
                      <td className={`${tdClass} min-w-[16rem]`}>
                        {linked ? (
                          <span className="flex items-center gap-1 text-emerald-700 text-xs">
                            <CheckCircle2 className="w-4 h-4" /> {linked.description}
                          </span>
                        ) : match ? (
                          <button onClick={() => reconcile(line, match)} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline text-left">
                            <Link2 className="w-4 h-4 shrink-0" /> Conciliar com "{match.description}" ({formatDate(match.due_on)})
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <select value={pickCategory[line.id] ?? ''} onChange={(e) => setPickCategory({ ...pickCategory, [line.id]: e.target.value })} className="px-2 py-1 border border-slate-300 rounded-lg bg-white text-xs flex-1">
                              <option value="">Categoria...</option>
                              {categories
                                .filter((c) => c.kind === kind)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                            <button onClick={() => createEntry(line)} className="px-2 py-1 rounded-lg bg-slate-100 text-xs font-medium text-slate-700 hover:bg-slate-200 whitespace-nowrap">
                              Criar lançamento
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Setup({ accounts, categories, onChanged }: { accounts: FinancialAccount[]; categories: FinancialCategory[]; onChanged: () => void }) {
  const [account, setAccount] = useState({ name: '', kind: 'bank', opening_balance: '' });
  const [category, setCategory] = useState({ name: '', kind: 'expense', dre_group: 'operating_expense' as DreGroup });
  const [error, setError] = useState<string | null>(null);

  const run = async (p: PromiseLike<{ error: { code?: string; message?: string } | null }>) => {
    const { error } = await p;
    setError(error ? dbErrorMessage(error, 'Não foi possível salvar.') : null);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <FormError message={error} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Contas (caixa, bancos, maquininhas)">
          <ul className="divide-y divide-slate-100 text-sm">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-4 sm:px-6 py-2.5">
                <span className={a.active ? 'text-slate-800' : 'text-slate-400 line-through'}>
                  {a.name} <span className="text-xs text-slate-500">• saldo inicial {formatBRL(a.opening_balance)}</span>
                </span>
                {!a.system_key && (
                  <button onClick={() => run(supabase.from('financial_accounts').update({ active: !a.active }).eq('id', a.id))} className="text-xs text-slate-500 hover:underline">
                    {a.active ? 'Desativar' : 'Ativar'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(supabase.from('financial_accounts').insert({ name: account.name.trim(), kind: account.kind, opening_balance: parseMoney(account.opening_balance) || 0 }));
              setAccount({ name: '', kind: 'bank', opening_balance: '' });
            }}
            className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-100"
          >
            <input required value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} placeholder="Nome (ex.: Banco X)" className={fieldClass} />
            <select value={account.kind} onChange={(e) => setAccount({ ...account, kind: e.target.value })} className={fieldClass}>
              <option value="bank">Banco</option>
              <option value="card">Maquininha</option>
              <option value="cash">Dinheiro</option>
              <option value="other">Outra</option>
            </select>
            <input inputMode="decimal" value={account.opening_balance} onChange={(e) => setAccount({ ...account, opening_balance: e.target.value })} placeholder="Saldo inicial" className={fieldClass} />
            <button type="submit" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm sm:col-span-3">Adicionar conta</button>
          </form>
        </Card>
        <Card title="Categorias (plano de contas)">
          <ul className="divide-y divide-slate-100 text-sm max-h-80 overflow-y-auto">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-4 sm:px-6 py-2">
                <span className={c.active ? 'text-slate-800' : 'text-slate-400 line-through'}>
                  {c.name}{' '}
                  <span className="text-xs text-slate-500">
                    • {c.kind === 'income' ? 'receita' : 'despesa'} • {dreLabel[c.dre_group]}
                  </span>
                </span>
                {!c.system_key && (
                  <button onClick={() => run(supabase.from('financial_categories').update({ active: !c.active }).eq('id', c.id))} className="text-xs text-slate-500 hover:underline">
                    {c.active ? 'Desativar' : 'Ativar'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(supabase.from('financial_categories').insert({ name: category.name.trim(), kind: category.kind, dre_group: category.dre_group }));
              setCategory({ ...category, name: '' });
            }}
            className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-100"
          >
            <input required value={category.name} onChange={(e) => setCategory({ ...category, name: e.target.value })} placeholder="Nome da categoria" className={fieldClass} />
            <select value={category.kind} onChange={(e) => setCategory({ ...category, kind: e.target.value })} className={fieldClass}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
            <select value={category.dre_group} onChange={(e) => setCategory({ ...category, dre_group: e.target.value as DreGroup })} className={fieldClass}>
              {(Object.keys(dreLabel) as DreGroup[]).map((g) => (
                <option key={g} value={g}>
                  {dreLabel[g]}
                </option>
              ))}
            </select>
            <button type="submit" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm sm:col-span-3">Adicionar categoria</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
