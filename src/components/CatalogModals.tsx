import { FormEvent, useState } from 'react';
import { FileUp } from 'lucide-react';
import { supabase, CatalogItem, StockMovementType } from '../lib/supabase';
import { dbErrorMessage, todayISO } from '../lib/format';
import { formatBRL, parseMoney } from '../lib/money';
import { parseNfe, Nfe } from '../lib/imports';
import Modal, { FormActions, FormError, fieldClass, labelClass } from './Modal';

export function CatalogItemModal({ item, onClose, onSaved }: { item: CatalogItem | null; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: item?.kind ?? 'product',
    name: item?.name ?? '',
    category: item?.category ?? '',
    sku: item?.sku ?? '',
    barcode: item?.barcode ?? '',
    unit: item?.unit ?? 'un',
    price: item ? String(item.price).replace('.', ',') : '',
    cost: item?.cost != null ? String(item.cost).replace('.', ',') : '',
    track_stock: item?.track_stock ?? true,
    min_stock: item?.min_stock?.toString() ?? '',
    active: item?.active ?? true,
  });
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const price = parseMoney(form.price);
  const cost = form.cost ? parseMoney(form.cost) : null;
  const margin = cost && price > 0 ? ((price - cost) / price) * 100 : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (Number.isNaN(price) || (cost !== null && Number.isNaN(cost))) {
      setError('Preço ou custo inválido.');
      return;
    }
    setBusy(true);
    setError(null);
    const isProduct = form.kind === 'product';
    const payload = {
      kind: form.kind,
      name: form.name.trim(),
      category: form.category.trim() || null,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      unit: form.unit.trim() || 'un',
      price,
      cost,
      track_stock: isProduct && form.track_stock,
      min_stock: isProduct && form.track_stock && form.min_stock ? Number(form.min_stock) : null,
      active: form.active,
    };
    const { error } = item
      ? await supabase.from('catalog_items').update(payload).eq('id', item.id)
      : await supabase.from('catalog_items').insert(payload);
    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível salvar o item.'));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal title={item ? 'Editar item' : 'Novo produto ou serviço'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tipo</label>
            <select value={form.kind} onChange={set('kind')} className={fieldClass} disabled={!!item}>
              <option value="product">Produto</option>
              <option value="service">Serviço</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Categoria</label>
            <input value={form.category} onChange={set('category')} maxLength={80} className={fieldClass} placeholder="Ex.: Medicamentos, Rações, Consultas" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome *</label>
            <input required value={form.name} onChange={set('name')} maxLength={160} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Preço de venda (R$) *</label>
            <input required inputMode="decimal" value={form.price} onChange={set('price')} className={fieldClass} placeholder="0,00" />
          </div>
          <div>
            <label className={labelClass}>Custo (R$)</label>
            <input inputMode="decimal" value={form.cost} onChange={set('cost')} className={fieldClass} placeholder="0,00" />
            {margin !== null && Number.isFinite(margin) && (
              <p className={`text-xs mt-1 ${margin < 0 ? 'text-red-600' : 'text-slate-500'}`}>Margem: {margin.toFixed(1)}%</p>
            )}
          </div>
          {form.kind === 'product' && (
            <>
              <div>
                <label className={labelClass}>Código de barras (EAN)</label>
                <input value={form.barcode} onChange={set('barcode')} maxLength={60} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Código interno (SKU)</label>
                <input value={form.sku} onChange={set('sku')} maxLength={60} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Unidade</label>
                <input value={form.unit} onChange={set('unit')} maxLength={10} className={fieldClass} placeholder="un, cx, ml, kg" />
              </div>
              <div>
                <label className={labelClass}>Estoque mínimo</label>
                <input type="number" min="0" step="any" value={form.min_stock} onChange={set('min_stock')} className={fieldClass} disabled={!form.track_stock} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.track_stock} onChange={(e) => setForm((p) => ({ ...p, track_stock: e.target.checked }))} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                Controlar estoque
              </label>
            </>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Ativo (aparece no PDV)
          </label>
        </div>
        <FormActions submitLabel={item ? 'Atualizar' : 'Cadastrar'} onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}

const movementTypes: { value: Extract<StockMovementType, 'purchase' | 'adjustment' | 'loss' | 'return'>; label: string }[] = [
  { value: 'purchase', label: 'Entrada (compra)' },
  { value: 'return', label: 'Devolução de cliente' },
  { value: 'loss', label: 'Perda / vencido / uso interno' },
  { value: 'adjustment', label: 'Ajuste de inventário' },
];

export function StockMovementModal({ item, onClose, onSaved }: { item: CatalogItem; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    movement_type: 'purchase' as (typeof movementTypes)[number]['value'],
    quantity: '',
    counted: '',
    unit_cost: item.cost != null ? String(item.cost).replace('.', ',') : '',
    batch: '',
    expires_on: '',
    supplier: '',
    document: '',
    notes: '',
  });
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const isAdjust = form.movement_type === 'adjustment';
  const current = Number(item.stock_qty);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let quantity = Number(form.quantity.replace(',', '.'));
    if (isAdjust) quantity = Number(form.counted.replace(',', '.')) - current;
    if (form.movement_type === 'loss') quantity = -Math.abs(quantity);
    if (!Number.isFinite(quantity) || quantity === 0) {
      setError(isAdjust ? 'A contagem é igual ao estoque atual.' : 'Informe a quantidade.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('stock_movements').insert({
      item_id: item.id,
      movement_type: form.movement_type,
      quantity,
      unit_cost: form.movement_type === 'purchase' && form.unit_cost ? parseMoney(form.unit_cost) : null,
      batch: form.batch.trim() || null,
      expires_on: form.expires_on || null,
      supplier: form.supplier.trim() || null,
      document: form.document.trim() || null,
      notes: form.notes.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível registrar a movimentação.'));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal title={`Movimentar estoque • ${item.name}`} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />
        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
          Estoque atual: <strong>{current.toLocaleString('pt-BR')} {item.unit}</strong>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Tipo</label>
            <select value={form.movement_type} onChange={set('movement_type')} className={fieldClass}>
              {movementTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {isAdjust ? (
            <div className="sm:col-span-2">
              <label className={labelClass}>Quantidade contada *</label>
              <input required inputMode="decimal" value={form.counted} onChange={set('counted')} className={fieldClass} />
            </div>
          ) : (
            <div>
              <label className={labelClass}>Quantidade *</label>
              <input required inputMode="decimal" value={form.quantity} onChange={set('quantity')} className={fieldClass} />
            </div>
          )}
          {form.movement_type === 'purchase' && (
            <>
              <div>
                <label className={labelClass}>Custo unitário (R$)</label>
                <input inputMode="decimal" value={form.unit_cost} onChange={set('unit_cost')} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Lote</label>
                <input value={form.batch} onChange={set('batch')} maxLength={60} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Validade</label>
                <input type="date" value={form.expires_on} onChange={set('expires_on')} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Fornecedor</label>
                <input value={form.supplier} onChange={set('supplier')} maxLength={160} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Nota fiscal</label>
                <input value={form.document} onChange={set('document')} maxLength={80} className={fieldClass} />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label className={labelClass}>Observação</label>
            <input value={form.notes} onChange={set('notes')} maxLength={500} className={fieldClass} />
          </div>
        </div>
        <FormActions submitLabel="Registrar" onCancel={onClose} busy={busy} />
      </form>
    </Modal>
  );
}

// Importa o XML da NF-e de compra: associa cada item a um produto existente
// (por código de barras, SKU ou nome) ou cadastra, e lança a entrada no estoque.
export function NfeImportModal({ items, canFinance, onClose, onSaved }: { items: CatalogItem[]; canFinance: boolean; onClose: () => void; onSaved: () => void }) {
  const [nfe, setNfe] = useState<Nfe | null>(null);
  const [links, setLinks] = useState<string[]>([]); // id do item ou '' = cadastrar
  const [margin, setMargin] = useState('60');
  const [payable, setPayable] = useState({ create: canFinance, due_on: todayISO() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const products = items.filter((i) => i.kind === 'product');

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const parsed = parseNfe(await file.text());
      setNfe(parsed);
      setLinks(
        parsed.items.map((it) => {
          const name = it.name.toLowerCase();
          const match =
            products.find((p) => it.barcode && p.barcode === it.barcode) ??
            products.find((p) => it.code && p.sku === it.code) ??
            products.find((p) => p.name.toLowerCase() === name);
          return match?.id ?? '';
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.');
    }
  };

  const total = nfe?.items.reduce((sum, it) => sum + it.quantity * it.unit_cost, 0) ?? 0;

  const handleImport = async () => {
    if (!nfe) return;
    setBusy(true);
    setError(null);
    const markup = 1 + (Number(margin) || 0) / 100;
    for (const [index, it] of nfe.items.entries()) {
      let itemId = links[index];
      if (!itemId) {
        const { data, error } = await supabase
          .from('catalog_items')
          .insert({
            kind: 'product',
            name: it.name.slice(0, 160),
            sku: it.code || null,
            barcode: it.barcode,
            unit: it.unit,
            cost: it.unit_cost,
            price: Math.round(it.unit_cost * markup * 100) / 100,
            track_stock: true,
          })
          .select('id')
          .single();
        if (error) {
          setBusy(false);
          setError(`${it.name}: ${dbErrorMessage(error, 'não foi possível cadastrar.')}`);
          return;
        }
        itemId = data.id;
      } else {
        await supabase.from('catalog_items').update({ cost: it.unit_cost, track_stock: true }).eq('id', itemId);
      }
      const { error } = await supabase.from('stock_movements').insert({
        item_id: itemId,
        movement_type: 'purchase',
        quantity: it.quantity,
        unit_cost: it.unit_cost,
        batch: it.batch,
        expires_on: it.expires_on,
        supplier: nfe.supplier || null,
        document: nfe.number ? `NF-e ${nfe.number}` : null,
      });
      if (error) {
        setBusy(false);
        setError(`${it.name}: ${dbErrorMessage(error, 'não foi possível lançar a entrada.')}`);
        return;
      }
    }
    if (payable.create && canFinance && total > 0) {
      await supabase.from('financial_entries').insert({
        kind: 'expense',
        description: `Compra ${nfe.supplier || 'fornecedor'}${nfe.number ? ` • NF-e ${nfe.number}` : ''}`.slice(0, 200),
        amount: Math.round(total * 100) / 100,
        due_on: payable.due_on,
        supplier: nfe.supplier || null,
        document: nfe.number || null,
      });
    }
    setBusy(false);
    setDone(`${nfe.items.length} item(ns) lançados no estoque.`);
    onSaved();
  };

  return (
    <Modal title="Importar NF-e de compra (XML)" onClose={onClose} size="xl">
      <div className="p-4 sm:p-6 space-y-4">
        <FormError message={error} />
        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg p-3">{done}</p>
            <button onClick={onClose} className="w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium">
              Concluir
            </button>
          </div>
        ) : !nfe ? (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400">
            <FileUp className="w-8 h-8 text-emerald-600" />
            <span className="font-medium text-slate-700">Selecione o arquivo XML da nota</span>
            <span className="text-xs text-slate-500">Os itens são associados aos produtos pelo código de barras, código ou nome. Lote e validade são lidos quando informados.</span>
            <input type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        ) : (
          <>
            <div className="text-sm text-slate-600 flex flex-wrap gap-x-6 gap-y-1">
              <span>
                Fornecedor: <strong className="text-slate-800">{nfe.supplier || '-'}</strong>
              </span>
              <span>NF-e: {nfe.number || '-'}</span>
              <span>Total: {formatBRL(total)}</span>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Item da nota</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    <th className="px-3 py-2 text-right">Custo</th>
                    <th className="px-3 py-2 text-left">Produto no sistema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nfe.items.map((it, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <p className="text-slate-800">{it.name}</p>
                        <p className="text-xs text-slate-500">
                          {it.barcode ?? it.code}
                          {it.batch && ` • lote ${it.batch}`}
                          {it.expires_on && ` • val. ${it.expires_on.split('-').reverse().join('/')}`}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {it.quantity.toLocaleString('pt-BR')} {it.unit}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatBRL(it.unit_cost)}</td>
                      <td className="px-3 py-2 min-w-[12rem]">
                        <select
                          value={links[index]}
                          onChange={(e) => setLinks((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
                          className={fieldClass}
                        >
                          <option value="">+ Cadastrar como novo</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Margem para novos produtos (%)</label>
                <input type="number" min="0" value={margin} onChange={(e) => setMargin(e.target.value)} className={fieldClass} />
              </div>
              {canFinance && (
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 mb-1">
                    <input type="checkbox" checked={payable.create} onChange={(e) => setPayable((p) => ({ ...p, create: e.target.checked }))} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                    Lançar conta a pagar com vencimento em
                  </label>
                  <input type="date" value={payable.due_on} disabled={!payable.create} onChange={(e) => setPayable((p) => ({ ...p, due_on: e.target.value }))} className={fieldClass} />
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button type="button" onClick={() => setNfe(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">
                Trocar arquivo
              </button>
              <button type="button" disabled={busy} onClick={handleImport} className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-medium">
                {busy ? 'Importando...' : 'Lançar entrada no estoque'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
