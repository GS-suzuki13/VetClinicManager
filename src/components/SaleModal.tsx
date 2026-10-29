import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import { supabase, Animal, CatalogItem, Client, PaymentMethod, Sale, SaleItem } from '../lib/supabase';
import { dbErrorMessage, formatDate, toISODate } from '../lib/format';
import { cashMethods, formatBRL, parseMoney, paymentMethodLabel, round2 } from '../lib/money';
import { printClinicalDocument } from '../lib/print';
import { useClinic } from '../context/AuthContext';
import Modal, { FormError, fieldClass, labelClass } from './Modal';
import { askPrompt, notify } from '../lib/dialogs';

export interface SaleContext {
  clientId?: string | null;
  animalId?: string | null;
  appointmentId?: string | null;
  quote?: boolean;
}

interface DraftItem {
  key: string;
  item_id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  discount: string;
}

interface PayRow {
  method: PaymentMethod;
  amount: string;
  installments: string;
}

const num = (v: string) => {
  const n = parseMoney(v);
  return Number.isFinite(n) ? n : 0;
};
const qty = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
let keySeq = 0;
const newKey = () => `k${++keySeq}`;

// PDV: orçamento, venda em atendimento e recebimento (pagamentos múltiplos,
// conta corrente do cliente). Os totais exibidos são conferidos pelo servidor.
export default function SaleModal({ saleId, context, onClose, onSaved }: { saleId?: string | null; context?: SaleContext; onClose: () => void; onSaved: () => void }) {
  const clinic = useClinic();
  const isManager = clinic.role === 'owner' || clinic.role === 'admin';
  const [step, setStep] = useState<'edit' | 'pay' | 'done'>('edit');
  const [sale, setSale] = useState<Sale | null>(null);
  const [status, setStatus] = useState<'quote' | 'open'>(context?.quote ? 'quote' : 'open');
  const [clients, setClients] = useState<Client[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [clientId, setClientId] = useState(context?.clientId ?? '');
  const [animalId, setAnimalId] = useState(context?.animalId ?? '');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return toISODate(d);
  });
  const [search, setSearch] = useState('');
  const [maxDiscount, setMaxDiscount] = useState(100);
  const [balance, setBalance] = useState(0);
  const [payments, setPayments] = useState<PayRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!saleId);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('clients').select('*').order('full_name').then(({ data }) => setClients(data ?? []));
    supabase.from('catalog_items').select('*').eq('active', true).order('name').then(({ data }) => setCatalog(data ?? []));
    supabase.from('clinics').select('max_discount_pct').eq('id', clinic.id).single().then(({ data }) => data && setMaxDiscount(Number(data.max_discount_pct)));
  }, [clinic.id]);

  useEffect(() => {
    if (!saleId) return;
    (async () => {
      const [s, i] = await Promise.all([
        supabase.from('sales').select('*').eq('id', saleId).single(),
        supabase.from('sale_items').select('*').eq('sale_id', saleId).order('created_at'),
      ]);
      if (s.data) {
        setSale(s.data);
        setStatus(s.data.status === 'quote' ? 'quote' : 'open');
        setClientId(s.data.client_id ?? '');
        setAnimalId(s.data.animal_id ?? '');
        setDiscount(Number(s.data.discount) ? String(s.data.discount).replace('.', ',') : '');
        setNotes(s.data.notes ?? '');
        if (s.data.valid_until) setValidUntil(s.data.valid_until);
        if (s.data.status === 'completed' || s.data.status === 'cancelled') setStep('done');
      }
      setItems(
        ((i.data as SaleItem[]) ?? []).map((it) => ({
          key: newKey(),
          item_id: it.item_id,
          description: it.description,
          quantity: String(it.quantity).replace('.', ','),
          unit_price: String(it.unit_price).replace('.', ','),
          discount: Number(it.discount) ? String(it.discount).replace('.', ',') : '',
        }))
      );
      setLoading(false);
    })();
  }, [saleId]);

  useEffect(() => {
    if (!clientId) {
      setAnimals([]);
      setBalance(0);
      return;
    }
    supabase.from('animals').select('*').eq('client_id', clientId).order('name').then(({ data }) => setAnimals(data ?? []));
    supabase
      .from('client_balances')
      .select('balance')
      .eq('client_id', clientId)
      .maybeSingle()
      .then(({ data }) => setBalance(Number(data?.balance ?? 0)));
  }, [clientId]);

  const totals = useMemo(() => {
    const gross = items.reduce((s, it) => s + round2(qty(it.quantity) * num(it.unit_price)), 0);
    const itemDiscounts = items.reduce((s, it) => s + num(it.discount), 0);
    const subtotal = round2(gross - itemDiscounts);
    const saleDiscount = num(discount);
    const total = round2(Math.max(subtotal - saleDiscount, 0));
    const pct = gross > 0 ? ((itemDiscounts + saleDiscount) / gross) * 100 : 0;
    return { gross, subtotal, saleDiscount, total, pct };
  }, [items, discount]);

  const term = search.trim().toLowerCase();
  const results = term
    ? catalog.filter((c) => c.name.toLowerCase().includes(term) || c.barcode === search.trim() || c.sku?.toLowerCase() === term).slice(0, 8)
    : [];

  const addItem = (c: CatalogItem | null) => {
    setItems((prev) => {
      const existing = c && prev.find((p) => p.item_id === c.id);
      if (existing) return prev.map((p) => (p === existing ? { ...p, quantity: String(qty(p.quantity) + 1) } : p));
      return [
        ...prev,
        {
          key: newKey(),
          item_id: c?.id ?? null,
          description: c?.name ?? '',
          quantity: '1',
          unit_price: c ? String(c.price).replace('.', ',') : '',
          discount: '',
        },
      ];
    });
    setSearch('');
    searchRef.current?.focus();
  };

  const updateItem = (key: string, field: keyof DraftItem, value: string) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)));

  // Grava cabeçalho e itens (substitui os itens). Retorna a venda salva.
  const save = async (nextStatus = status): Promise<Sale | null> => {
    if (items.length === 0) {
      setError('Adicione ao menos um item.');
      return null;
    }
    if (items.some((it) => !it.description.trim() || qty(it.quantity) <= 0)) {
      setError('Confira descrição e quantidade dos itens.');
      return null;
    }
    if (items.some((it) => num(it.discount) > round2(qty(it.quantity) * num(it.unit_price)))) {
      setError('O desconto de um item é maior que o valor dele.');
      return null;
    }
    setBusy(true);
    setError(null);
    const header = {
      status: nextStatus,
      client_id: clientId || null,
      animal_id: animalId || null,
      appointment_id: sale?.appointment_id ?? context?.appointmentId ?? null,
      discount: totals.saleDiscount,
      notes: notes.trim() || null,
      valid_until: nextStatus === 'quote' ? validUntil : null,
    };
    const res = sale
      ? await supabase.from('sales').update(header).eq('id', sale.id).select().single()
      : await supabase.from('sales').insert(header).select().single();
    if (res.error) {
      setBusy(false);
      setError(dbErrorMessage(res.error, 'Não foi possível salvar a venda.'));
      return null;
    }
    const saved = res.data as Sale;
    // Desconto da venda só é aplicado depois dos itens (o servidor limita ao subtotal).
    await supabase.from('sale_items').delete().eq('sale_id', saved.id);
    const { error: itemsError } = await supabase.from('sale_items').insert(
      items.map((it) => ({
        sale_id: saved.id,
        item_id: it.item_id,
        description: it.description.trim(),
        quantity: qty(it.quantity),
        unit_price: num(it.unit_price),
        discount: num(it.discount),
      }))
    );
    if (itemsError) {
      setBusy(false);
      setError(dbErrorMessage(itemsError, 'Não foi possível salvar os itens.'));
      return null;
    }
    const fresh = await supabase.from('sales').update({ discount: totals.saleDiscount }).eq('id', saved.id).select().single();
    setBusy(false);
    setSale(fresh.data ?? saved);
    setStatus(nextStatus);
    onSaved();
    return fresh.data ?? saved;
  };

  const goToPayment = async () => {
    const saved = await save('open');
    if (!saved) return;
    setPayments([{ method: 'pix', amount: String(saved.total).replace('.', ','), installments: '1' }]);
    setStep('pay');
  };

  const paid = round2(payments.reduce((s, p) => s + num(p.amount), 0));
  const remaining = round2(Number(sale?.total ?? 0) - paid);

  const finalize = async () => {
    if (!sale) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('finalize_sale', {
      p_sale_id: sale.id,
      p_payments: payments
        .filter((p) => num(p.amount) > 0)
        .map((p) => ({ method: p.method, amount: num(p.amount), installments: Number(p.installments) || 1 })),
    });
    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível finalizar a venda.'));
      return;
    }
    const { data } = await supabase.from('sales').select('*').eq('id', sale.id).single();
    setSale(data);
    setStep('done');
    onSaved();
  };

  const cancelSale = async () => {
    if (!sale) return;
    const reason = (await askPrompt(sale.status === 'completed' ? 'Motivo do cancelamento (os pagamentos serão estornados no caixa aberto):' : 'Motivo do cancelamento:', { required: true, multiline: true, danger: true, title: 'Cancelar venda', confirmLabel: 'Cancelar venda', placeholder: 'Ex.: cliente desistiu' }));
    if (!reason?.trim()) return;
    const { error } = await supabase.rpc('cancel_sale', { p_sale_id: sale.id, p_reason: reason });
    if (error) {
      notify(dbErrorMessage(error, 'Não foi possível cancelar a venda.'));
      return;
    }
    onSaved();
    onClose();
  };

  const print = () => {
    const client = clients.find((c) => c.id === clientId);
    const animal = animals.find((a) => a.id === animalId);
    const lines = items.map((it) => {
      const value = round2(qty(it.quantity) * num(it.unit_price) - num(it.discount));
      return `${it.quantity} x ${it.description} — ${formatBRL(value)}${num(it.discount) ? ` (desc. ${formatBRL(num(it.discount))})` : ''}`;
    });
    const isQuote = (sale?.status ?? status) === 'quote';
    printClinicalDocument({
      clinicName: clinic.name,
      title: isQuote ? `Orçamento${sale ? ` nº ${sale.number}` : ''}` : `Comprovante de venda${sale ? ` nº ${sale.number}` : ''}`,
      body: [
        ...lines,
        '',
        `Subtotal: ${formatBRL(totals.subtotal)}`,
        totals.saleDiscount ? `Desconto: ${formatBRL(totals.saleDiscount)}` : '',
        `TOTAL: ${formatBRL(totals.total)}`,
        isQuote ? `\nOrçamento válido até ${formatDate(validUntil)}.` : '',
        notes ? `\nObservações: ${notes}` : '',
      ]
        .filter((l) => l !== '')
        .join('\n'),
      patient: animal?.name ?? '-',
      owner: client?.full_name ?? 'Consumidor',
      date: new Date().toLocaleDateString('pt-BR'),
      signature: null,
    });
  };

  const title =
    step === 'done'
      ? `Venda nº ${sale?.number}`
      : step === 'pay'
        ? `Receber venda nº ${sale?.number}`
        : sale
          ? `${status === 'quote' ? 'Orçamento' : 'Venda'} nº ${sale.number}`
          : status === 'quote'
            ? 'Novo orçamento'
            : 'Nova venda';

  if (loading) return null;

  return (
    <Modal title={title} onClose={onClose} size="xl">
      <div className="p-4 sm:p-6 space-y-5">
        <FormError message={error} />

        {step === 'done' && sale && (
          <div className="text-center space-y-4 py-4">
            {sale.status === 'completed' ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="text-lg font-semibold text-slate-800">Venda finalizada • {formatBRL(sale.total)}</p>
              </>
            ) : (
              <p className="text-lg font-semibold text-red-600">Venda cancelada{sale.cancel_reason ? `: ${sale.cancel_reason}` : ''}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={print} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">
                <Printer className="w-4 h-4" />
                Imprimir comprovante
              </button>
              {sale.status === 'completed' && isManager && (
                <button onClick={cancelSale} className="px-4 py-2 text-red-600 rounded-lg hover:bg-red-50 font-medium">
                  Cancelar e estornar
                </button>
              )}
              <button onClick={onClose} className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium">
                Fechar
              </button>
            </div>
          </div>
        )}

        {step === 'edit' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Cliente</label>
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setAnimalId('');
                  }}
                  className={fieldClass}
                >
                  <option value="">Consumidor (sem cadastro)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
                {clientId && balance !== 0 && (
                  <p className={`text-xs mt-1 ${balance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {balance < 0 ? `Deve ${formatBRL(-balance)}` : `Crédito de ${formatBRL(balance)}`}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Animal</label>
                <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} className={fieldClass} disabled={!clientId}>
                  <option value="">—</option>
                  {animals.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tipo</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as 'quote' | 'open')} className={fieldClass}>
                  <option value="open">Venda</option>
                  <option value="quote">Orçamento</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                ref={searchRef}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (results[0]) addItem(results[0]);
                  }
                }}
                placeholder="Buscar produto ou serviço (nome ou leitor de código de barras)..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {results.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => addItem(c)} className="w-full flex justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-emerald-50">
                        <span>
                          {c.name}
                          {c.track_stock && (
                            <span className={`ml-2 text-xs ${Number(c.stock_qty) <= 0 ? 'text-red-600' : 'text-slate-500'}`}>
                              estoque {Number(c.stock_qty).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </span>
                        <span className="font-medium text-slate-700">{formatBRL(c.price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Celular: um cartão por item (a tabela não cabe em 375px). */}
            <ul className="sm:hidden space-y-2">
              {items.length === 0 && <li className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">Busque um produto ou serviço acima.</li>}
              {items.map((it) => (
                <li key={it.key} className="rounded-lg border border-slate-200 p-3 space-y-2 animate-fade-in">
                  <div className="flex items-start justify-between gap-2">
                    {it.item_id ? (
                      <span className="font-medium text-slate-800 text-sm pt-1">{it.description}</span>
                    ) : (
                      <input value={it.description} onChange={(e) => updateItem(it.key, 'description', e.target.value)} placeholder="Descrição do item avulso" className={fieldClass} />
                    )}
                    <button type="button" aria-label="Remover item" onClick={() => setItems((prev) => prev.filter((p) => p.key !== it.key))} className="p-2 -mr-1 text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ['quantity', 'Qtd'],
                        ['unit_price', 'Unitário'],
                        ['discount', 'Desconto'],
                      ] as const
                    ).map(([field, label]) => (
                      <label key={field} className="text-xs text-slate-500">
                        {label}
                        <input inputMode="decimal" value={it[field]} onChange={(e) => updateItem(it.key, field, e.target.value)} placeholder="0" className={`${fieldClass} mt-0.5 text-right`} />
                      </label>
                    ))}
                  </div>
                  <p className="text-right text-sm font-semibold text-slate-800">{formatBRL(round2(qty(it.quantity) * num(it.unit_price) - num(it.discount)))}</p>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right w-20">Qtd</th>
                    <th className="px-3 py-2 text-right w-28">Unitário</th>
                    <th className="px-3 py-2 text-right w-28">Desconto</th>
                    <th className="px-3 py-2 text-right w-28">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                        Busque um produto ou serviço acima.
                      </td>
                    </tr>
                  )}
                  {items.map((it) => (
                    <tr key={it.key}>
                      <td className="px-3 py-2 min-w-[10rem]">
                        {it.item_id ? (
                          <span className="text-slate-800">{it.description}</span>
                        ) : (
                          <input value={it.description} onChange={(e) => updateItem(it.key, 'description', e.target.value)} placeholder="Descrição do item avulso" className={fieldClass} />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input inputMode="decimal" value={it.quantity} onChange={(e) => updateItem(it.key, 'quantity', e.target.value)} className={`${fieldClass} text-right`} />
                      </td>
                      <td className="px-3 py-2">
                        <input inputMode="decimal" value={it.unit_price} onChange={(e) => updateItem(it.key, 'unit_price', e.target.value)} className={`${fieldClass} text-right`} />
                      </td>
                      <td className="px-3 py-2">
                        <input inputMode="decimal" value={it.discount} onChange={(e) => updateItem(it.key, 'discount', e.target.value)} placeholder="0,00" className={`${fieldClass} text-right`} />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800 whitespace-nowrap">
                        {formatBRL(round2(qty(it.quantity) * num(it.unit_price) - num(it.discount)))}
                      </td>
                      <td className="px-1 py-2">
                        <button type="button" aria-label="Remover item" onClick={() => setItems((prev) => prev.filter((p) => p.key !== it.key))} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => addItem(null)} className="flex items-center gap-1 text-sm text-emerald-700 font-medium hover:underline">
              <Plus className="w-4 h-4" />
              Item avulso
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Observações</label>
                  <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className={fieldClass} />
                </div>
                {status === 'quote' && (
                  <div>
                    <label className={labelClass}>Válido até</label>
                    <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={fieldClass} />
                  </div>
                )}
              </div>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span>{formatBRL(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-slate-600">Desconto na venda (R$)</span>
                  <input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" className="w-28 px-2 py-1 border border-slate-300 rounded-lg text-right bg-white" />
                </div>
                {totals.pct > 0 && (
                  <p className={`text-xs text-right ${totals.pct > maxDiscount && !isManager ? 'text-red-600' : 'text-slate-500'}`}>
                    Desconto total de {totals.pct.toFixed(1)}%{!isManager && ` (limite ${maxDiscount}%)`}
                  </p>
                )}
                <div className="flex justify-between text-lg font-bold text-slate-800 pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span>{formatBRL(totals.total)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {sale && (
                <button type="button" onClick={cancelSale} className="px-4 py-2 text-red-600 rounded-lg hover:bg-red-50 font-medium">
                  Cancelar {status === 'quote' ? 'orçamento' : 'venda'}
                </button>
              )}
              <button type="button" onClick={print} disabled={items.length === 0} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-60 font-medium">
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button type="button" disabled={busy} onClick={() => save().then((s) => s && onClose())} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-60 font-medium">
                {status === 'quote' ? 'Salvar orçamento' : 'Salvar em aberto'}
              </button>
              <button type="button" disabled={busy || items.length === 0} onClick={goToPayment} className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-medium">
                {status === 'quote' ? 'Aprovar e receber' : 'Receber'} {formatBRL(totals.total)}
              </button>
            </div>
          </>
        )}

        {step === 'pay' && sale && (
          <>
            <div className="flex flex-wrap justify-between gap-2 text-sm bg-slate-50 rounded-lg p-4">
              <span>
                Total: <strong className="text-lg">{formatBRL(sale.total)}</strong>
              </span>
              {clientId && (
                <span className={balance < 0 ? 'text-red-600' : 'text-emerald-700'}>
                  Conta do cliente: {balance < 0 ? `deve ${formatBRL(-balance)}` : `crédito ${formatBRL(balance)}`}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {payments.map((p, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 sm:col-span-6">
                    <label className={labelClass}>Forma</label>
                    <select
                      value={p.method}
                      onChange={(e) => setPayments((prev) => prev.map((x, i) => (i === index ? { ...x, method: e.target.value as PaymentMethod } : x)))}
                      className={fieldClass}
                    >
                      {[...cashMethods, ...(clientId ? (['client_credit', 'on_account'] as PaymentMethod[]) : [])].map((m) => (
                        <option key={m} value={m}>
                          {paymentMethodLabel[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={p.method === 'credit_card' ? 'col-span-6 sm:col-span-3' : 'col-span-10 sm:col-span-5'}>
                    <label className={labelClass}>Valor</label>
                    <input inputMode="decimal" value={p.amount} onChange={(e) => setPayments((prev) => prev.map((x, i) => (i === index ? { ...x, amount: e.target.value } : x)))} className={`${fieldClass} text-right`} />
                  </div>
                  {p.method === 'credit_card' && (
                    <div className="col-span-4 sm:col-span-2">
                      <label className={labelClass}>Parcelas</label>
                      <select value={p.installments} onChange={(e) => setPayments((prev) => prev.map((x, i) => (i === index ? { ...x, installments: e.target.value } : x)))} className={fieldClass}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}x
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="col-span-2 sm:col-span-1">
                    <button type="button" aria-label="Remover pagamento" onClick={() => setPayments((prev) => prev.filter((_, i) => i !== index))} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPayments((prev) => [...prev, { method: 'cash', amount: remaining > 0 ? String(remaining).replace('.', ',') : '', installments: '1' }])}
                className="flex items-center gap-1 text-sm text-emerald-700 font-medium hover:underline"
              >
                <Plus className="w-4 h-4" />
                Dividir pagamento
              </button>
              <span className={`text-sm font-medium ${remaining === 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {remaining === 0 ? 'Pagamentos conferem com o total' : remaining > 0 ? `Faltam ${formatBRL(remaining)}` : `Excede ${formatBRL(-remaining)} (troco: lance só o valor da venda)`}
              </span>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button type="button" onClick={() => setStep('edit')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">
                Voltar
              </button>
              <button type="button" disabled={busy || remaining !== 0} onClick={finalize} className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-medium">
                {busy ? 'Finalizando...' : 'Finalizar venda'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
