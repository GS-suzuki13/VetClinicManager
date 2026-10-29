import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownUp, FileUp, Pencil } from 'lucide-react';
import { supabase, CatalogItem, StockMovement, StockMovementType } from '../lib/supabase';
import { formatDate, todayISO, toISODate } from '../lib/format';
import { formatBRL, formatDateTime } from '../lib/money';
import { useClinic } from '../context/AuthContext';
import PageToolbar, { IconButton, PageLoader, tdClass, thClass } from '../components/PageToolbar';
import { CatalogItemModal, NfeImportModal, StockMovementModal } from '../components/CatalogModals';
import { Badge, Card, EmptyRow, SecondaryButton, StatTile, Tabs } from '../components/ui';

type Tab = 'items' | 'movements' | 'alerts';
type MovementWithItem = StockMovement & { catalog_items: Pick<CatalogItem, 'name' | 'unit'> | null };

const movementLabel: Record<StockMovementType, string> = {
  purchase: 'Entrada',
  adjustment: 'Ajuste',
  loss: 'Perda',
  return: 'Devolução',
  sale: 'Venda',
  sale_cancel: 'Venda cancelada',
};

function isLowStock(item: CatalogItem) {
  return item.track_stock && item.min_stock != null && Number(item.stock_qty) <= Number(item.min_stock);
}

export default function Catalog() {
  const { role } = useClinic();
  const canFinance = role === 'owner' || role === 'admin';
  const [tab, setTab] = useState<Tab>('items');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [movements, setMovements] = useState<MovementWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'all' | 'product' | 'service'>('all');
  const [modal, setModal] = useState<{ type: 'item'; item: CatalogItem | null } | { type: 'move'; item: CatalogItem } | { type: 'nfe' } | null>(null);

  const load = useCallback(async () => {
    const [i, m] = await Promise.all([
      supabase.from('catalog_items').select('*').order('name'),
      supabase.from('stock_movements').select('*, catalog_items(name, unit)').order('occurred_at', { ascending: false }).limit(300),
    ]);
    if (i.error) console.error('Erro ao carregar itens:', i.error);
    setItems(i.data ?? []);
    setMovements((m.data as MovementWithItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const term = search.toLowerCase();
  const filtered = items.filter(
    (i) =>
      (kind === 'all' || i.kind === kind) &&
      (i.name.toLowerCase().includes(term) || i.barcode?.includes(search) || i.sku?.toLowerCase().includes(term) || i.category?.toLowerCase().includes(term))
  );

  const lowStock = items.filter((i) => i.active && isLowStock(i));

  // Lotes com validade nos próximos 60 dias (ou vencidos) de itens que ainda têm estoque.
  const expiring = useMemo(() => {
    const limit = new Date();
    limit.setDate(limit.getDate() + 60);
    const max = toISODate(limit);
    const inStock = new Set(items.filter((i) => Number(i.stock_qty) > 0).map((i) => i.id));
    return movements
      .filter((m) => m.movement_type === 'purchase' && m.expires_on && m.expires_on <= max && inStock.has(m.item_id))
      .sort((a, b) => a.expires_on!.localeCompare(b.expires_on!));
  }, [items, movements]);

  const stockValue = items.reduce((sum, i) => sum + (i.track_stock ? Math.max(Number(i.stock_qty), 0) * Number(i.cost ?? 0) : 0), 0);

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatTile label="Itens ativos" value={items.filter((i) => i.active).length} />
        <StatTile label="Valor em estoque (custo)" value={formatBRL(stockValue)} tone="emerald" />
        <StatTile label="Abaixo do mínimo" value={lowStock.length} tone={lowStock.length ? 'red' : 'slate'} />
        <StatTile label="Vencendo em 60 dias" value={expiring.length} tone={expiring.length ? 'amber' : 'slate'} />
      </div>

      <Tabs
        tabs={[
          ['items', 'Produtos e serviços'],
          ['movements', 'Movimentações'],
          ['alerts', `Alertas${lowStock.length + expiring.length ? ` (${lowStock.length + expiring.length})` : ''}`],
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'items' && (
        <>
          <PageToolbar search={search} onSearch={setSearch} placeholder="Nome, código de barras, SKU ou categoria..." actionLabel="Novo item" onAction={() => setModal({ type: 'item', item: null })}>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm">
              <option value="all">Todos</option>
              <option value="product">Produtos</option>
              <option value="service">Serviços</option>
            </select>
            <SecondaryButton onClick={() => setModal({ type: 'nfe' })}>
              <FileUp className="w-4 h-4" />
              Importar NF-e
            </SecondaryButton>
          </PageToolbar>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={thClass}>Item</th>
                    <th className={`${thClass} hidden md:table-cell`}>Categoria</th>
                    <th className={`${thClass} text-right`}>Preço</th>
                    <th className={`${thClass} text-right hidden sm:table-cell`}>Estoque</th>
                    <th className={`${thClass} text-right`}>Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.length === 0 ? (
                    <EmptyRow colSpan={5}>Nenhum item. Cadastre produtos e serviços ou importe uma NF-e de compra.</EmptyRow>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.id} className={`hover:bg-slate-50 ${item.active ? '' : 'opacity-60'}`}>
                        <td className={tdClass}>
                          <p className="font-medium text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.kind === 'service' ? 'Serviço' : 'Produto'}
                            {item.barcode && ` • ${item.barcode}`}
                            {!item.active && ' • inativo'}
                          </p>
                        </td>
                        <td className={`${tdClass} text-slate-600 hidden md:table-cell`}>{item.category ?? '-'}</td>
                        <td className={`${tdClass} text-right text-slate-800 whitespace-nowrap`}>{formatBRL(item.price)}</td>
                        <td className={`${tdClass} text-right hidden sm:table-cell whitespace-nowrap`}>
                          {item.track_stock ? (
                            <span className={isLowStock(item) ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                              {Number(item.stock_qty).toLocaleString('pt-BR')} {item.unit}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className={tdClass}>
                          <div className="flex justify-end gap-1">
                            {item.track_stock && (
                              <IconButton tone="blue" title="Movimentar estoque" onClick={() => setModal({ type: 'move', item })}>
                                <ArrowDownUp className="w-4 h-4" />
                              </IconButton>
                            )}
                            <IconButton tone="blue" title="Editar" onClick={() => setModal({ type: 'item', item })}>
                              <Pencil className="w-4 h-4" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'movements' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={thClass}>Data</th>
                  <th className={thClass}>Item</th>
                  <th className={thClass}>Tipo</th>
                  <th className={`${thClass} text-right`}>Qtd</th>
                  <th className={`${thClass} hidden md:table-cell`}>Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movements.length === 0 ? (
                  <EmptyRow colSpan={5}>Nenhuma movimentação ainda.</EmptyRow>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id}>
                      <td className={`${tdClass} text-slate-600 whitespace-nowrap`}>{formatDateTime(m.occurred_at)}</td>
                      <td className={`${tdClass} text-slate-800`}>{m.catalog_items?.name ?? '-'}</td>
                      <td className={tdClass}>
                        <Badge className={Number(m.quantity) > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>{movementLabel[m.movement_type]}</Badge>
                      </td>
                      <td className={`${tdClass} text-right font-medium ${Number(m.quantity) > 0 ? 'text-green-700' : 'text-orange-700'}`}>
                        {Number(m.quantity) > 0 ? '+' : ''}
                        {Number(m.quantity).toLocaleString('pt-BR')}
                      </td>
                      <td className={`${tdClass} text-slate-500 text-xs hidden md:table-cell`}>
                        {[m.supplier, m.document, m.batch && `lote ${m.batch}`, m.expires_on && `val. ${formatDate(m.expires_on)}`, m.notes, m.author_email]
                          .filter(Boolean)
                          .join(' • ')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Abaixo do estoque mínimo (sugestão de compra)">
            {lowStock.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 text-center">Tudo acima do mínimo.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {lowStock.map((i) => {
                  const suggestion = Math.max(Number(i.min_stock) * 2 - Number(i.stock_qty), 1);
                  return (
                    <li key={i.id} className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-800">{i.name}</p>
                        <p className="text-xs text-slate-500">
                          Estoque {Number(i.stock_qty).toLocaleString('pt-BR')} • mínimo {Number(i.min_stock).toLocaleString('pt-BR')} • comprar ~{suggestion.toLocaleString('pt-BR')} {i.unit}
                        </p>
                      </div>
                      <button onClick={() => setModal({ type: 'move', item: i })} className="text-emerald-700 text-xs font-medium hover:underline whitespace-nowrap">
                        Lançar entrada
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title="Lotes vencidos ou vencendo em 60 dias">
            {expiring.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 text-center">Nenhum lote perto do vencimento.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {expiring.map((m) => {
                  const expired = m.expires_on! < todayISO();
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-800">{m.catalog_items?.name}</p>
                        <p className="text-xs text-slate-500">
                          {m.batch ? `Lote ${m.batch} • ` : ''}entrada de {Number(m.quantity).toLocaleString('pt-BR')} {m.catalog_items?.unit}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-medium whitespace-nowrap ${expired ? 'text-red-600' : 'text-amber-700'}`}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {expired ? 'Venceu' : 'Vence'} {formatDate(m.expires_on)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {modal?.type === 'item' && <CatalogItemModal item={modal.item} onClose={() => setModal(null)} onSaved={load} />}
      {modal?.type === 'move' && <StockMovementModal item={modal.item} onClose={() => setModal(null)} onSaved={load} />}
      {modal?.type === 'nfe' && <NfeImportModal items={items} canFinance={canFinance} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  );
}
