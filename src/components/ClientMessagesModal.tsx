import { FormEvent, useCallback, useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { supabase, Animal, Client, ClientMessage, MessageChannel, MessageTemplate } from '../lib/supabase';
import { dbErrorMessage } from '../lib/format';
import { formatDateTime } from '../lib/money';
import { channelLabel, fillTemplate, firstName, sendWhatsapp } from '../lib/messages';
import { useClinic } from '../context/AuthContext';
import Modal, { FormError, fieldClass } from './Modal';

// Conversa com o tutor nos dois sentidos: mensagens enviadas pelo WhatsApp e
// respostas/ligações registradas pela equipe, tudo no histórico do cliente.
export default function ClientMessagesModal({ client, animal, onClose }: { client: Client; animal?: Pick<Animal, 'id' | 'name'> | null; onClose: () => void }) {
  const clinic = useClinic();
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [form, setForm] = useState({ body: '', direction: 'outbound' as 'outbound' | 'inbound', channel: 'whatsapp' as MessageChannel });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('client_messages').select('*').eq('client_id', client.id).order('created_at');
    setMessages(data ?? []);
  }, [client.id]);

  useEffect(() => {
    load();
    supabase.from('message_templates').select('*').eq('active', true).order('name').then(({ data }) => setTemplates(data ?? []));
  }, [load]);

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setForm((f) => ({ ...f, direction: 'outbound', body: fillTemplate(t.body, { tutor: firstName(client.full_name), pet: animal?.name ?? 'seu pet', clinica: clinic.name }) }));
  };

  const submit = async (e: FormEvent, viaWhatsapp: boolean) => {
    e.preventDefault();
    if (!form.body.trim()) return;
    setBusy(true);
    setError(null);
    if (viaWhatsapp) {
      await sendWhatsapp({ phone: client.phone_number, text: form.body.trim(), clientId: client.id, animalId: animal?.id });
    } else {
      const { error } = await supabase.from('client_messages').insert({
        client_id: client.id,
        animal_id: animal?.id ?? null,
        channel: form.channel,
        direction: form.direction,
        body: form.body.trim(),
      });
      if (error) setError(dbErrorMessage(error, 'Não foi possível registrar.'));
    }
    setBusy(false);
    setForm((f) => ({ ...f, body: '' }));
    load();
  };

  return (
    <Modal title={`Conversas • ${client.full_name}`} onClose={onClose}>
      <div className="flex flex-col">
        <div className="p-4 sm:p-6 space-y-3 bg-slate-50 min-h-[12rem] max-h-[45vh] overflow-y-auto">
          {messages.length === 0 && <p className="text-center text-sm text-slate-500 py-8">Nenhuma conversa registrada com este tutor.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${m.direction === 'outbound' ? 'bg-emerald-500 text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-bl-sm'}`}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`text-[11px] mt-1 ${m.direction === 'outbound' ? 'text-emerald-50' : 'text-slate-400'}`}>
                  {channelLabel[m.channel]} • {formatDateTime(m.created_at)}
                  {m.author_email && ` • ${m.author_email}`}
                </p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={(e) => submit(e, form.direction === 'outbound' && form.channel === 'whatsapp')} className="p-4 sm:p-6 space-y-3 border-t border-slate-200">
          <FormError message={error} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as typeof form.direction })} className={fieldClass}>
              <option value="outbound">Enviada pela clínica</option>
              <option value="inbound">Recebida do tutor</option>
            </select>
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as MessageChannel })} className={fieldClass}>
              {(Object.keys(channelLabel) as MessageChannel[]).map((c) => (
                <option key={c} value={c}>
                  {channelLabel[c]}
                </option>
              ))}
            </select>
            <select value="" onChange={(e) => applyTemplate(e.target.value)} className={fieldClass}>
              <option value="">Usar modelo...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={4000} placeholder={form.direction === 'inbound' ? 'O que o tutor respondeu ou disse na ligação...' : 'Mensagem para o tutor...'} className={fieldClass} />
          <button type="submit" disabled={busy || !form.body.trim()} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-medium">
            {form.direction === 'outbound' && form.channel === 'whatsapp' ? (
              <>
                <MessageCircle className="w-4 h-4" />
                Abrir no WhatsApp e registrar
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Registrar na conversa
              </>
            )}
          </button>
        </form>
      </div>
    </Modal>
  );
}
