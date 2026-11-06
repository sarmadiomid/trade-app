import { faDigits, faNum } from '@/lib/locale/jalali';
import { rankFor, type WinCondition } from '@/lib/battles';
import { failReasonFa } from '../backtest/format';

/** Display names. Rank ids and stored English labels stay as they are. */
export const RANK_FA: Readonly<Record<string, string>> = {
  rookie: 'تازه‌کار',
  bronze: 'برنز',
  silver: 'نقره',
  gold: 'طلایی',
  platinum: 'پلاتین',
  diamond: 'الماس',
  elite: 'نخبه',
  master: 'استاد',
};

export const rankLabel = (elo: number): string => {
  const tier = rankFor(elo);
  return RANK_FA[tier.id] ?? tier.name;
};

export const WIN_FA: Readonly<Record<WinCondition, { name: string; short: string }>> = {
  'time-trial': {
    name: 'زمان‌دار',
    short: 'تا پایان زمان، بیشترین بازده برنده است',
  },
  'profit-target': {
    name: 'هدف سود',
    short: 'اولین کسی که به هدف سود برسد برنده است',
  },
};

const TITLES: Readonly<Record<string, string>> = {
  'Ranked Duel': 'دوئل رتبه‌ای',
  'Ranked Sprint': 'اسپرینت رتبه‌ای',
};

/** Battle titles stored before the Persian names, shown in Persian. */
export const battleTitle = (name: string): string => TITLES[name] ?? name;

const ORDINALS = ['', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];

/** «اول» … «دهم»، بعد از آن خودِ عدد. */
export const placeWord = (n: number): string => ORDINALS[n] ?? faNum(n);

export const minutes = (n: number): string => `${faNum(n)} دقیقه`;

export const traders = (n: number): string =>
  n === 1 ? 'یک معامله‌گر' : `${faNum(n)} معامله‌گر`;

/** "+۱٫۲۵٪" / "−۰٫۴۰٪" / "۰٫۰۰٪". */
export const signedPct = (v: number, decimals = 2): string => {
  const r = Math.abs(v) < 0.5 * 10 ** -decimals ? 0 : v;
  const sign = r > 0 ? '+' : r < 0 ? '−' : '';
  return `${sign}${faNum(Math.abs(r), decimals)}٪`;
};

/** $100K-style balances, with the currency mark kept on the number. */
export function compactMoney(v: number): string {
  if (v >= 1e6) return `${faNum(+(v / 1e6).toFixed(2))} میلیون $`;
  if (v >= 1e4) return `${faNum(+(v / 1e3).toFixed(v >= 1e5 ? 0 : 1))} هزار $`;
  return `${faNum(v)} $`;
}

export const signed = (n: number): string =>
  `${n > 0 ? '+' : n < 0 ? '−' : '±'}${faNum(Math.abs(n))}`;

/** «همین الان»، «۵ دقیقه پیش»، «۲ ساعت پیش»، «۳ روز پیش». */
export function ago(t: number, now: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'همین الان';
  if (s < 3600) return `${faNum(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${faNum(Math.floor(s / 3600))} ساعت پیش`;
  return `${faNum(Math.floor(s / 86400))} روز پیش`;
}

/** Clock text with Persian digits. The string stays a single LTR run. */
export const clockFa = (formatted: string): string => faDigits(formatted);

const END_REASONS: Readonly<Record<string, string>> = {
  'Time is up': 'زمان تمام شد',
  'Every trader is out': 'همه از دور خارج شدند',
  'Every trader reached the end of the market': 'همه به پایان بازار رسیدند',
  'Ended by the host': 'میزبان نبرد را تمام کرد',
  'Everyone left': 'همه خارج شدند',
  'Closed by the host': 'میزبان لابی را بست',
  'The host closed the lobby.': 'میزبان لابی را بست.',
};

/** Stored end reasons stay English; this is display only. */
export function faEndReason(reason: string): string {
  if (END_REASONS[reason]) return END_REASONS[reason];
  const target = ' reached the profit target';
  if (reason.endsWith(target)) return `${reason.slice(0, -target.length)} به هدف سود رسید`;
  return reason;
}

/** Disqualification and forfeit reasons. */
export function faReason(reason: string): string {
  if (reason === 'Left the battle') return 'از نبرد خارج شد';
  if (reason === 'Stopped out') return 'کال مارجین';
  if (reason === 'a rule was broken') return 'یکی از قانون‌ها شکسته شد';
  return failReasonFa(reason);
}

const EXACT: Readonly<Record<string, string>> = {
  'Battle name is required': 'نام نبرد را وارد کن',
  'Battle name must be at most 50 characters': 'نام نبرد حداکثر ۵۰ نویسه است',
  'Unknown battle type': 'نوع نبرد شناخته نشد',
  'Starting balance must be between 1,000 and 10,000,000':
    'موجودی اولیه باید بین ۱٬۰۰۰ و ۱۰٬۰۰۰٬۰۰۰ باشد',
  'Pick at least one asset': 'دست‌کم یک نماد انتخاب کن',
  'Assets must be unique': 'نمادها نباید تکراری باشند',
  'History range is incomplete': 'بازه تاریخ کامل نیست',
  'History range is invalid': 'بازه تاریخ معتبر نیست',
  'History range is outside available data': 'بازه تاریخ بیرون از دادهٔ موجود است',
  'End date must be on or after the start date': 'تاریخ پایان باید همان روز شروع یا بعد از آن باشد',
  'Unknown replay speed': 'سرعت بازپخش شناخته نشد',
  'This duration at this speed replays more than one trading week':
    'با این مدت و این سرعت، بازپخش از یک هفته معاملاتی بیشتر می‌شود',
  'Profit Target battles need a profit target': 'نبرد هدف سود، بدون هدف سود ساخته نمی‌شود',
  'Profit target must be 0.1–100%': 'هدف سود باید بین ۰٫۱ تا ۱۰۰ درصد باشد',
  'Max drawdown must be 0.5–99%': 'حداکثر افت باید بین ۰٫۵ تا ۹۹ درصد باشد',
  'Max daily drawdown must be 0.5–99%': 'حداکثر افت روزانه باید بین ۰٫۵ تا ۹۹ درصد باشد',
  'Unknown visibility': 'وضعیت نمایش شناخته نشد',
  'Lower the duration or the speed': 'مدت یا سرعت را کمتر کن',
  'Pick at most 5 assets': 'حداکثر پنج نماد می‌توانی انتخاب کنی',
  'Duration must be 1–99 minutes': 'مدت باید بین ۱ تا ۹۹ دقیقه باشد',
  'Participants must be 2–20': 'تعداد نفرات باید بین ۲ تا ۲۰ باشد',
  'Could not join': 'پیوستن ممکن نشد',
  'Could not start matchmaking': 'حریف‌یابی شروع نشد',
  'Could not load battles': 'نبردها بارگذاری نشدند',
  'Could not save': 'ذخیره نشد',
  'Could not create the battle': 'نبرد ساخته نشد',
  'Could not send': 'پیام فرستاده نشد',
  'Something went wrong': 'مشکلی پیش آمد',
  'Copy failed: select the battle ID instead': 'کپی نشد؛ شناسه نبرد را خودت انتخاب کن',
  'The action was not accepted': 'این عمل پذیرفته نشد',
  Failed: 'انجام نشد',
  'No battle has this ID': 'نبردی با این شناسه نیست',
  'Unknown ranked format': 'نوع نبرد رتبه‌ای شناخته نشد',
  'Battle not found': 'نبرد پیدا نشد',
  'The battle is busy, try again': 'نبرد شلوغ است؛ یک بار دیگر امتحان کن',
  'This battle is private: join it with its battle ID':
    'این نبرد خصوصی است؛ با شناسه‌اش وارد شو',
  'Ranked battles are matchmade': 'نبرد رتبه‌ای فقط با حریف‌یابی شروع می‌شود',
  'This battle has ended': 'این نبرد تمام شده',
  'This battle is full': 'ظرفیت این نبرد پر است',
  'This battle does not accept late entries': 'بعد از شروع، کسی به این نبرد اضافه نمی‌شود',
  'You are not in this battle': 'تو در این نبرد نیستی',
  'A ranked match cannot be left before it starts': 'نبرد رتبه‌ای را قبل از شروع نمی‌شود ترک کرد',
  'Only the host can do that': 'فقط میزبان می‌تواند این کار را بکند',
  'The battle has already started': 'نبرد از قبل شروع شده',
  'The battle is not running': 'نبرد در جریان نیست',
  'The battle is not paused': 'نبرد متوقف نیست',
  'Only a battle that has not started can be closed': 'فقط نبردی را می‌شود بست که هنوز شروع نشده',
  'The battle is paused': 'نبرد متوقف است',
  'Trading is closed': 'معامله بسته است',
  'You left this battle': 'از این نبرد خارج شده‌ای',
  'Too many actions': 'تعداد عمل‌ها بیش از حد است',
  'Your chart is out of sync with the battle, reloading':
    'نمودار با نبرد هم‌گام نیست؛ در حال بارگذاری دوباره',
  'Invalid action': 'عمل نامعتبر است',
  'Invalid time': 'زمان نامعتبر است',
  'Invalid message': 'پیام نامعتبر است',
  'Empty message': 'پیام خالی است',
  'Join the battle to chat': 'برای گفت‌وگو باید به نبرد بپیوندی',
  'Unknown control': 'دستور ناشناخته است',
  'Invalid name': 'نام نامعتبر است',
  'Use 3–20 letters, digits, spaces, _ . or -':
    'نام باید ۳ تا ۲۰ نویسه باشد: حرف، عدد، فاصله، یا _ . -',
  'This session has ended': 'این نبرد تمام شده',
  'Duplicate id': 'این شناسه تکراری است',
  'Order not found': 'سفارش پیدا نشد',
  'Position not found': 'معامله پیدا نشد',
  'Price must be beyond the entry to move the stop to break even':
    'برای سربه‌سر کردن، قیمت باید از نقطه ورود رد شده باشد',
  'No open positions': 'معامله بازی نیست',
  'No pending orders': 'سفارش در انتظاری نیست',
};

const ASSET_UNAVAILABLE = /^(\S+) is not available$/;

/** Server and validation strings stay English; the page shows Persian. */
export function faMessage(message: string): string {
  if (EXACT[message]) return EXACT[message];
  const asset = ASSET_UNAVAILABLE.exec(message);
  if (asset) return `${asset[1]} برای نبرد در دسترس نیست`;
  return faEndReason(faReason(message));
}

const CHAT_EXACT: Readonly<Record<string, string>> = {
  'The battle has started': 'نبرد شروع شد',
  'The host paused the battle': 'میزبان نبرد را متوقف کرد',
  'The host resumed the battle': 'میزبان نبرد را ادامه داد',
  'The host restarted the battle': 'میزبان نبرد را از نو شروع کرد',
  'The host closed the battle': 'میزبان نبرد را بست',
};

/** System chat lines stored in English. Player messages pass through. */
export function faChat(text: string): string {
  if (CHAT_EXACT[text]) return CHAT_EXACT[text];
  const created = ' created the battle';
  if (text.endsWith(created)) return `${text.slice(0, -created.length)} نبرد را ساخت`;
  if (text.endsWith(' joined')) return `${text.slice(0, -' joined'.length)} پیوست`;
  if (text.endsWith(' left')) return `${text.slice(0, -' left'.length)} خارج شد`;
  if (text.endsWith(' started the countdown'))
    return `${text.slice(0, -' started the countdown'.length)} شمارش را شروع کرد`;
  if (text.startsWith('Match found: '))
    return `حریف پیدا شد: ${text.slice('Match found: '.length).replace(' vs ', ' در برابر ')}`;
  if (text.startsWith('Battle over: ')) {
    const body = text.slice('Battle over: '.length);
    const mark = '. Winner: ';
    const at = body.lastIndexOf(mark);
    if (at >= 0) {
      const reason = faEndReason(body.slice(0, at));
      const winner = body.slice(at + mark.length);
      return `نبرد تمام شد: ${reason}. برنده: ${winner}`;
    }
  }
  return text;
}
