import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Lock, Unlock } from 'lucide-react';
import { supabase, CashAdjustment, CashSession, Payment, PaymentMethod } from '../lib/supabase';
import { dbErrorMessage } from '../lib/format';
import { formatBRL, formatDateTime, parseMoney, paymentMethodLabel } from '../lib/money';
import { useClinic } from '../context/AuthContext';
import { PageLoader, tdClass, thClass } from '../components/PageToolbar';
import { FormError, fieldClass, labelClass } from '../components/Modal';
import { Card, EmptyRow, PrimaryButton, SecondaryButton, StatTile } from '../components/ui';
import { askConfirm } from '../lib/dialogs';

// Caixa: abertura, recebimentos por forma de pagamento, sangria/suprimento e
// fechamento com conferência do dinheiro.
export default function Register() {
  const clinic = useClinic();
  const isManager = clinic.role === 'owner' || clinic.role === 'admin';
  const [session, setSession] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [adjustments, setAdjustments] = useState<CashAdjustment[]>([]);
  const [expected, setExpected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState('');
  const [adjust, setAdjust] = useState({ kind: 'withdrawal' as 'withdrawal' | 'deposit', amount: '', reason: '' });
  const [closing, setClosing] = useState({ counted: '', notes: '' });
  const [maxDiscount, setMaxDiscount] = useState('');

  const load = useCallback(async () => {
    const { data: sessions } = await supabase.from('cash_sessions').select('*').order('opened_at', { ascending: false }).limit(30);
    const open = (sessions ?? []).find((s) => s.status === 'open') ?? null;
    setSession(open);
    setHistory((sessions ?? []).filter((s) => s.status === 'closed'));
    if (open) {
      const [p, a, e] = await Promise.all([
        supabase.from('payments').select('*').eq('cash_session_id', open.id).order('received_at', { ascending: false }),
        supabase.from('cash_adjustments').select('*').eq('session_id', open.id).order('created_at', { ascending: false }),
        supabase.rpc('cash_session_expected', { p_session_id: open.id }),
      ]);
      setPayments(p.data ?? []);
      setAdjustments(a.data ?? []);
      setExpected(Number(e.data ?? 0));
    }
    const { data: c } = await supabase.from('clinics').select('max_discount_pct').eq('id', clinic.id).single();
    if (c) setMaxDiscount(String(c.max_discount_pct));
    setLoading(false);
  }, [clinic.id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => PromiseLike<{ error: { code?: string; message?: string } | null }>, fallback: string) => {
    setError(null);
    const { error } = await fn();
    if (error) {
      setError(dbErrorMessage(error, fallback));
      return false;
    }
    await load();
    return true;
  };

  const openSession = (e: FormEvent) => {
    e.preventDefault();
    run(() => supabase.rpc('open_cash_session', { p_opening_amount: parseMoney(opening) || 0 }), 'Não foi possível abrir o caixa.');
  };

  const addAdjustment = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(
      () => supabase.rpc('add_cash_adjustment', { p_kind: adjust.kind, p_amount: parseMoney(adjust.amount), p_reason: adjust.reason }),
      'Não foi possível registrar.'
    );
    if (ok) setAdjust({ ...adjust, amount: '', reason: '' });
  };

  const closeSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const counted = parseMoney(closing.counted);
    if (Number.isNaN(counted)) {
      setError('Valor contado inválido.');
      return;
    }
    if (!(await askConfirm(`Fechar o caixa com ${formatBRL(counted)} em dinheiro? Esperado: ${formatBRL(expected)}.`, { title: 'Fechar caixa', confirmLabel: 'Fechar caixa' }))) return;
    const ok = await run(() => supabase.rpc('close_cash_session', { p_session_id: session.id, p_counted: counted, p_notes: closing.notes }), 'Não foi possível fechar o caixa.');
    if (ok) setClosing({ counted: '', notes: '' });
  };

  const saveDiscount = () =>
    run(() => supabase.from('clinics').update({ max_discount_pct: Number(maxDiscount) }).eq('id', clinic.id), 'Não foi possível salvar o limite.');

  if (loading) return <PageLoader />;

  const byMethod = payments.reduce<Partial<Record<PaymentMethod, number>>>((acc, p) => {
    acc[p.method] = (acc[p.method] ?? 0) + Number(p.amount);
    return acc;
  }, {});
  const received = payments.filter((p) => p.method !== 'on_account' && p.method !== 'client_credit').reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <FormError message={error} />

      {!session ? (
        <Card title="Caixa fechado">
          <form onSubmit={openSession} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 sm:max-w-xs">
              <label className={labelClass}>Dinheiro na gaveta (troco inicial)</label>
              <input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0,00" className={fieldClass} />
            </div>
            <PrimaryButton type="submit">
              <Unlock className="w-4 h-4" />
              Abrir caixa
            </PrimaryButton>
          </form>
          <p className="px-4 sm:px-6 pb-4 text-sm text-slate-500">Vendas e recebimentos exigem caixa aberto.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatTile label="Aberto em" value={<span className="text-base">{formatDateTime(session.opened_at)}</span>} hint={session.opened_by_email ?? undefined} />
            <StatTile label="Recebido no caixa" value={formatBRL(received)} tone="emerald" />
            <StatTile label="Dinheiro esperado" value={formatBRL(expected)} tone="blue" hint={`Abertura ${formatBRL(session.opening_amount)}`} />
            <StatTile label="Vendido a prazo" value={formatBRL(byMethod.on_account ?? 0)} tone={byMethod.on_account ? 'amber' : 'slate'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title="Por forma de pagamento">
              <ul className="divide-y divide-slate-100 text-sm">
                {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map((m) => (
                  <li key={m} className="flex justify-between px-4 sm:px-6 py-2.5">
                    <span className="text-slate-600">{paymentMethodLabel[m]}</span>
                    <span className="font-medium text-slate-800">{formatBRL(byMethod[m] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Sangria e suprimento">
              <form onSubmit={addAdjustment} className="p-4 sm:p-6 space-y-3">
                <select value={adjust.kind} onChange={(e) => setAdjust({ ...adjust, kind: e.target.value as typeof adjust.kind })} className={fieldClass}>
                  <option value="withdrawal">Sangria (retirada)</option>
                  <option value="deposit">Suprimento (reforço de troco)</option>
                </select>
                <input required inputMode="decimal" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} placeholder="Valor" className={fieldClass} />
                <input required value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} maxLength={300} placeholder="Motivo" className={fieldClass} />
                <PrimaryButton type="submit">Registrar</PrimaryButton>
              </form>
              {adjustments.length > 0 && (
                <ul className="divide-y divide-slate-100 text-sm border-t border-slate-100">
                  {adjustments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-4 sm:px-6 py-2">
                      <span className="flex items-center gap-2 text-slate-600">
                        {a.kind === 'withdrawal' ? <ArrowUpCircle className="w-4 h-4 text-orange-500" /> : <ArrowDownCircle className="w-4 h-4 text-emerald-600" />}
                        {a.reason}
                      </span>
                      <span className={a.kind === 'withdrawal' ? 'text-orange-600' : 'text-emerald-700'}>
                        {a.kind === 'withdrawal' ? '−' : '+'}
                        {formatBRL(a.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Fechar caixa">
              <form onSubmit={closeSession} className="p-4 sm:p-6 space-y-3">
                <div>
                  <label className={labelClass}>Dinheiro contado na gaveta</label>
                  <input required inputMode="decimal" value={closing.counted} onChange={(e) => setClosing({ ...closing, counted: e.target.value })} className={fieldClass} />
                  {closing.counted && !Number.isNaN(parseMoney(closing.counted)) && (
                    <p className={`text-xs mt-1 ${parseMoney(closing.counted) === expected ? 'text-emerald-700' : 'text-red-600'}`}>
                      Diferença: {formatBRL(parseMoney(closing.counted) - expected)}
                    </p>
                  )}
                </div>
                <textarea rows={2} value={closing.notes} onChange={(e) => setClosing({ ...closing, notes: e.target.value })} placeholder="Observações" className={fieldClass} />
                <PrimaryButton type="submit">
                  <Lock className="w-4 h-4" />
                  Fechar caixa
                </PrimaryButton>
              </form>
            </Card>
          </div>

          <Card title="Recebimentos deste caixa">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={thClass}>Hora</th>
                    <th className={thClass}>Forma</th>
                    <th className={`${thClass} hidden md:table-cell`}>Origem</th>
                    <th className={`${thClass} text-right`}>Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {payments.length === 0 ? (
                    <EmptyRow colSpan={4}>Nenhum recebimento ainda.</EmptyRow>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id}>
                        <td className={`${tdClass} text-slate-600 whitespace-nowrap`}>{formatDateTime(p.received_at)}</td>
                        <td className={tdClass}>
                          {paymentMethodLabel[p.method]}
                          {p.installments > 1 && ` (${p.installments}x)`}
                        </td>
                        <td className={`${tdClass} text-slate-500 text-xs hidden md:table-cell`}>{p.sale_id ? 'Venda' : 'Recebimento de cliente'}{p.notes ? ` • ${p.notes}` : ''}</td>
                        <td className={`${tdClass} text-right font-medium ${Number(p.amount) < 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatBRL(p.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Caixas anteriores" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={thClass}>Período</th>
                  <th className={`${thClass} text-right`}>Esperado</th>
                  <th className={`${thClass} text-right`}>Contado</th>
                  <th className={`${thClass} text-right`}>Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {history.length === 0 ? (
                  <EmptyRow colSpan={4}>Nenhum caixa fechado ainda.</EmptyRow>
                ) : (
                  history.map((h) => {
                    const diff = Number(h.closing_amount ?? 0) - Number(h.expected_amount ?? 0);
                    return (
                      <tr key={h.id}>
                        <td className={`${tdClass} text-slate-600 text-xs`}>
                          {formatDateTime(h.opened_at)} → {formatDateTime(h.closed_at)}
                          {h.notes && <span className="block text-slate-500">{h.notes}</span>}
                        </td>
                        <td className={`${tdClass} text-right`}>{formatBRL(h.expected_amount)}</td>
                        <td className={`${tdClass} text-right`}>{formatBRL(h.closing_amount)}</td>
                        <td className={`${tdClass} text-right font-medium ${diff === 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatBRL(diff)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
        {isManager && (
          <Card title="Regras de venda">
            <div className="p-4 sm:p-6 space-y-3">
              <div>
                <label className={labelClass}>Desconto máximo sem autorização (%)</label>
                <input type="number" min="0" max="100" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} className={fieldClass} />
                <p className="text-xs text-slate-500 mt-1">Veterinários e recepção não finalizam vendas acima desse desconto. Proprietário e administradores não têm limite.</p>
              </div>
              <SecondaryButton onClick={saveDiscount}>Salvar limite</SecondaryButton>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
