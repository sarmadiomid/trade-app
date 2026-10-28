/** Support desk: subjects, limits and the checks shared by the form and the API. */

export const SUPPORT_EMAIL = 'support@candelo.ir';
export const SUPPORT_AGENT_NAME = 'پشتیبانی کندلو';
export const SUPPORT_INBOX_EVENT = 'candelo-support-inbox';

export const SUPPORT_BODY_MIN = 2;
export const SUPPORT_BODY_MAX = 4000;
export const SUPPORT_TITLE_MAX = 80;
export const SUPPORT_SYMBOL_MAX = 48;
export const SUPPORT_OPEN_CAP = 20;
export const SUPPORT_MESSAGE_CAP = 500;
export const SUPPORT_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const SUPPORT_FILE_MAX_COUNT = 4;

/** Images and common documents a ticket may carry. Executables are not accepted. */
export const SUPPORT_FILE_KINDS = [
  { ext: 'jpg', mime: 'image/jpeg', image: true },
  { ext: 'jpeg', mime: 'image/jpeg', image: true },
  { ext: 'png', mime: 'image/png', image: true },
  { ext: 'webp', mime: 'image/webp', image: true },
  { ext: 'gif', mime: 'image/gif', image: true },
  { ext: 'pdf', mime: 'application/pdf', image: false },
  { ext: 'txt', mime: 'text/plain', image: false },
  { ext: 'csv', mime: 'text/csv', image: false },
  { ext: 'zip', mime: 'application/zip', image: false },
  { ext: 'doc', mime: 'application/msword', image: false },
  {
    ext: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    image: false,
  },
  { ext: 'xls', mime: 'application/vnd.ms-excel', image: false },
  {
    ext: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    image: false,
  },
] as const;

export const SUPPORT_FILE_ACCEPT = [
  ...new Set(SUPPORT_FILE_KINDS.map((kind) => `.${kind.ext}`)),
].join(',');

export const SUPPORT_SUBJECTS = [
  {
    id: 'custom-symbol',
    label: 'درخواست نماد دلخواه',
    hint: 'نمادی که در کندلو نیست و می‌خواهید به فهرست اضافه شود.',
    icon: 'tag',
  },
  {
    id: 'account',
    label: 'حساب و ورود',
    hint: 'ورود، شماره موبایل، نام نمایشی و تنظیمات حساب.',
    icon: 'user',
  },
  {
    id: 'billing',
    label: 'اشتراک و پرداخت',
    hint: 'طرح‌ها، پرداخت، کد تخفیف و فاکتور.',
    icon: 'crown',
  },
  {
    id: 'technical',
    label: 'مشکل فنی',
    hint: 'خطا، کندی، نمودار یا بخشی که درست کار نمی‌کند.',
    icon: 'activity',
  },
  {
    id: 'practice',
    label: 'تمرین و بک‌تست',
    hint: 'جلسه‌ها، دفتر معاملات و بازپخش.',
    icon: 'chart',
  },
  {
    id: 'battle',
    label: 'نبردها',
    hint: 'ساخت نبرد، امتیاز و صف رتبه‌بندی.',
    icon: 'swords',
  },
  {
    id: 'other',
    label: 'سایر',
    hint: 'موضوعی که در فهرست بالا نیست.',
    icon: 'chat',
  },
] as const;

export type SupportSubjectId = (typeof SUPPORT_SUBJECTS)[number]['id'];
export type SupportStatus = 'open' | 'answered' | 'closed';
export type SupportRole = 'user' | 'support';

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: 'در انتظار پاسخ',
  answered: 'پاسخ داده شد',
  closed: 'بسته',
};

export interface SupportTicket {
  readonly id: string;
  readonly number: number;
  readonly subject: SupportSubjectId;
  readonly title: string;
  readonly symbol: string;
  readonly status: SupportStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly preview: string;
  readonly lastRole: SupportRole;
  readonly unread: number;
}

export interface SupportAttachment {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly image: boolean;
}

export interface SupportMessage {
  readonly id: string;
  readonly role: SupportRole;
  readonly name: string;
  readonly body: string;
  readonly createdAt: number;
  readonly attachments: readonly SupportAttachment[];
}

export type SupportInputError =
  | 'Invalid subject'
  | 'Title required'
  | 'Invalid title'
  | 'Invalid symbol'
  | 'Symbol required'
  | 'Message too short'
  | 'Message too long';

export type ParsedTicket = {
  readonly subject: SupportSubjectId;
  readonly title: string;
  readonly symbol: string;
  readonly body: string;
};

const ERROR_TEXT: Record<string, string> = {
  'Invalid subject': 'موضوع درخواست را انتخاب کنید.',
  'Title required': 'عنوان را بنویسید.',
  'Invalid title': 'عنوان باید کوتاه‌تر از ۸۰ نویسه باشد.',
  'Invalid symbol': 'نام نماد فقط حرف، عدد و نشانه‌های فاصله . / - _ # () را می‌پذیرد.',
  'Symbol required': 'نام نمادی که می‌خواهید اضافه شود را بنویسید.',
  'Message too short': 'پیام را کمی کامل‌تر بنویسید.',
  'Message too long': 'پیام طولانی است. آن را کوتاه‌تر کنید.',
  'Awaiting reply':
    'تا پاسخ پشتیبانی نمی‌توانید پیام تازه‌ای بفرستید. بعد از جواب می‌توانید چند پیام پشت سر هم بفرستید.',
  'File too large': 'هر فایل باید کمتر از ۵ مگابایت باشد.',
  'Too many files': 'در هر پیام حداکثر ۴ فایل می‌توانید بفرستید.',
  'Invalid file': 'فقط تصویر، PDF، متن، زیپ و فایل ورد یا اکسل پذیرفته می‌شود.',
  'Too many tickets':
    'تعداد درخواست‌های باز به سقف رسیده. یکی را ببندید تا بتوانید درخواست تازه بسازید.',
  'Too many messages': 'این گفتگو به سقف پیام رسیده. درخواست تازه‌ای بسازید.',
  'Ticket not found': 'این گفتگو پیدا نشد.',
  Unauthorized: 'نشست شما تمام شده. دوباره وارد شوید.',
  Forbidden: 'ارسال انجام نشد.',
  'Invalid JSON': 'درخواست نامعتبر بود.',
  'Server error': 'ارتباط با پشتیبانی برقرار نشد. دوباره تلاش کنید.',
  'Could not reach the server': 'ارتباط برقرار نشد. اتصال را بررسی کنید.',
};

export function supportErrorText(error: string): string {
  return ERROR_TEXT[error] ?? 'انجام نشد. دوباره تلاش کنید.';
}

export function isSupportSubject(value: string): value is SupportSubjectId {
  return SUPPORT_SUBJECTS.some((item) => item.id === value);
}

export function subjectById(id: string) {
  return SUPPORT_SUBJECTS.find((item) => item.id === id) ?? null;
}

/** Heading shown on the ticket: the user's title, or the subject when they left it blank. */
export function ticketHeading(ticket: {
  readonly title: string;
  readonly subject: string;
}): string {
  const title = ticket.title.trim();
  if (title) return title;
  return subjectById(ticket.subject)?.label ?? 'درخواست پشتیبانی';
}

/** Tells the sidebar to refresh its unread count. */
export function pingSupportInbox(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SUPPORT_INBOX_EVENT));
}

/** Keeps a short display name and its extension. Strips paths and odd characters. */
export function supportFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const cleaned = base
    .replace(/[^\p{L}\p{N} ._()-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'file';
}

export function checkSupportFile(file: {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}):
  | { ok: true; name: string; type: string; image: boolean }
  | { ok: false; error: 'Invalid file' | 'File too large' } {
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: 'Invalid file' };
  if (file.size > SUPPORT_FILE_MAX_BYTES) return { ok: false, error: 'File too large' };
  const name = supportFileName(file.name);
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const kind = SUPPORT_FILE_KINDS.find((item) => item.ext === ext);
  if (!kind || !mimeAllowed(kind, file.type)) return { ok: false, error: 'Invalid file' };
  return { ok: true, name, type: kind.mime, image: kind.image };
}

function mimeAllowed(kind: (typeof SUPPORT_FILE_KINDS)[number], mime: string): boolean {
  const type = mime.trim().toLowerCase();
  if (!type || type === 'application/octet-stream' || type === kind.mime) return true;
  if (kind.image && type === 'image/jpg') return kind.ext === 'jpg' || kind.ext === 'jpeg';
  if (
    (kind.ext === 'txt' || kind.ext === 'csv') &&
    (type === 'text/plain' || type === 'text/csv')
  ) {
    return true;
  }
  return kind.ext === 'zip' && type === 'application/x-zip-compressed';
}

export function parseSupportBody(
  raw: unknown,
): { ok: true; text: string } | { ok: false; error: 'Message too short' | 'Message too long' } {
  if (typeof raw !== 'string') return { ok: false, error: 'Message too short' };
  const text = raw
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  if (text.length < SUPPORT_BODY_MIN) return { ok: false, error: 'Message too short' };
  if (text.length > SUPPORT_BODY_MAX) return { ok: false, error: 'Message too long' };
  return { ok: true, text };
}

export function parseNewTicket(input: {
  readonly subject: unknown;
  readonly title: unknown;
  readonly symbol: unknown;
  readonly body: unknown;
}): { ok: true; value: ParsedTicket } | { ok: false; error: SupportInputError } {
  if (typeof input.subject !== 'string' || !isSupportSubject(input.subject)) {
    return { ok: false, error: 'Invalid subject' };
  }
  const title = parseTitle(input.title);
  if (!title.ok) return title;
  const body = parseSupportBody(input.body);
  if (!body.ok) return body;
  if (input.subject !== 'custom-symbol') {
    return {
      ok: true,
      value: { subject: input.subject, title: title.text, symbol: '', body: body.text },
    };
  }
  const symbol = parseSymbol(input.symbol);
  if (!symbol.ok) return symbol;
  return {
    ok: true,
    value: { subject: input.subject, title: title.text, symbol: symbol.text, body: body.text },
  };
}

function parseTitle(
  raw: unknown,
): { ok: true; text: string } | { ok: false; error: 'Title required' | 'Invalid title' } {
  if (typeof raw !== 'string') return { ok: false, error: 'Title required' };
  const text = raw
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length === 0) return { ok: false, error: 'Title required' };
  if (text.length > SUPPORT_TITLE_MAX) return { ok: false, error: 'Invalid title' };
  return { ok: true, text };
}

function parseSymbol(
  raw: unknown,
): { ok: true; text: string } | { ok: false; error: 'Symbol required' | 'Invalid symbol' } {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, error: 'Symbol required' };
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length > SUPPORT_SYMBOL_MAX) return { ok: false, error: 'Invalid symbol' };
  if (!/^[\p{L}\p{N} ._/\-#()]+$/u.test(text)) return { ok: false, error: 'Invalid symbol' };
  return { ok: true, text };
}
