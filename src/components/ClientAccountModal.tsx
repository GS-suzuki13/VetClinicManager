import { FormEvent, useCallback, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { supabase, Client, ClientAccountEntry, PaymentMethod } from '../lib/supabase';
import { dbErrorMessage } from '../lib/format';
import { cashMethods, formatBRL, formatDateTime, parseMoney, paymentMethodLabel } from '../lib/money';
import { fillTemplate, firstName, sendWhatsapp } from '../lib/messages';
import { useClinic } from '../context/AuthContext';
import Modal, { FormError, fieldClass, labelClass } from './Modal';

// Conta corrente do cliente: extrato, recebimento de débito/adiantamento e
// lembrete de pagamento pelo WhatsApp.
export default function ClientAccountModal({ client, onClose, onChanged }: { client: Client; onClose: () => void; onChanged?: () => void }) {
  const clinic = useClinic();
  const [entries, setEntries] = useState<ClientAccountEntry[]>([]);
  const [form, setForm] = useState({ amount: '', method: 'pix' as PaymentMethod, notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('client_account_entries').select('*').eq('client_id', client.id).order('created_at', { ascending: false });
    setEntries(data ?? []);
  }, [client.id]);

  useEffect(() => {
    load();
  }, [load]);

  const balance = entries.reduce((s, e) => s + Number(e.amount), 0);

  const receive = async (e: FormEvent) => {
    e.preventDefault();
    const amount = parseMoney(form.amount);
    if (!amount || Number.isNaN(amount)) {
      setError('Informe o valor.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('receive_client_payment', { p_client_id: client.id, p_amount: amount, p_method: form.method, p_notes: form.notes });
    setBusy(false);
    if (error) {
      setError(dbErrorMessage(error, 'Não foi possível registrar o recebimento.'));
      return;
    }
    setForm({ amount: '', method: form.method, notes: '' });
    await load();
    onChanged?.();
  };

  const remind = async () => {
    const { data } = await supabase.from('message_templates').select('body').eq('key', 'debt').maybeSingle();
    const text = fillTemplate(data?.body ?? 'Olá, {tutor}! Consta um saldo em aberto de {valor} na {clinica}.', {
      tutor: firstName(client.full_name),
      clinica: clinic.name,
      valor: formatBRL(-balance),
    });
    await sendWhatsapp({ phone: client.phone_number, text, clientId: client.id, templateKey: 'debt' });
  };

  return (
    <Modal title={`Conta corrente • ${client.full_name}`} onClose={onClose}>
      <div className="p-4 sm:p-6 space-y-5">
        <div className={`rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 ${balance < 0 ? 'bg-red-50' : balance > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Saldo</p>
            <p className={`text-2xl font-bold ${balance < 0 ? 'text-red-600' : balance > 0 ? 'text-emerald-700' : 'text-slate-800'}`}>
              {balance < 0 ? `Deve ${formatBRL(-balance)}` : balance > 0 ? `Crédito de ${formatBRL(balance)}` : formatBRL(0)}
            </p>
          </div>
          {balance < 0 && (
            <button onClick={remind} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              Lembrar pelo WhatsApp
            </button>
          )}
        </div>

        <form onSubmit={receive} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <FormError message={error} />
          <div>
            <label className={labelClass}>{balance < 0 ? 'Receber' : 'Adiantamento'} (R$)</label>
            <input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={balance < 0 ? String(-balance).replace('.', ',') : '0,00'} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Forma</label>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })} className={fieldClass}>
              {cashMethods.map((m) => (
                <option key={m} value={m}>
                  {paymentMethodLabel[m]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={busy} className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-medium">
            {busy ? 'Registrando...' : 'Registrar'}
          </button>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observação (opcional)" maxLength={200} className={`${fieldClass} sm:col-span-3`} />
        </form>
        <p className="text-xs text-slate-500 -mt-2">O recebimento entra no caixa aberto e no financeiro. Valor acima da dívida fica como crédito para as próximas vendas.</p>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Extrato</h4>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">Sem movimentações. Vendas "a prazo" e adiantamentos aparecem aqui.</p>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div>
                    <p className="text-slate-800">{e.description}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(e.created_at)}
                      {e.author_email && ` • ${e.author_email}`}
                    </p>
                  </div>
                  <span className={`font-medium whitespace-nowrap ${Number(e.amount) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {Number(e.amount) > 0 ? '+' : ''}
                    {formatBRL(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
