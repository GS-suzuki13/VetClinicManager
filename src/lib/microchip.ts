import type { MicrochipEventType, MicrochipStatus } from './supabase';

// Mesma normalização do banco (trigger normalize_microchip_code).
export function normalizeChipCode(raw: string) {
  return raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

// Códigos de fabricante ICAR mais comuns no Brasil (900–998 = fabricante).
const MANUFACTURER_CODES: Record<string, string> = {
  '977': 'Avid',
  '981': 'Datamars',
  '982': 'Allflex',
  '985': 'Destron Fearing',
};

export interface ChipCodeInfo {
  valid: boolean;
  format?: string;
  origin?: string;
  warning?: string;
}

// Interpreta o código lido/digitado: formato, origem (fabricante ou país) e avisos.
export function describeChipCode(raw: string): ChipCodeInfo {
  const code = normalizeChipCode(raw);
  if (!code) return { valid: false };

  if (/^[0-9]{15}$/.test(code)) {
    const prefix = code.slice(0, 3);
    const n = Number(prefix);
    if (prefix === '999') {
      return { valid: true, format: 'ISO 11784/11785', origin: 'Código 999', warning: 'Prefixo 999 é reservado a transponders de teste.' };
    }
    if (n >= 900) {
      const name = MANUFACTURER_CODES[prefix];
      return { valid: true, format: 'ISO 11784/11785', origin: `Fabricante ${prefix}${name ? ` (${name})` : ''}` };
    }
    return {
      valid: true,
      format: 'ISO 11784/11785',
      origin: prefix === '076' ? 'País 076 (Brasil)' : `País ${prefix} (ISO 3166)`,
    };
  }
  if (/^[0-9]{9}$/.test(code)) {
    return { valid: true, format: 'AVID (legado, 9 dígitos)', warning: 'Formato não ISO: leitores ISO comuns podem não ler este chip.' };
  }
  if (/^[0-9A-F]{10}$/.test(code)) {
    return { valid: true, format: 'FDX-A (legado, 125 kHz)', warning: 'Formato não ISO: exigências internacionais pedem chip ISO 11784/11785.' };
  }
  return { valid: false, warning: 'Use 15 dígitos (ISO), 10 caracteres hexadecimais (FDX-A) ou 9 dígitos (AVID).' };
}

// Exibe códigos ISO em blocos (3-3-3-3-3) para facilitar a conferência visual.
export function formatChipCode(code: string) {
  return /^[0-9]{15}$/.test(code) ? code.replace(/(\d{3})(?=\d)/g, '$1 ') : code;
}

export const microchipStatusLabel: Record<MicrochipStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  removed: 'Removido',
  defective: 'Sem leitura / defeito',
};

export const microchipStatusStyle: Record<MicrochipStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-700',
  removed: 'bg-amber-100 text-amber-700',
  defective: 'bg-red-100 text-red-700',
};

export const microchipEventLabel: Record<MicrochipEventType, string> = {
  registered: 'Chip cadastrado',
  linked: 'Vinculado ao animal',
  unlinked: 'Desvinculado do animal',
  status_changed: 'Status alterado',
  external_registry: 'Registro externo atualizado',
  code_changed: 'Código corrigido',
  scanned: 'Leitura realizada',
  note: 'Anotação',
};

// Local padrão recomendado pela WSAVA para cães e gatos.
export const DEFAULT_IMPLANT_SITE = 'Subcutâneo, linha média dorsal entre as escápulas';

export const EXTERNAL_REGISTRIES = ['SinPatinhas (Gov.br)', 'Banco do fabricante', 'Registro municipal', 'Outro'];
