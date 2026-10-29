import type { PaymentMethod } from './supabase';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(value: number | string | null | undefined) {
  return brl.format(Number(value ?? 0));
}

// Aceita "1.234,56", "1234.56" e "1234,5".
export function parseMoney(input: string) {
  const clean = input.trim().replace(/\s|R\$/g, '');
  if (!clean) return 0;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão de crédito',
  bank_transfer: 'Transferência',
  client_credit: 'Crédito do cliente',
  on_account: 'A prazo (conta do cliente)',
};

// Formas que entram no caixa/banco (as de conta corrente não).
export const cashMethods: PaymentMethod[] = ['cash', 'pix', 'debit_card', 'credit_card', 'bank_transfer'];

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
