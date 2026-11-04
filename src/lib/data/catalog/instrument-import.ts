import {
  ASSET_CLASSES,
  HOUR_PRESETS,
  parseInstrumentDraft,
  type InstrumentDraft,
} from './instrument-form';

/** Hard cap so a bad paste cannot freeze the admin UI or blow past the API body limit. */
export const MAX_INSTRUMENT_IMPORT_ROWS = 500;

export const INSTRUMENT_IMPORT_COLUMNS = [
  'symbol',
  'description',
  'baseCurrency',
  'quoteCurrency',
  'assetClass',
  'hours',
  'tickSize',
  'pipSize',
  'contractSize',
  'lotMin',
  'lotStep',
  'lotMax',
  'defaultSpread',
  'defaultCommissionPerLot',
  'active',
  'dukascopyId',
] as const;

export type InstrumentImportColumn = (typeof INSTRUMENT_IMPORT_COLUMNS)[number];

export interface InstrumentImportIssue {
  readonly row: number;
  readonly symbol?: string;
  readonly error: string;
}

export interface InstrumentImportOk {
  readonly row: number;
  readonly draft: InstrumentDraft;
}

export interface InstrumentImportPreview {
  readonly format: 'csv' | 'json';
  readonly ok: readonly InstrumentImportOk[];
  readonly issues: readonly InstrumentImportIssue[];
}

const COLUMN_ALIASES: Readonly<Record<string, InstrumentImportColumn>> = {
  symbol: 'symbol',
  ticker: 'symbol',
  name: 'symbol',
  description: 'description',
  desc: 'description',
  title: 'description',
  basecurrency: 'baseCurrency',
  base: 'baseCurrency',
  base_ccy: 'baseCurrency',
  quotecurrency: 'quoteCurrency',
  quote: 'quoteCurrency',
  quote_ccy: 'quoteCurrency',
  assetclass: 'assetClass',
  asset: 'assetClass',
  class: 'assetClass',
  market: 'assetClass',
  hours: 'hours',
  tradinghours: 'hours',
  session: 'hours',
  ticksize: 'tickSize',
  tick: 'tickSize',
  pipsize: 'pipSize',
  pip: 'pipSize',
  contractsize: 'contractSize',
  contract: 'contractSize',
  lotmin: 'lotMin',
  minlot: 'lotMin',
  lotstep: 'lotStep',
  steplot: 'lotStep',
  lotmax: 'lotMax',
  maxlot: 'lotMax',
  defaultspread: 'defaultSpread',
  spread: 'defaultSpread',
  defaultcommissionperlot: 'defaultCommissionPerLot',
  commission: 'defaultCommissionPerLot',
  commissionperlot: 'defaultCommissionPerLot',
  active: 'active',
  enabled: 'active',
  dukascopyid: 'dukascopyId',
  dukascopy: 'dukascopyId',
  duka: 'dukascopyId',
};

const REQUIRED_COLUMNS: readonly InstrumentImportColumn[] = [
  'symbol',
  'description',
  'baseCurrency',
  'quoteCurrency',
  'assetClass',
  'hours',
  'tickSize',
  'pipSize',
  'contractSize',
  'lotMin',
  'lotStep',
  'lotMax',
  'defaultSpread',
  'defaultCommissionPerLot',
];

/** Sample CSV header + two forex rows for the admin template download. */
export function instrumentImportCsvTemplate(): string {
  const header = INSTRUMENT_IMPORT_COLUMNS.join(',');
  const eurjpy = [
    'EURJPY',
    'Euro / Japanese Yen',
    'EUR',
    'JPY',
    'forex',
    'forex',
    '0.001',
    '0.01',
    '100000',
    '0.01',
    '0.01',
    '100',
    '0.01',
    '0',
    'true',
    'eurjpy',
  ].join(',');
  const usdjpy = [
    'USDJPY',
    'US Dollar / Japanese Yen',
    'USD',
    'JPY',
    'forex',
    'forex',
    '0.001',
    '0.01',
    '100000',
    '0.01',
    '0.01',
    '100',
    '0.01',
    '0',
    'true',
    'usdjpy',
  ].join(',');
  return `${header}\n${eurjpy}\n${usdjpy}\n`;
}

/** Sample JSON array for the admin template download. */
export function instrumentImportJsonTemplate(): string {
  return `${JSON.stringify(
    [
      {
        symbol: 'EURJPY',
        description: 'Euro / Japanese Yen',
        baseCurrency: 'EUR',
        quoteCurrency: 'JPY',
        assetClass: 'forex',
        hours: 'forex',
        tickSize: 0.001,
        pipSize: 0.01,
        contractSize: 100000,
        lotMin: 0.01,
        lotStep: 0.01,
        lotMax: 100,
        defaultSpread: 0.01,
        defaultCommissionPerLot: 0,
        active: true,
        dukascopyId: 'eurjpy',
      },
      {
        symbol: 'USDJPY',
        description: 'US Dollar / Japanese Yen',
        baseCurrency: 'USD',
        quoteCurrency: 'JPY',
        assetClass: 'forex',
        hours: 'forex',
        tickSize: 0.001,
        pipSize: 0.01,
        contractSize: 100000,
        lotMin: 0.01,
        lotStep: 0.01,
        lotMax: 100,
        defaultSpread: 0.01,
        defaultCommissionPerLot: 0,
        active: true,
        dukascopyId: 'usdjpy',
      },
    ],
    null,
    2,
  )}\n`;
}

/**
 * Parses a catalog dump (CSV or JSON) into drafts.
 * `reserved` is the built-in symbol set that cannot be overwritten.
 */
export function parseInstrumentCatalogFile(
  text: string,
  path = '',
  reserved: ReadonlySet<string> = new Set(),
): InstrumentImportPreview {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return {
      format: guessFormat(path, trimmed),
      ok: [],
      issues: [{ row: 0, error: 'فایل خالی است' }],
    };
  }

  const format = guessFormat(path, trimmed);
  const rawRows =
    format === 'json' ? rowsFromJson(trimmed) : rowsFromCsv(trimmed);

  if (!rawRows.ok) {
    return { format, ok: [], issues: [{ row: 0, error: rawRows.error }] };
  }

  if (rawRows.rows.length === 0) {
    return {
      format,
      ok: [],
      issues: [{ row: 0, error: 'فایل هیچ نمادی ندارد' }],
    };
  }

  if (rawRows.rows.length > MAX_INSTRUMENT_IMPORT_ROWS) {
    return {
      format,
      ok: [],
      issues: [
        {
          row: 0,
          error: `حداکثر ${MAX_INSTRUMENT_IMPORT_ROWS} نماد در هر فایل مجاز است`,
        },
      ],
    };
  }

  const ok: InstrumentImportOk[] = [];
  const issues: InstrumentImportIssue[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rawRows.rows.length; i++) {
    const rowNumber = i + 1;
    const input = rawRows.rows[i]!;
    const symbolHint =
      typeof input.symbol === 'string' ? input.symbol.trim().toUpperCase() : undefined;
    const parsed = parseInstrumentDraft(input, reserved);
    if (!parsed.ok) {
      issues.push({
        row: rowNumber,
        ...(symbolHint !== undefined ? { symbol: symbolHint } : {}),
        error: parsed.error,
      });
      continue;
    }
    if (seen.has(parsed.draft.symbol)) {
      issues.push({
        row: rowNumber,
        symbol: parsed.draft.symbol,
        error: 'این نماد در فایل تکراری است',
      });
      continue;
    }
    seen.add(parsed.draft.symbol);
    ok.push({ row: rowNumber, draft: parsed.draft });
  }

  return { format, ok, issues };
}

function guessFormat(path: string, trimmed: string): 'csv' | 'json' {
  if (/\.json$/i.test(path) || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return 'json';
  }
  return 'csv';
}

function rowsFromJson(
  text: string,
): { ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'فایل JSON معتبر نیست' };
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const bag = data as Record<string, unknown>;
    data = bag.instruments ?? bag.symbols ?? bag.items ?? bag.data;
  }
  if (!Array.isArray(data)) {
    return {
      ok: false,
      error: 'JSON باید آرایه‌ای از نمادها باشد (یا { instruments: [...] })',
    };
  }
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: `ردیف ${i + 1} باید یک آبجکت باشد` };
    }
    rows.push(normalizeRow(item as Record<string, unknown>));
  }
  return { ok: true, rows };
}

function rowsFromCsv(
  text: string,
): { ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string } {
  const table = parseCsvTable(text);
  if (table.length === 0) return { ok: false, error: 'فایل خالی است' };

  const headerCells = table[0]!;
  const map = columnMap(headerCells);
  if (!map) {
    return {
      ok: false,
      error: `سطر اول باید سرستون باشد. ستون‌های لازم: ${REQUIRED_COLUMNS.join(', ')}`,
    };
  }
  for (const col of REQUIRED_COLUMNS) {
    if (map[col] < 0) {
      return { ok: false, error: `ستون «${col}» در سرستون پیدا نشد` };
    }
  }

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < table.length; i++) {
    const cells = table[i]!;
    if (cells.every((cell) => cell.trim() === '')) continue;
    const row: Record<string, unknown> = {};
    for (const col of INSTRUMENT_IMPORT_COLUMNS) {
      const idx = map[col];
      if (idx < 0) continue;
      row[col] = cells[idx] ?? '';
    }
    rows.push(normalizeRow(row));
  }
  return { ok: true, rows };
}

function columnMap(
  header: readonly string[],
): Record<InstrumentImportColumn, number> | null {
  const map = Object.fromEntries(
    INSTRUMENT_IMPORT_COLUMNS.map((col) => [col, -1]),
  ) as Record<InstrumentImportColumn, number>;
  let hits = 0;
  for (let i = 0; i < header.length; i++) {
    const key = header[i]!.trim().toLowerCase().replace(/[\s-]+/g, '');
    const col = COLUMN_ALIASES[key];
    if (!col || map[col] >= 0) continue;
    map[col] = i;
    hits += 1;
  }
  return hits >= 4 ? map : null;
}

/** Coerce CSV strings into the shapes `parseInstrumentDraft` expects. */
function normalizeRow(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  for (const [rawKey, value] of Object.entries(input)) {
    const key = COLUMN_ALIASES[rawKey.trim().toLowerCase().replace(/[\s-]+/g, '')];
    if (key && !(key in out && rawKey === key)) out[key] = value;
  }

  for (const col of [
    'tickSize',
    'pipSize',
    'contractSize',
    'lotMin',
    'lotStep',
    'lotMax',
    'defaultSpread',
    'defaultCommissionPerLot',
  ] as const) {
    if (col in out) out[col] = parseNumberish(out[col]);
  }
  if ('active' in out) out.active = parseBooleanish(out.active);
  if (typeof out.assetClass === 'string') {
    out.assetClass = out.assetClass.trim().toLowerCase();
  }
  if (typeof out.hours === 'string') {
    out.hours = out.hours.trim().toLowerCase();
  }
  if (typeof out.dukascopyId === 'string') {
    out.dukascopyId = out.dukascopyId.trim().toLowerCase();
  } else if (out.dukascopyId == null) {
    out.dukascopyId = '';
  }
  return out;
}

function parseNumberish(value: unknown): unknown {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;
  const text = value
    .trim()
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫]/g, '.')
    .replace(/[٬،,\s]/g, '');
  if (!text) return value;
  const n = Number(text);
  return Number.isFinite(n) ? n : value;
}

function parseBooleanish(value: unknown): unknown {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return value;
  const text = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'بله', 'آره', 'active'].includes(text)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'خیر', 'نه', 'inactive'].includes(text)) return false;
  return value;
}

/** Minimal RFC4180-ish CSV splitter (comma/semicolon/tab, quoted cells). */
function parseCsvTable(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const rows: string[][] = [];
  let delimiter: ',' | ';' | '\t' | null = null;

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!delimiter) delimiter = detectDelimiter(line);
    rows.push(splitCsvLine(line, delimiter));
  }
  return rows;
}

function detectDelimiter(line: string): ',' | ';' | '\t' {
  let commas = 0;
  let semis = 0;
  let tabs = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ',') commas += 1;
    else if (ch === ';') semis += 1;
    else if (ch === '\t') tabs += 1;
  }
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function splitCsvLine(line: string, delimiter: ',' | ';' | '\t'): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

/** Exposed for docs / UI hints. */
export const INSTRUMENT_IMPORT_HINT = {
  assetClasses: ASSET_CLASSES,
  hours: HOUR_PRESETS,
  columns: INSTRUMENT_IMPORT_COLUMNS,
  maxRows: MAX_INSTRUMENT_IMPORT_ROWS,
} as const;
