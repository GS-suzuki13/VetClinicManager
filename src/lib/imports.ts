// Leitura de arquivos importados no navegador: extrato OFX e XML de NF-e.

export interface OfxLine {
  fitid: string;
  posted_on: string; // YYYY-MM-DD
  amount: number;
  description: string;
}

// OFX 1.x (SGML, tags sem fechamento) e 2.x (XML). Lê cada <STMTTRN>.
export function parseOfx(text: string): OfxLine[] {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (block: string, name: string) => {
    const match = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'));
    return match ? match[1].trim() : '';
  };
  return blocks
    .map((block) => {
      const date = tag(block, 'DTPOSTED');
      const amount = Number(tag(block, 'TRNAMT').replace(',', '.'));
      return {
        fitid: tag(block, 'FITID') || `${date}-${amount}-${tag(block, 'MEMO')}`.slice(0, 120),
        posted_on: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
        amount: Math.round(amount * 100) / 100,
        description: (tag(block, 'MEMO') || tag(block, 'NAME')).slice(0, 300),
      };
    })
    .filter((line) => /^\d{4}-\d{2}-\d{2}$/.test(line.posted_on) && Number.isFinite(line.amount) && line.amount !== 0);
}

export interface NfeItem {
  code: string;
  barcode: string | null;
  name: string;
  unit: string;
  quantity: number;
  unit_cost: number;
  batch: string | null;
  expires_on: string | null;
}

export interface Nfe {
  number: string;
  supplier: string;
  issued_on: string | null;
  items: NfeItem[];
}

// XML da NF-e (modelo 55): emitente, número e itens (<det><prod>), com lote e
// validade de medicamentos (<rastro> ou <med>) quando informados.
export function parseNfe(xml: string): Nfe {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Arquivo XML inválido.');
  const text = (el: Element | Document | null, selector: string) => el?.querySelector(selector)?.textContent?.trim() ?? '';

  const items = Array.from(doc.querySelectorAll('det')).map((det) => {
    const prod = det.querySelector('prod');
    const ean = text(prod, 'cEAN');
    const batch = text(prod, 'rastro nLote') || text(prod, 'med nLote');
    const expires = text(prod, 'rastro dVal') || text(prod, 'med dVal');
    return {
      code: text(prod, 'cProd'),
      barcode: /^\d{8,14}$/.test(ean) ? ean : null,
      name: text(prod, 'xProd'),
      unit: (text(prod, 'uCom') || 'un').toLowerCase().slice(0, 10),
      quantity: Number(text(prod, 'qCom')),
      unit_cost: Math.round(Number(text(prod, 'vUnCom')) * 100) / 100,
      batch: batch || null,
      expires_on: expires ? expires.slice(0, 10) : null,
    };
  });
  if (items.length === 0) throw new Error('Nenhum item encontrado. Confira se é o XML da NF-e.');

  return {
    number: text(doc, 'ide nNF'),
    supplier: text(doc, 'emit xFant') || text(doc, 'emit xNome'),
    issued_on: text(doc, 'ide dhEmi').slice(0, 10) || null,
    items,
  };
}
