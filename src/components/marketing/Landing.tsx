import Link from 'next/link';
import type { ReactNode } from 'react';
import { HeroChart } from './HeroChart';
import { BRAND_FA, Logo, LogoMark } from './Logo';

export const PRICE_TOMAN = 199_000;
const faNumber = (n: number) => n.toLocaleString('fa-IR');

const NAV = [
  { href: '#markets', label: 'بازارها' },
  { href: '#features', label: 'امکانات' },
  { href: '#backtest', label: 'بک‌تست' },
  { href: '#pricing', label: 'قیمت' },
  { href: '#faq', label: 'سوالات متداول' },
];

function Svg({ d, className = 'h-5 w-5' }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const I = {
  arrow: 'M19 12H5M11 18l-6-6 6-6',
  check: 'M5 12.5l4.2 4.2L19 7',
  pen: 'M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20zM14 6l3 3',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  wave: 'M2 12c2.5 0 2.5-6 5-6s2.5 12 5 12 2.5-9 5-9 2.5 3 5 3',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  candles: 'M7 3v4M7 15v6M17 3v2M17 13v8M5 7h4v8H5zM15 5h4v8h-4z',
  replay: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M10 9l5 3-5 3z',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  key: 'M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7zM16 11h.01',
  chart: 'M3 3v18h18M7 15l4-4 3 3 6-7',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3zM9 12l2 2 4-4',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  plus: 'M12 5v14M5 12h14',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  play: 'M7 4l13 8-13 8z',
  step: 'M5 4l10 8-10 8zM19 5v14',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
};

const TICKER = [
  ['BTCUSDT', 2.41],
  ['ETHUSDT', 1.87],
  ['XAUUSD', 0.62],
  ['EURUSD', -0.14],
  ['US500', 0.38],
  ['NAS100', 0.71],
  ['AAPL', -0.52],
  ['TSLA', 3.12],
  ['شاخص کل', 0.94],
  ['USOIL', -1.08],
  ['GBPUSD', 0.09],
  ['SOLUSDT', 4.25],
  ['فولاد', 1.6],
  ['NVDA', 2.05],
] as const;

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--mk-line)] bg-[rgba(47,123,255,0.08)] px-3 py-1 text-xs font-semibold text-[var(--mk-blue-2)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--mk-cyan)]" />
      {children}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: ReactNode;
  desc?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-[42px] sm:leading-[1.25]">
        {title}
      </h2>
      {desc ? <p className="mt-4 text-base leading-8 text-[var(--mk-muted)]">{desc}</p> : null}
    </div>
  );
}

function Sparkline({ seed, up, className = '' }: { seed: number; up: boolean; className?: string }) {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const pts: number[] = [];
  let v = 20;
  for (let i = 0; i < 24; i++) {
    v += (up ? -0.55 : 0.55) + (rnd() - 0.5) * 4;
    pts.push(Math.max(3, Math.min(37, v)));
  }
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(i * 120) / 23},${p.toFixed(1)}`).join(' ');
  const color = up ? '#4a9dff' : '#ef5b7a';
  return (
    <svg viewBox="0 0 120 40" className={className} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L120,40 L0,40 Z`} fill={color} opacity=".12" />
      <path d={d} stroke={color} strokeWidth="1.6" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--mk-line)] bg-[rgba(3,10,28,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-8 px-5 lg:px-8">
        <Link href="/" aria-label={BRAND_FA}>
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="ناوبری اصلی">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-lg px-3.5 py-2 text-sm text-[var(--mk-muted)] transition hover:bg-white/5 hover:text-white"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex-1" />
        {signedIn ? (
          <Link
            href="/chart"
            className="mk-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white"
          >
            ورود به نمودار
            <Svg d={I.arrow} className="h-4 w-4" />
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-11 items-center rounded-xl px-4 text-sm font-semibold text-[var(--mk-text)] transition hover:bg-white/5 sm:inline-flex"
            >
              ورود
            </Link>
            <Link
              href="/login"
              className="mk-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white"
            >
              شروع کنید
              <Svg d={I.arrow} className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

function FloatingBadge({
  className,
  icon,
  title,
  sub,
}: {
  className: string;
  icon: string;
  title: ReactNode;
  sub: string;
}) {
  return (
    <div className={`mk-card absolute items-center gap-3 rounded-2xl px-4 py-3 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2f7bff] to-[#1640c9] text-white shadow-lg shadow-blue-900/50">
        <Svg d={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="flex flex-col">
        <span className="text-[13px] font-bold">{title}</span>
        <span className="text-[11px] text-[var(--mk-muted)]">{sub}</span>
      </span>
    </div>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div className="mk-glow pointer-events-none absolute inset-0" />
      <div className="mk-grid-bg pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mk-fade-up inline-flex items-center gap-2.5 rounded-full border border-[var(--mk-line)] bg-[rgba(10,26,70,0.6)] py-1.5 pe-4 ps-1.5 text-xs text-[var(--mk-muted)]">
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--mk-blue)] px-2.5 py-1 text-[11px] font-bold text-white">
              <span className="mk-pulse-dot h-1.5 w-1.5 rounded-full bg-white" />
              لحظه‌ای
            </span>
            داده زنده کریپتو، فارکس، سهام، بورس ایران، طلا و شاخص‌ها
          </div>
          <h1 className="mk-fade-up mt-7 text-[40px] font-black leading-[1.3] tracking-tight [animation-delay:80ms] sm:text-6xl sm:leading-[1.25] lg:text-[68px]">
            همه بازارهای مالی،
            <br />
            <span className="mk-gradient-text">روی یک نمودار حرفه‌ای</span>
          </h1>
          <p className="mk-fade-up mx-auto mt-6 max-w-2xl text-base leading-8 text-[var(--mk-muted)] [animation-delay:160ms] sm:text-lg sm:leading-9">
            {BRAND_FA} پلتفرم تحلیل تکنیکال در سطح تریدینگ‌ویو است: قیمت لحظه‌ای هزاران نماد، صدها
            اندیکاتور، ابزارهای ترسیم حرفه‌ای و بک‌تست استراتژی با ری‌پلی بازار؛ همه در مرورگر و بدون
            نصب.
          </p>
          <div className="mk-fade-up mt-9 flex flex-col items-center justify-center gap-3 [animation-delay:240ms] sm:flex-row">
            <Link
              href={signedIn ? '/chart' : '/login'}
              className="mk-btn-primary inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl px-8 text-base font-bold text-white sm:w-auto"
            >
              {signedIn ? 'باز کردن نمودار' : 'شروع تحلیل'}
              <Svg d={I.arrow} className="h-5 w-5" />
            </Link>
            <a
              href="#pricing"
              className="mk-btn-ghost inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-7 text-base font-semibold sm:w-auto"
            >
              مشاهده قیمت
              <span className="text-[var(--mk-muted)]">— {faNumber(PRICE_TOMAN)} تومان</span>
            </a>
          </div>
          <div className="mk-fade-up mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-[var(--mk-muted)] [animation-delay:320ms]">
            {['داده لحظه‌ای همه بازارها', 'بیش از ۱۰۰ اندیکاتور', 'بک‌تست با ری‌پلی'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Svg d={I.check} className="h-4 w-4 text-[var(--mk-cyan)]" />
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="mk-fade-up relative mx-auto mt-16 max-w-5xl [animation-delay:400ms] lg:mt-20">
          <div className="absolute -inset-x-10 -top-10 bottom-0 rounded-[40px] bg-[radial-gradient(50%_50%_at_50%_40%,rgba(47,123,255,0.35),transparent_70%)] blur-2xl" />
          <div
            className="mk-ring relative overflow-hidden rounded-[22px] bg-[#071330] shadow-[0_40px_120px_-30px_rgba(16,60,180,0.7)]"
            dir="ltr"
          >
            <div className="flex h-11 items-center gap-3 border-b border-[var(--mk-line)] bg-[#0a1838] px-4">
              <span className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ef5b7a]/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#f5c451]/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#4a9dff]/80" />
              </span>
              <span className="ml-2 flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-[12px] font-bold text-white">
                <Svg d={I.search} className="h-3.5 w-3.5 text-[#7d93c9]" />
                BTCUSDT
              </span>
              <span className="hidden gap-1 text-[11px] text-[#7d93c9] sm:flex">
                {['1m', '15m', '1H', '4H', '1D'].map((t) => (
                  <span
                    key={t}
                    className={`rounded px-1.5 py-0.5 ${t === '1H' ? 'bg-[#2f7bff]/25 text-[#9cc4ff]' : ''}`}
                  >
                    {t}
                  </span>
                ))}
              </span>
              <span className="hidden items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[#7d93c9] md:flex">
                <Svg d={I.wave} className="h-3.5 w-3.5" />
                Indicators
              </span>
              <span className="hidden items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[#7d93c9] md:flex">
                <Svg d={I.replay} className="h-3.5 w-3.5" />
                Replay
              </span>
              <span className="flex-1" />
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--mk-cyan)]">
                <span className="mk-pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--mk-cyan)]" />
                LIVE
              </span>
            </div>
            <div className="flex">
              <div className="hidden w-11 shrink-0 flex-col items-center gap-3 border-r border-[var(--mk-line)] bg-[#0a1838] py-4 text-[#7d93c9] sm:flex">
                {[I.chart, I.pen, I.layers, I.target, I.replay].map((d, i) => (
                  <span
                    key={d}
                    className={`flex h-7 w-7 items-center justify-center rounded-md ${i === 1 ? 'bg-[#2f7bff]/25 text-[#9cc4ff]' : ''}`}
                  >
                    <Svg d={d} className="h-4 w-4" />
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1 p-2">
                <HeroChart />
              </div>
            </div>
          </div>
          <FloatingBadge
            className="mk-float -right-3 top-24 hidden lg:flex xl:-right-16"
            icon={I.bolt}
            title={
              <span dir="ltr" className="flex items-center gap-2">
                XAUUSD <span className="text-[#4a9dff]">+0.62%</span>
              </span>
            }
            sub="قیمت لحظه‌ای · بدون تاخیر"
          />
          <FloatingBadge
            className="mk-float-slow -left-3 bottom-24 hidden lg:flex xl:-left-16"
            icon={I.replay}
            title="بک‌تست با ری‌پلی"
            sub="بازپخش کندل به کندل بازار"
          />
        </div>
      </div>
    </section>
  );
}

function Ticker() {
  const row = (copy: number) => (
    <div className="flex shrink-0 items-center gap-10 pe-10" aria-hidden={copy > 0}>
      {TICKER.map(([sym, ch]) => (
        <span key={sym} className="flex items-center gap-2.5 whitespace-nowrap text-sm" dir="ltr">
          <span className="font-bold text-[var(--mk-text)]">{sym}</span>
          <span className={`font-mono text-[13px] ${ch >= 0 ? 'text-[#4a9dff]' : 'text-[#ef5b7a]'}`}>
            {ch >= 0 ? '▲' : '▼'} {Math.abs(ch).toFixed(2)}%
          </span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="mk-marquee-wrap overflow-hidden border-y border-[var(--mk-line)] bg-[rgba(6,18,51,0.6)] py-4">
      <div className="mk-marquee flex w-max">
        {row(0)}
        {row(1)}
      </div>
    </div>
  );
}

function Stats() {
  const stats = [
    { value: '+۱۰٬۰۰۰', label: 'نماد معاملاتی' },
    { value: '+۱۰۰', label: 'اندیکاتور فنی' },
    { value: '۱۸', label: 'ابزار ترسیم' },
    { value: '+۱۶', label: 'نوع نمودار' },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-[var(--mk-line)] bg-[var(--mk-line)] lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-[var(--mk-bg)] px-6 py-8 text-center">
            <div className="mk-gradient-text text-4xl font-black sm:text-5xl">{s.value}</div>
            <div className="mt-2 text-sm text-[var(--mk-muted)]">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Markets() {
  const markets = [
    { title: 'ارزهای دیجیتال', symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], up: true, seed: 11 },
    { title: 'فارکس', symbols: ['EURUSD', 'GBPUSD', 'USDJPY'], up: false, seed: 23 },
    { title: 'سهام جهانی', symbols: ['AAPL', 'NVDA', 'TSLA'], up: true, seed: 37 },
    { title: 'بورس ایران', symbols: ['شاخص کل', 'فولاد', 'خودرو'], up: true, seed: 41 },
    { title: 'طلا و کالا', symbols: ['XAUUSD', 'XAGUSD', 'USOIL'], up: true, seed: 53 },
    { title: 'شاخص‌های جهانی', symbols: ['US500', 'NAS100', 'DAX40'], up: false, seed: 67 },
  ];
  return (
    <section id="markets" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionTitle
          eyebrow="بازارها"
          title={
            <>
              داده لحظه‌ای <span className="mk-gradient-text">همه بازارهای مالی</span>
            </>
          }
          desc="از بیت‌کوین تا شاخص کل بورس تهران؛ قیمت‌ها به‌صورت زنده روی نمودار به‌روز می‌شوند و با یک جستجو به هر نماد می‌رسید."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) => (
            <article
              key={m.title}
              className="mk-card group relative overflow-hidden rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:border-[rgba(90,162,255,0.4)]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{m.title}</h3>
                <span className="flex items-center gap-1.5 rounded-full bg-[rgba(56,211,255,0.1)] px-2.5 py-1 text-[11px] font-semibold text-[var(--mk-cyan)]">
                  <span className="mk-pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--mk-cyan)]" />
                  زنده
                </span>
              </div>
              <Sparkline seed={m.seed} up={m.up} className="mt-5 h-16 w-full" />
              <div className="mt-5 flex flex-wrap gap-2">
                {m.symbols.map((s) => (
                  <span
                    key={s}
                    className="rounded-lg border border-[var(--mk-line)] bg-[rgba(3,10,28,0.55)] px-2.5 py-1 font-mono text-xs text-[#9cc4ff]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  className = '',
  children,
}: {
  icon: string;
  title: string;
  desc: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <article
      className={`mk-card group relative overflow-hidden rounded-3xl p-7 transition duration-300 hover:-translate-y-1 hover:border-[rgba(90,162,255,0.4)] ${className}`}
    >
      <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-[var(--mk-blue)] opacity-0 blur-3xl transition duration-500 group-hover:opacity-20" />
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(90,162,255,0.3)] bg-[rgba(47,123,255,0.12)] text-[var(--mk-blue-2)]">
        <Svg d={icon} className="h-6 w-6" />
      </span>
      <h3 className="mt-5 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--mk-muted)]">{desc}</p>
      {children}
    </article>
  );
}

function Chips({ items }: { items: readonly string[] }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2" dir="ltr">
      {items.map((t) => (
        <span
          key={t}
          className="rounded-lg border border-[var(--mk-line)] bg-[rgba(3,10,28,0.55)] px-2.5 py-1 font-mono text-[11px] text-[#9cc4ff]"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="relative scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionTitle
          eyebrow="امکانات"
          title={
            <>
              هر ابزاری که یک معامله‌گر حرفه‌ای
              <br className="hidden sm:block" /> <span className="mk-gradient-text">نیاز دارد</span>
            </>
          }
          desc="همان تجربه‌ای که از تریدینگ‌ویو می‌شناسید؛ سریع، دقیق و کامل."
        />
        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            className="lg:col-span-2"
            icon={I.wave}
            title="بیش از ۱۰۰ اندیکاتور فنی"
            desc="اندیکاتورهای روند، مومنتوم، نوسان و حجم را با یک کلیک به نمودار اضافه کنید، پارامترها و رنگ‌هایشان را تنظیم کنید و چند اندیکاتور را هم‌زمان در پنل‌های جداگانه ببینید."
          >
            <Chips
              items={['RSI', 'MACD', 'Bollinger Bands', 'Ichimoku', 'EMA', 'SMA', 'VWAP', 'Stochastic', 'ATR', 'SuperTrend', 'OBV', 'ADX']}
            />
          </FeatureCard>
          <FeatureCard
            icon={I.bolt}
            title="قیمت لحظه‌ای، بدون تاخیر"
            desc="کندل‌ها هم‌زمان با بازار ساخته می‌شوند. تاریخچه کامل قیمت برای تحلیل‌های بلندمدت هم در دسترس است."
          />
          <FeatureCard
            icon={I.pen}
            title="۱۸ ابزار ترسیم حرفه‌ای"
            desc="خط روند، پرتو، کانال موازی، فیبوناچی اصلاحی، مستطیل، متن، مسیر، منحنی، هایلایتر، پروفایل حجم و ابزار پوزیشن خرید و فروش؛ با مگنت و قالب‌های شخصی."
          />
          <FeatureCard
            icon={I.candles}
            title="بیش از ۱۶ نوع نمودار"
            desc="شمعی، میله‌ای، خطی، هیکن آشی، شمع توخالی، رنکو، کاگی، شکست خط، نقطه و رقم، رنج، TPO، فوت‌پرینت حجمی و پروفایل حجم جلسه."
          />
          <FeatureCard
            icon={I.replay}
            title="بک‌تست با ری‌پلی بازار"
            desc="به هر تاریخی در گذشته برگردید و بازار را کندل به کندل بازپخش کنید؛ استراتژی‌تان را بدون ریسک و در شرایط واقعی بازار بسنجید."
          />
          <FeatureCard
            className="md:col-span-2"
            icon={I.keyboard}
            title="سرعت یک ترمینال حرفه‌ای"
            desc="موتور رندر اختصاصی که با ده‌ها هزار کندل هم روان می‌ماند، تایم‌فریم‌های متنوع، جستجوی سریع نماد، بازگشت و تکرار نامحدود و میانبرهای صفحه‌کلید برای همه کارها."
          >
            <Chips items={['1m', '5m', '15m', '1H', '4H', '1D', '1W', 'Ctrl+K', 'Ctrl+Z', 'Alt+T']} />
          </FeatureCard>
          <FeatureCard
            icon={I.layers}
            title="شخصی‌سازی کامل"
            desc="تم و رنگ‌بندی نمودار، سبک کندل‌ها، مقیاس لگاریتمی و درصدی و قالب‌های اختصاصی ابزارها؛ نمودار دقیقاً همان‌طور که می‌خواهید."
          />
        </div>
      </div>
    </section>
  );
}

function Backtest() {
  const N = 34;
  const REVEALED = 24;
  let s = 5;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const candles: Array<{ o: number; c: number; h: number; l: number }> = [];
  let p = 60;
  for (let i = 0; i < N; i++) {
    const o = p;
    const c = o + (i < 12 ? 1.2 : i < 20 ? -1.4 : 1.6) + (rnd() - 0.5) * 4;
    candles.push({ o, c, h: Math.max(o, c) + rnd() * 2.5, l: Math.min(o, c) - rnd() * 2.5 });
    p = c;
  }
  const lo = Math.min(...candles.map((c) => c.l)) - 4;
  const hi = Math.max(...candles.map((c) => c.h)) + 4;
  const y = (v: number) => 10 + ((hi - v) / (hi - lo)) * 180;
  const x = (i: number) => 14 + i * 11;
  const entry = candles[REVEALED - 1]!.c;
  const stop = entry - 6;
  const target = entry + 15;

  return (
    <section id="backtest" className="scroll-mt-20 py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-8">
        <div>
          <Eyebrow>بک‌تست و ری‌پلی</Eyebrow>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-[42px] sm:leading-[1.3]">
            استراتژی را <span className="mk-gradient-text">قبل از ریسک</span> روی بازار واقعی بسنجید
          </h2>
          <p className="mt-4 text-base leading-8 text-[var(--mk-muted)]">
            حالت ری‌پلی شما را به هر لحظه از گذشته می‌برد. آینده پنهان می‌شود و بازار کندل به کندل جلو
            می‌رود؛ دقیقاً مثل معامله زنده، اما بدون از دست دادن سرمایه.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              ['انتخاب هر تاریخ و هر تایم‌فریم', 'نقطه شروع را روی نمودار یا با تاریخ دقیق انتخاب کنید و حتی وسط ری‌پلی تایم‌فریم را عوض کنید.'],
              ['پخش، توقف و جلو رفتن کندل به کندل', 'سرعت بازپخش را تنظیم کنید یا با یک کلید، فقط یک کندل جلو بروید.'],
              ['ثبت پوزیشن و محاسبه سود و زیان', 'با ابزار پوزیشن خرید و فروش، حد ضرر و حد سود بگذارید و نسبت ریسک به ریوارد و نتیجه معامله را ببینید.'],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-4">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(47,123,255,0.15)] text-[var(--mk-cyan)]">
                  <Svg d={I.check} className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-bold">{t}</span>
                  <span className="mt-1 block text-sm leading-7 text-[var(--mk-muted)]">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="absolute inset-0 rounded-[32px] bg-[radial-gradient(60%_60%_at_50%_50%,rgba(47,123,255,0.3),transparent_70%)] blur-2xl" />
          <div className="mk-card mk-ring relative overflow-hidden rounded-[28px]" dir="ltr">
            <div className="flex items-center justify-between border-b border-[var(--mk-line)] px-5 py-3 text-xs">
              <span className="font-bold text-white">ETHUSDT · 4H</span>
              <span className="rounded-md bg-[#f5c451]/15 px-2 py-0.5 font-semibold text-[#f5c451]">
                REPLAY · 2025-03-14
              </span>
            </div>
            <svg viewBox="0 0 400 200" className="h-auto w-full" aria-hidden="true">
              <rect x={x(REVEALED - 1)} y={y(target)} width={400 - x(REVEALED - 1)} height={y(entry) - y(target)} fill="#4a9dff" opacity=".16" />
              <rect x={x(REVEALED - 1)} y={y(entry)} width={400 - x(REVEALED - 1)} height={y(stop) - y(entry)} fill="#ef5b7a" opacity=".16" />
              <line x1={x(REVEALED - 1)} x2="400" y1={y(entry)} y2={y(entry)} stroke="#9cc4ff" strokeDasharray="3 3" />
              {candles.map((c, i) => {
                const up = c.c >= c.o;
                const color = up ? '#4a9dff' : '#ef5b7a';
                const top = y(Math.max(c.o, c.c));
                return (
                  <g key={i} opacity={i < REVEALED ? 1 : 0.1}>
                    <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={color} />
                    <rect x={x(i) - 3.5} y={top} width="7" height={Math.max(1, y(Math.min(c.o, c.c)) - top)} fill={color} rx="1" />
                  </g>
                );
              })}
              <line x1={x(REVEALED - 1) + 5.5} x2={x(REVEALED - 1) + 5.5} y1="0" y2="200" stroke="#38d3ff" strokeWidth="1.5" />
            </svg>
            <div className="grid grid-cols-3 gap-px border-t border-[var(--mk-line)] bg-[var(--mk-line)] text-center">
              {[
                ['Position', 'LONG', 'text-[#4a9dff]'],
                ['Risk / Reward', '1 : 2.5', 'text-white'],
                ['P&L', '+4.82%', 'text-[#4a9dff]'],
              ].map(([k, v, c]) => (
                <div key={k} className="bg-[#061233] px-3 py-3">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--mk-muted)]">{k}</div>
                  <div className={`mt-1 font-mono text-sm font-bold ${c}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 border-t border-[var(--mk-line)] bg-[#0a1838] px-4 py-3 text-[#9cc4ff]">
              {[I.pause, I.play, I.step].map((d, i) => (
                <span
                  key={d}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${i === 1 ? 'bg-[var(--mk-blue)] text-white' : 'bg-white/5'}`}
                >
                  <Svg d={d} className="h-4 w-4" />
                </span>
              ))}
              <span className="ml-3 flex gap-1 text-[11px]">
                {['1x', '3x', '10x'].map((sp) => (
                  <span key={sp} className={`rounded px-2 py-1 ${sp === '3x' ? 'bg-[#2f7bff]/25 text-white' : 'text-[var(--mk-muted)]'}`}>
                    {sp}
                  </span>
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    {
      icon: I.phone,
      title: 'شماره موبایل را وارد کنید',
      desc: 'بدون رمز عبور و فرم‌های طولانی؛ فقط شماره موبایل.',
    },
    {
      icon: I.key,
      title: 'کد تایید را بزنید',
      desc: 'کد یک‌بار مصرف پیامک‌شده را وارد کنید تا وارد حساب شوید.',
    },
    {
      icon: I.chart,
      title: 'بازار را تحلیل کنید',
      desc: 'نماد را انتخاب کنید، اندیکاتور اضافه کنید و تحلیل را شروع کنید.',
    },
  ];
  return (
    <section className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[480px] -translate-y-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(16,60,180,0.25),transparent_70%)]" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <SectionTitle
          eyebrow="شروع کار"
          title={
            <>
              در کمتر از <span className="mk-gradient-text">یک دقیقه</span> روی نمودار باشید
            </>
          }
        />
        <div className="relative mt-16">
          <div className="pointer-events-none absolute inset-x-[16%] top-10 hidden h-px bg-gradient-to-l from-transparent via-[rgba(90,162,255,0.5)] to-transparent md:block" />
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
            {steps.map((s, i) => (
              <li key={s.title} className="text-center">
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-[rgba(90,162,255,0.35)] bg-[linear-gradient(180deg,#0d2260,#061233)] text-[var(--mk-blue-2)] shadow-[0_20px_50px_-20px_rgba(47,123,255,0.8)]">
                  <Svg d={s.icon} className="h-8 w-8" />
                  <span className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--mk-blue)] text-xs font-black text-white ring-4 ring-[var(--mk-bg)]">
                    {faNumber(i + 1)}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-bold">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-7 text-[var(--mk-muted)]">
                  {s.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Pricing({ signedIn }: { signedIn: boolean }) {
  const features = [
    'داده لحظه‌ای همه بازارهای مالی',
    'بیش از ۱۰۰ اندیکاتور فنی',
    '۱۸ ابزار ترسیم و بیش از ۱۶ نوع نمودار',
    'بک‌تست استراتژی با ری‌پلی بازار',
    'همه تایم‌فریم‌ها و تاریخچه کامل قیمت',
    'تم، رنگ‌بندی و قالب‌های شخصی',
    'دسترسی از هر دستگاه',
  ];
  return (
    <section id="pricing" className="relative scroll-mt-20 overflow-hidden py-24">
      <div className="mk-grid-bg pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <SectionTitle
          eyebrow="قیمت"
          title={
            <>
              یک اشتراک، <span className="mk-gradient-text">همه امکانات</span>
            </>
          }
          desc="بدون پلن‌های پیچیده و هزینه‌های پنهان. همه بازارها و همه ابزارها از روز اول در اختیار شماست."
        />
        <div className="relative mx-auto mt-14 max-w-lg">
          <div className="absolute -inset-6 rounded-[44px] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(47,123,255,0.45),transparent_70%)] blur-2xl" />
          <div className="mk-ring relative overflow-hidden rounded-[32px] bg-[linear-gradient(180deg,#0c2265,#06123a_55%,#050e2c)] p-8 sm:p-10">
            <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[var(--mk-cyan)] opacity-10 blur-3xl" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LogoMark size={40} />
                <div>
                  <div className="text-lg font-extrabold">اشتراک حرفه‌ای</div>
                  <div className="text-xs text-[var(--mk-muted)]">دسترسی کامل به {BRAND_FA}</div>
                </div>
              </div>
              <span className="rounded-full bg-[var(--mk-blue)] px-3 py-1 text-xs font-bold text-white shadow-lg shadow-blue-900/50">
                همه امکانات
              </span>
            </div>
            <div className="mt-8 flex items-end gap-2">
              <span className="text-6xl font-black tracking-tight">{faNumber(PRICE_TOMAN)}</span>
              <span className="mb-2 text-lg font-bold text-[var(--mk-muted)]">تومان</span>
            </div>
            <div className="my-8 h-px bg-gradient-to-l from-transparent via-[rgba(90,162,255,0.4)] to-transparent" />
            <ul className="space-y-3.5">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-[15px]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(56,211,255,0.14)] text-[var(--mk-cyan)]">
                    <Svg d={I.check} className="h-3.5 w-3.5" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={signedIn ? '/chart' : '/login'}
              className="mk-btn-primary mt-10 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-base font-bold text-white"
            >
              {signedIn ? 'ورود به نمودار' : 'همین حالا شروع کنید'}
              <Svg d={I.arrow} className="h-5 w-5" />
            </Link>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--mk-muted)]">
              <Svg d={I.shield} className="h-4 w-4" />
              ثبت‌نام و ورود امن با کد یک‌بار مصرف پیامکی
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    [
      'داده چه بازارهایی در دسترس است؟',
      'ارزهای دیجیتال، فارکس، سهام جهانی، بورس ایران، طلا و کالا و شاخص‌های جهانی؛ همه با قیمت لحظه‌ای و تاریخچه کامل.',
    ],
    [
      'آیا قیمت‌ها واقعاً لحظه‌ای هستند؟',
      'بله. کندل آخر هم‌زمان با بازار به‌روز می‌شود و تحلیل شما همیشه روی آخرین قیمت انجام می‌شود.',
    ],
    [
      'چه اندیکاتورهایی می‌توانم به نمودار اضافه کنم؟',
      'بیش از ۱۰۰ اندیکاتور مثل RSI، MACD، باندهای بولینگر، ایچیموکو، میانگین‌های متحرک، VWAP، استوکاستیک و ATR؛ با امکان تنظیم پارامترها و رنگ‌ها.',
    ],
    [
      'بک‌تست با ری‌پلی چطور کار می‌کند؟',
      'یک تاریخ در گذشته انتخاب می‌کنید، کندل‌های بعد از آن پنهان می‌شوند و بازار کندل به کندل بازپخش می‌شود. با ابزار پوزیشن، معامله ثبت می‌کنید و نتیجه را می‌بینید.',
    ],
    [
      'ثبت‌نام چطور انجام می‌شود؟',
      'فقط شماره موبایل خود را وارد کنید و کد تایید پیامک‌شده را بزنید. اگر حساب نداشته باشید، به‌صورت خودکار ساخته می‌شود.',
    ],
    [
      'هزینه اشتراک چقدر است؟',
      `قیمت اشتراک ${faNumber(PRICE_TOMAN)} تومان است و همه بازارها و همه امکانات پلتفرم را شامل می‌شود.`,
    ],
  ];
  return (
    <section id="faq" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <SectionTitle eyebrow="سوالات متداول" title="پاسخ پرسش‌های شما" />
        <div className="mt-12 space-y-3">
          {items.map(([q, a]) => (
            <details
              key={q}
              className="mk-faq mk-card rounded-2xl px-6 open:border-[rgba(90,162,255,0.4)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-bold">
                {q}
                <span className="mk-faq-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(47,123,255,0.14)] text-[var(--mk-blue-2)] transition-transform duration-300">
                  <Svg d={I.plus} className="h-4 w-4" />
                </span>
              </summary>
              <p className="pb-5 text-sm leading-7 text-[var(--mk-muted)]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="px-5 pb-24 lg:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-[linear-gradient(120deg,#1a4fd8,#0b2a7a_55%,#071a52)] px-6 py-16 text-center sm:px-16">
        <div className="mk-grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--mk-cyan)] opacity-20 blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl font-black leading-tight sm:text-5xl sm:leading-[1.3]">
            بازار منتظر نمی‌ماند
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[#c6d8ff]">
            با شماره موبایل وارد شوید و همین حالا هر بازاری را با ابزارهای حرفه‌ای تحلیل کنید.
          </p>
          <Link
            href={signedIn ? '/chart' : '/login'}
            className="mt-9 inline-flex h-14 items-center gap-2.5 rounded-2xl bg-white px-8 text-base font-bold text-[#0b2a7a] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] transition hover:-translate-y-0.5 hover:bg-[#eef4ff]"
          >
            {signedIn ? 'ورود به نمودار' : 'شروع تحلیل'}
            <Svg d={I.arrow} className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--mk-line)]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row lg:px-8">
        <Logo />
        <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="لینک‌های پایین صفحه">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-1.5 text-sm text-[var(--mk-muted)] transition hover:text-white"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <p className="text-xs text-[var(--mk-muted)]">© ۱۴۰۵ {BRAND_FA}. تمامی حقوق محفوظ است.</p>
      </div>
    </footer>
  );
}

export function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <>
      <Header signedIn={signedIn} />
      <main>
        <Hero signedIn={signedIn} />
        <Ticker />
        <Stats />
        <Markets />
        <Features />
        <Backtest />
        <Workflow />
        <Pricing signedIn={signedIn} />
        <Faq />
        <FinalCta signedIn={signedIn} />
      </main>
      <Footer />
    </>
  );
}
