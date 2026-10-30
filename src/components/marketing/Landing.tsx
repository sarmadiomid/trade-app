import Link from 'next/link';
import type { ReactNode } from 'react';
import { MID_TOMAN, PRO_TOMAN } from '../billing/plans';
import { HeroChart } from './HeroChart';
import { LandingChart } from './LandingChart';
import { LandingPricing } from './LandingPricing';
import { BRAND_EN, BrandName, Logo } from './Logo';

const faNumber = (n: number) => n.toLocaleString('fa-IR');

/* ───────────────────────── design tokens ───────────────────────── */

const UP = '#4a9dff';
const DOWN = '#ef5b7a';

const WRAP = 'mx-auto w-full max-w-[1200px] px-5 lg:px-8';
const CARD = 'rounded-2xl border border-white/[0.08] bg-[#080c17]';
const CARD_HOVER = `${CARD} transition-colors duration-300 hover:border-white/[0.18]`;
const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f7bff] font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.14)_inset,0_12px_32px_-12px_rgba(47,123,255,0.9)] transition hover:bg-[#4388ff]';
const BTN_GHOST =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] font-semibold text-[#dbe4f8] transition hover:border-white/25 hover:bg-white/[0.07]';
const GRADIENT_TEXT =
  'bg-gradient-to-l from-[#8cbcff] via-[#38d3ff] to-[#2f7bff] bg-clip-text text-transparent';

const GRID_BG = {
  backgroundImage:
    'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
  backgroundSize: '56px 56px',
  maskImage: 'radial-gradient(ellipse 75% 65% at 50% 0%, #000 25%, transparent 100%)',
  WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 0%, #000 25%, transparent 100%)',
} as const;

const NAV = [
  { href: '#product', label: 'محصول' },
  { href: '#chart', label: 'نمودار' },
  { href: '#battle', label: 'مسابقه و نبرد' },
  { href: '#features', label: 'امکانات' },
  { href: '#pricing', label: 'قیمت' },
  { href: '#faq', label: 'سوالات متداول' },
];

/* ───────────────────────── icons ───────────────────────── */

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
  wave: 'M2 12c2.5 0 2.5-6 5-6s2.5 12 5 12 2.5-9 5-9 2.5 3 5 3',
  candles: 'M7 3v4M7 15v6M17 3v2M17 13v8M5 7h4v8H5zM15 5h4v8h-4z',
  replay: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M10 9l5 3-5 3z',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3zM9 12l2 2 4-4',
  plus: 'M12 5v14M5 12h14',
  play: 'M7 4l13 8-13 8z',
  journal: 'M6 3h10a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6',
  swords: 'M14.5 4.5l5 5M4 20l6.5-6.5M16 3l5 5-8.5 8.5H7.5V11.5L16 3zM4 4l6 6',
  stats: 'M4 19h16M7 16V9M12 16V5M17 16v-7',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3',
  stepBack: 'M19 5l-9 7 9 7V5zM5 5v14',
  stepFwd: 'M5 5l9 7-9 7V5zM19 5v14',
  cursor: 'M5 3l14 7-6 2-2 6L5 3z',
  trend: 'M4 19L20 5M4 19h.01M20 5h.01',
  fib: 'M4 6h16M4 11h16M4 16h10M4 21h6',
  ruler: 'M3 17L17 3l4 4L7 21l-4-4zM8 12l2 2M11 9l2 2M14 6l2 2',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z',
};

/* ───────────────────────── tiny shared pieces ───────────────────────── */

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-[#9cc4ff]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#38d3ff] shadow-[0_0_10px_#38d3ff]" />
      {children}
    </span>
  );
}

function SectionHead({
  eyebrow,
  title,
  desc,
  align = 'center',
}: {
  eyebrow: string;
  title: ReactNode;
  desc?: string;
  align?: 'center' | 'start';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-5 text-[28px] font-black leading-[1.4] tracking-tight text-white sm:text-[38px] sm:leading-[1.35]">
        {title}
      </h2>
      {desc ? <p className="mt-4 text-[15px] leading-8 text-[#8b98b8]">{desc}</p> : null}
    </div>
  );
}

function IconBadge({ d }: { d: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#5aa2ff]/25 bg-[#2f7bff]/10 text-[#8cbcff]">
      <Svg d={d} className="h-5 w-5" />
    </span>
  );
}

/** deterministic pseudo-random candles (no hydration mismatch) */
function makeCandles(n: number, seed: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  let p = 50;
  const out: { o: number; h: number; l: number; c: number }[] = [];
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = o + (rnd() - 0.45) * 7;
    const h = Math.max(o, c) + rnd() * 3.5;
    const l = Math.min(o, c) - rnd() * 3.5;
    out.push({ o, h, l, c });
    p = c;
  }
  return out;
}

function MiniCandles({
  n = 28,
  seed = 7,
  hiddenFrom,
  className = 'h-full w-full',
}: {
  n?: number;
  seed?: number;
  hiddenFrom?: number;
  className?: string;
}) {
  const cs = makeCandles(n, seed);
  const step = 14;
  const W = n * step;
  const H = 180;
  const lo = Math.min(...cs.map((c) => c.l));
  const hi = Math.max(...cs.map((c) => c.h));
  const y = (v: number) => 12 + (1 - (v - lo) / (hi - lo)) * (H - 24);
  const cut = hiddenFrom ?? n;
  const cx = cut * step;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      {[0.2, 0.4, 0.6, 0.8].map((g) => (
        <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="rgba(255,255,255,0.05)" />
      ))}
      {cs.slice(0, cut).map((c, i) => {
        const up = c.c >= c.o;
        const col = up ? UP : DOWN;
        const x = i * step + step / 2;
        const top = y(Math.max(c.o, c.c));
        const h = Math.max(2, Math.abs(y(c.o) - y(c.c)));
        return (
          <g key={i}>
            <line
              x1={x}
              x2={x}
              y1={y(c.h)}
              y2={y(c.l)}
              stroke={col}
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
            <rect x={x - 4} y={top} width="8" height={h} rx="1" fill={col} />
          </g>
        );
      })}
      {hiddenFrom !== undefined ? (
        <>
          <rect x={cx} y="0" width={W - cx} height={H} fill="rgba(255,255,255,0.025)" />
          <line
            x1={cx}
            x2={cx}
            y1="0"
            y2={H}
            stroke="#38d3ff"
            strokeDasharray="4 4"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : null}
    </svg>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: 'up' | 'down' }) {
  return (
    <div className="flex items-center justify-between py-2 text-[12.5px]">
      <span className="text-[#7d8bac]">{k}</span>
      <span
        className="font-mono font-semibold"
        style={{ color: tone === 'up' ? UP : tone === 'down' ? DOWN : '#dbe4f8' }}
        dir="ltr"
      >
        {v}
      </span>
    </div>
  );
}

/* ───────────────────────── header ───────────────────────── */

function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#04070f]/80 backdrop-blur-xl">
      <div className={`${WRAP} flex h-16 items-center gap-8`}>
        <Link href="/" aria-label={BRAND_EN} className="min-w-0 shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="ناوبری اصلی">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-[#8b98b8] transition hover:bg-white/[0.05] hover:text-white"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex-1" />
        {signedIn ? (
          <Link href="/home" className={`${BTN_PRIMARY} h-9 px-4 text-[13px]`}>
            ورود به داشبورد
            <Svg d={I.arrow} className="h-4 w-4" />
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-lg px-3 text-[13.5px] font-semibold text-[#c9d4f0] transition hover:text-white sm:inline-flex"
            >
              ورود
            </Link>
            <Link href="/login" className={`${BTN_PRIMARY} h-9 px-4 text-[13px]`}>
              شروع کنید
              <Svg d={I.arrow} className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
      {/* mobile nav: scrollable row, no JS needed */}
      <nav
        className="flex gap-1 overflow-x-auto border-t border-white/[0.06] px-4 py-2 md:hidden"
        aria-label="ناوبری موبایل"
      >
        {NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="shrink-0 rounded-lg px-3 py-1.5 text-[13px] text-[#8b98b8] hover:text-white"
          >
            {n.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

/* ───────────────────────── hero ───────────────────────── */

function PlatformFrame() {
  const rail = [I.cursor, I.trend, I.fib, I.pen, I.text, I.ruler];
  return (
    <div
      dir="ltr"
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#070b16] shadow-[0_60px_140px_-40px_rgba(30,90,255,0.65)]"
    >
      <div className="flex h-11 items-center gap-3 border-b border-white/[0.08] bg-[#0a1020] px-3">
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        </span>
        <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[12px] font-bold text-white">
          XAUUSD
        </span>
        <span className="hidden items-center gap-0.5 text-[11px] text-[#7d93c9] sm:flex">
          {['1m', '5m', '15m', '1H', '4H'].map((t) => (
            <span
              key={t}
              className={`rounded px-1.5 py-0.5 ${t === '15m' ? 'bg-[#2f7bff]/25 text-[#9cc4ff]' : ''}`}
            >
              {t}
            </span>
          ))}
        </span>
        <span className="hidden items-center gap-1.5 rounded bg-[#f5c451]/10 px-2 py-0.5 text-[11px] font-semibold text-[#f5c451] md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f5c451]" />
          REPLAY
        </span>
        <span className="flex-1" />
        <span className="font-mono text-[11px] text-[#7d93c9]">12 Mar 2025 · 14:15</span>
      </div>

      <div className="flex">
        <div className="hidden w-11 shrink-0 flex-col items-center gap-1 border-r border-white/[0.08] bg-[#0a1020] py-2 sm:flex">
          {rail.map((d, i) => (
            <span
              key={d}
              className={`flex h-8 w-8 items-center justify-center rounded-md ${
                i === 0 ? 'bg-[#2f7bff]/20 text-[#9cc4ff]' : 'text-[#6f82b3]'
              }`}
            >
              <Svg d={d} className="h-[17px] w-[17px]" />
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <HeroChart />
        </div>

        <aside className="hidden w-[228px] shrink-0 flex-col border-l border-white/[0.08] bg-[#0a1020] p-3 lg:flex">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6f82b3]">
            Order
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[#ef5b7a]/15 px-2 py-2 text-center">
              <div className="text-[10px] font-semibold text-[#ef5b7a]">SELL</div>
              <div className="font-mono text-[13px] font-bold text-white">2341.05</div>
            </div>
            <div className="rounded-lg bg-[#4a9dff]/15 px-2 py-2 text-center">
              <div className="text-[10px] font-semibold text-[#4a9dff]">BUY</div>
              <div className="font-mono text-[13px] font-bold text-white">2341.35</div>
            </div>
          </div>
          <div className="mt-3 divide-y divide-white/[0.06]">
            <Row k="Size" v="0.40 lot" />
            <Row k="Stop loss" v="2334.80" tone="down" />
            <Row k="Take profit" v="2352.40" tone="up" />
            <Row k="Spread" v="0.30" />
            <Row k="Risk / Reward" v="1 : 1.7" />
          </div>
          <div className="mt-3 rounded-lg bg-[#2f7bff] py-2 text-center text-[12px] font-bold text-white">
            Buy XAUUSD
          </div>
          <div className="mt-auto rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[#6f82b3]">Balance</div>
            <div className="mt-0.5 font-mono text-[15px] font-bold text-white">$10,000.00</div>
            <div className="font-mono text-[11px]" style={{ color: UP }}>
              +$186.40 open
            </div>
          </div>
        </aside>
      </div>

      <div className="flex h-12 items-center gap-3 border-t border-white/[0.08] bg-[#0a1020] px-3">
        <span className="flex items-center gap-1 text-[#9cb3e6]">
          <span className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/5">
            <Svg d={I.stepBack} className="h-4 w-4" />
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#2f7bff] text-white">
            <Svg d={I.play} className="h-3.5 w-3.5" />
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/5">
            <Svg d={I.stepFwd} className="h-4 w-4" />
          </span>
        </span>
        <span className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-[#9cc4ff]">
          5x
        </span>
        <div className="relative h-1 flex-1 rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 w-[62%] rounded-full bg-gradient-to-r from-[#2f7bff] to-[#38d3ff]" />
          <div className="absolute left-[62%] top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#38d3ff] bg-[#04070f]" />
        </div>
        <span className="hidden font-mono text-[11px] text-[#7d93c9] sm:inline">
          12 Mar → 18 Mar
        </span>
      </div>
    </div>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" style={GRID_BG} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(50%_60%_at_50%_0%,rgba(47,123,255,0.30),transparent_72%)]" />

      <div className={`${WRAP} relative pb-6 pt-16 sm:pt-20 lg:pt-28`}>
        <div className="mx-auto max-w-3xl text-center">
          <a
            href="#chart"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pe-3 ps-1 text-[12.5px] text-[#b8c6e6] transition hover:border-white/20"
          >
            <span className="rounded-full bg-[#2f7bff] px-2.5 py-0.5 text-[11px] font-bold text-white">
              جدید
            </span>
            محیط تمرین معامله، به زبان فارسی
            <Svg d={I.arrow} className="h-3.5 w-3.5" />
          </a>

          <h1 className="mt-7 text-[38px] font-black leading-[1.35] tracking-tight text-white sm:text-[54px] sm:leading-[1.3] lg:text-[66px]">
            معامله با اطمینان،
            <br />
            <span className={GRADIENT_TEXT}>از بک‌تست شروع می‌شود</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-8 text-[#8b98b8] sm:text-[17px] sm:leading-9">
            بازار را به گذشته برگردانید، کندل‌به‌کندل معامله کنید و قبل از ریسک واقعی بفهمید
            استراتژی‌تان کار می‌کند یا نه.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={signedIn ? '/home' : '/login'}
              className={`${BTN_PRIMARY} h-12 w-full px-8 text-[15px] sm:w-auto`}
            >
              {signedIn ? 'ورود به داشبورد' : 'شروع کنید'}
              <Svg d={I.arrow} className="h-4 w-4" />
            </Link>
            <a href="#chart" className={`${BTN_GHOST} h-12 w-full px-7 text-[15px] sm:w-auto`}>
              <Svg d={I.play} className="h-3.5 w-3.5" />
              نمودار را امتحان کنید
            </a>
          </div>

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-[#7d8bac]">
            {['حساب مجازی', 'بازپخش تاریخی', 'ژورنال خودکار', 'مسابقه و نبرد'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className="text-[#38d3ff]">
                  <Svg d={I.check} className="h-4 w-4" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto mt-14 max-w-[1080px] sm:mt-16">
          <div className="absolute -inset-x-10 -top-10 bottom-10 rounded-[48px] bg-[radial-gradient(50%_60%_at_50%_40%,rgba(47,123,255,0.35),transparent_72%)] blur-3xl" />
          <div className="relative">
            <PlatformFrame />
          </div>
          <div className="pointer-events-none absolute inset-x-0 -bottom-px h-24 bg-gradient-to-t from-[#04070f] to-transparent" />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── facts strip ───────────────────────── */

function FactsStrip() {
  const items = [
    { v: 'کندل‌به‌کندل', l: 'بازپخش با سرعت دلخواه' },
    { v: '۱m تا ۴H', l: 'تغییر تایم‌فریم وسط جلسه' },
    { v: 'طلا · فارکس · شاخص', l: 'XAUUSD · EURUSD · GBPUSD · NAS100' },
    { v: 'مسابقه و نبرد', l: 'رتبه‌بندی با امتیاز الو' },
  ];
  return (
    <section className="border-y border-white/[0.07] bg-white/[0.015]">
      <div className={`${WRAP} grid grid-cols-2 lg:grid-cols-4`}>
        {items.map((it, i) => (
          <div
            key={it.v}
            className={`px-4 py-7 text-center ${i % 2 === 0 ? 'border-e border-white/[0.07]' : ''} ${
              i < 2 ? 'border-b border-white/[0.07] lg:border-b-0' : ''
            } ${i === 1 ? 'lg:border-e' : ''}`}
          >
            <div className="text-[17px] font-extrabold text-white">{it.v}</div>
            <div className="mt-1 text-[12px] text-[#7d8bac]" dir="auto">
              {it.l}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── product: 3 steps ───────────────────────── */

function EquityMini({ className = 'h-full w-full', id }: { className?: string; id: string }) {
  return (
    <svg viewBox="0 0 400 140" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2f7bff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#2f7bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[35, 70, 105].map((g) => (
        <line key={g} x1="0" x2="400" y1={g} y2={g} stroke="rgba(255,255,255,0.05)" />
      ))}
      <path
        d="M0 112 L30 106 L60 114 L90 92 L120 98 L150 74 L180 82 L210 60 L240 66 L270 44 L300 52 L330 32 L360 38 L400 20 L400 140 L0 140 Z"
        fill={`url(#${id})`}
      />
      <path
        d="M0 112 L30 106 L60 114 L90 92 L120 98 L150 74 L180 82 L210 60 L240 66 L270 44 L300 52 L330 32 L360 38 L400 20"
        fill="none"
        stroke="#4a9dff"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function HowItWorks({ signedIn }: { signedIn: boolean }) {
  const steps = [
    {
      n: 1,
      title: 'بازپخش',
      desc: 'تاریخ شروع را انتخاب کنید. کندل‌های بعد پنهان می‌مانند و بازار همان‌طور که آن روز حرکت کرد جلو می‌آید.',
      visual: (
        <div className="relative h-full">
          <MiniCandles n={22} seed={11} hiddenFrom={15} />
          <span
            className="absolute bottom-3 start-3 flex items-center gap-1.5 rounded-md bg-black/40 px-2 py-1 font-mono text-[10px] text-[#9cc4ff]"
            dir="ltr"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#38d3ff]" /> 12 Mar · 14:15
          </span>
        </div>
      ),
    },
    {
      n: 2,
      title: 'معامله',
      desc: 'ورود، حد ضرر، حد سود و حجم. اسپرد روی قیمت می‌نشیند؛ نتیجه همان‌طور که در بازار زنده دیده می‌شود.',
      visual: (
        <div className="relative h-full" dir="ltr">
          <MiniCandles n={22} seed={5} />
          {[
            { top: '18%', label: 'TP', color: UP },
            { top: '50%', label: 'ENTRY', color: '#dbe4f8' },
            { top: '78%', label: 'SL', color: DOWN },
          ].map((l) => (
            <div
              key={l.label}
              className="absolute inset-x-0 flex items-center"
              style={{ top: l.top }}
            >
              <div
                className="h-px flex-1 border-t border-dashed"
                style={{ borderColor: l.color, opacity: 0.7 }}
              />
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
                style={{ background: `${l.color}26`, color: l.color }}
              >
                {l.label}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      n: 3,
      title: 'مرور نتیجه',
      desc: 'نرخ برد، فاکتور سود، افت سرمایه، تقویم سود و زیان و ژورنال هر معامله، برای همان جلسه.',
      visual: (
        <div className="relative h-full">
          <EquityMini id="eq-step" />
          <span
            className="absolute top-3 start-3 rounded-md bg-black/40 px-2 py-1 font-mono text-[11px] font-bold"
            style={{ color: UP }}
            dir="ltr"
          >
            +3.48R
          </span>
        </div>
      ),
    },
  ];
  return (
    <section id="product" className="scroll-mt-20 py-20 lg:py-28">
      <div className={WRAP}>
        <SectionHead
          eyebrow="محصول"
          title={
            <>
              از تحلیل تا نتیجه،
              <br />
              <span className={GRADIENT_TEXT}>سه قدم</span>
            </>
          }
          desc="هر جلسه یک بازه از بازار است با حساب مجازی. بازپخش کنید، معامله کنید و عملکرد را بسنجید."
        />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <article key={s.title} className={`${CARD_HOVER} group overflow-hidden`}>
              <div className="relative h-44 overflow-hidden border-b border-white/[0.07] bg-[#060a14]">
                {s.visual}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(47,123,255,0.14),transparent_70%)]" />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-[12px] font-black text-[#9cc4ff]">
                    {faNumber(s.n)}
                  </span>
                  <h3 className="text-[17px] font-extrabold text-white">{s.title}</h3>
                </div>
                <p className="mt-3 text-[13.5px] leading-7 text-[#8b98b8]">{s.desc}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Link
            href={signedIn ? '/backtest' : '/login'}
            className={`${BTN_GHOST} h-11 px-6 text-sm`}
          >
            {signedIn ? 'جلسه‌های من' : 'اولین جلسه را بسازید'}
            <Svg d={I.arrow} className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── live chart demo ───────────────────────── */

function ChartDemo() {
  return (
    <section id="chart" className="relative scroll-mt-20 overflow-hidden py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_50%,rgba(47,123,255,0.12),transparent_70%)]" />
      <div className={`${WRAP} relative`}>
        <SectionHead
          eyebrow="نمودار زنده"
          title="همین الان روی نمودار تمرین کنید"
          desc="این همان موتور نمودار پلتفرم است؛ با داده تاریخی و بازپخش روشن. بکشید، زوم کنید، ابزار بگذارید."
        />
        <div className="relative mx-auto mt-12 max-w-[1120px]">
          <div className="absolute -inset-x-6 -top-6 bottom-4 rounded-[36px] bg-[radial-gradient(50%_50%_at_50%_30%,rgba(47,123,255,0.28),transparent_70%)] blur-2xl" />
          <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[#070b16] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)]">
            <div
              className="flex h-9 items-center gap-2 border-b border-white/[0.08] bg-[#0a1020] px-4"
              dir="ltr"
            >
              <span className="h-2 w-2 rounded-full bg-[#ef5b7a]/70" />
              <span className="h-2 w-2 rounded-full bg-[#f5c451]/70" />
              <span className="h-2 w-2 rounded-full bg-[#4a9dff]/70" />
              <span className="ms-3 font-mono text-[11px] text-[#6f82b3]">
                interactive demo · historical data
              </span>
            </div>
            <LandingChart />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── battle (مسابقه و نبرد) ───────────────────────── */

const BATTLE_GRADIENT =
  'bg-gradient-to-l from-[#ffd978] via-[#f5c451] to-[#7db4ff] bg-clip-text text-transparent';

function Battle({ signedIn }: { signedIn: boolean }) {
  const board = [
    { r: 1, name: 'معامله‌گر A', tier: 'استاد', elo: '۲٬۴۱۰', pnl: '+4.80R', d: '+۲۴' },
    { r: 2, name: 'معامله‌گر B', tier: 'الماس', elo: '۲٬۲۸۰', pnl: '+3.10R', d: '+۱۲' },
    { r: 3, name: 'شما', tier: 'طلا', elo: '۱٬۹۶۰', pnl: '+1.62R', d: '+۹', me: true },
    { r: 4, name: 'معامله‌گر C', tier: 'طلا', elo: '۱٬۸۴۰', pnl: '−0.40R', d: '−۷' },
    { r: 5, name: 'معامله‌گر D', tier: 'نقره', elo: '۱٬۶۵۰', pnl: '−1.90R', d: '−۱۵' },
  ];
  const pillars = [
    {
      icon: I.candles,
      title: 'همه روی یک بازار',
      desc: 'یک بازه تاریخی مشترک؛ همه روی همان کندل‌ها معامله می‌کنند، پس فقط مهارت فرق می‌کند.',
    },
    {
      icon: I.stats,
      title: 'رتبه با امتیاز الو',
      desc: 'بعد از هر نبرد امتیازتان بالا یا پایین می‌رود و رتبه‌تان جابه‌جا می‌شود.',
    },
  ];
  return (
    <section id="battle" className="relative scroll-mt-20 overflow-hidden py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_40%_at_50%_25%,rgba(245,196,81,0.10),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_65%,rgba(47,123,255,0.16),transparent_70%)]" />

      <div className={`${WRAP} relative`}>
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#f5c451]/30 bg-[#f5c451]/10 px-3 py-1 text-xs font-bold text-[#f5c451]">
            <Svg d={I.swords} className="h-3.5 w-3.5" />
            رقابت با معامله‌گران دیگر
          </span>
          <h2 className="mt-5 text-[34px] font-black leading-[1.35] tracking-tight text-white sm:text-[52px] sm:leading-[1.3]">
            <span className={BATTLE_GRADIENT}>مسابقه و نبرد</span>
            <br />
            روی همان کندل‌ها
          </h2>
          <p className="mt-5 text-[15px] leading-8 text-[#8b98b8] sm:text-base sm:leading-9">
            یک بازه تاریخی مشترک برای همه شرکت‌کننده‌ها. هرکس روی همان کندل‌ها معامله می‌کند و رتبه
            با امتیاز الو جابه‌جا می‌شود؛ از تازه‌کار تا استاد.
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-[1080px]">
          <div className="absolute -inset-x-8 -top-8 bottom-8 rounded-[48px] bg-[radial-gradient(50%_60%_at_50%_40%,rgba(245,196,81,0.14),transparent_72%)] blur-3xl" />
          <div
            dir="ltr"
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070b16] shadow-[0_60px_140px_-40px_rgba(47,123,255,0.55),0_30px_90px_-50px_rgba(245,196,81,0.35)]"
          >
            <div className="flex h-11 items-center gap-3 border-b border-white/[0.08] bg-[#0a1020] px-3">
              <span className="flex items-center gap-1.5 rounded-md bg-[#f5c451]/15 px-2 py-1 text-[11px] font-black tracking-wider text-[#f5c451]">
                <Svg d={I.swords} className="h-3.5 w-3.5" />
                BATTLE
              </span>
              <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[12px] font-bold text-white">
                XAUUSD
              </span>
              <span className="rounded bg-[#2f7bff]/25 px-1.5 py-0.5 text-[11px] text-[#9cc4ff]">
                15m
              </span>
              <span className="flex-1" />
              <span className="hidden font-mono text-[11px] text-[#7d93c9] sm:inline">
                same candles · every player
              </span>
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* chart side */}
              <div className="relative h-[280px] min-w-0 flex-1 bg-[#060a14] lg:h-auto lg:min-h-[360px]">
                <div className="absolute inset-0 px-2 py-6">
                  <MiniCandles n={60} seed={33} hiddenFrom={44} />
                </div>
                {[
                  { left: '24%', top: '58%', t: 'BUY', c: UP },
                  { left: '46%', top: '30%', t: 'SELL', c: DOWN },
                ].map((m) => (
                  <span
                    key={m.t}
                    className="absolute -translate-x-1/2 rounded px-1.5 py-0.5 font-mono text-[9px] font-black"
                    style={{ left: m.left, top: m.top, background: `${m.c}33`, color: m.c }}
                  >
                    {m.t}
                  </span>
                ))}
                <span className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-[#2f7bff]/40 bg-[#2f7bff]/15 px-2.5 py-1 font-mono text-[11px] font-bold text-[#9cc4ff]">
                  YOU
                  <span style={{ color: UP }}>+1.62R</span>
                </span>
              </div>

              {/* leaderboard side */}
              <div
                dir="rtl"
                className="border-t border-white/[0.08] bg-[#0a1020] lg:w-[330px] lg:shrink-0 lg:border-l lg:border-t-0"
              >
                <div className="flex items-center justify-between px-4 py-3 text-[12px] text-[#7d8bac]">
                  <span className="flex items-center gap-1.5 font-semibold text-[#c9d4f0]">
                    <Svg d={I.trophy} className="h-4 w-4 text-[#f5c451]" />
                    رتبه‌بندی نبرد
                  </span>
                  <span>الو</span>
                </div>
                <div>
                  {board.map((b) => (
                    <div
                      key={b.r}
                      className={`flex items-center gap-3 border-t border-white/[0.05] px-4 py-3 ${
                        b.me ? 'bg-[#2f7bff]/10' : ''
                      }`}
                    >
                      <span className="flex w-5 justify-center">
                        {b.r === 1 ? (
                          <span className="text-[#f5c451]">
                            <Svg d={I.crown} className="h-4 w-4" />
                          </span>
                        ) : (
                          <span className="font-mono text-[12px] text-[#7d8bac]">
                            {faNumber(b.r)}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[#dbe4f8]">
                          {b.name}
                        </span>
                        <span className="text-[11px] text-[#7d8bac]">{b.tier}</span>
                      </span>
                      <span className="text-end" dir="ltr">
                        <span className="block font-mono text-[12.5px] font-bold text-white">
                          {b.elo}
                        </span>
                        <span
                          className="font-mono text-[11px] font-semibold"
                          style={{ color: b.d.startsWith('+') ? UP : DOWN }}
                        >
                          {b.d}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex h-11 items-center gap-3 border-t border-white/[0.08] bg-[#0a1020] px-3">
              <span className="font-mono text-[11px] text-[#7d93c9]">44 / 60</span>
              <div className="relative h-1 flex-1 rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 w-[73%] rounded-full bg-gradient-to-r from-[#f5c451] to-[#38d3ff]" />
              </div>
              <span className="hidden font-mono text-[11px] text-[#7d93c9] sm:inline">rank #3</span>
            </div>
          </div>
          <p className="mt-3 text-center text-[11.5px] text-[#6c7a9c]">
            داده‌های نمایش‌داده‌شده نمونه است.
          </p>
        </div>

        {/* pillars */}
        <div className="mx-auto mt-10 grid max-w-[1080px] gap-4 md:grid-cols-3">
          {pillars.map((p) => (
            <article key={p.title} className={`${CARD_HOVER} p-6`}>
              <IconBadge d={p.icon} />
              <h3 className="mt-4 text-[16px] font-extrabold text-white">{p.title}</h3>
              <p className="mt-2 text-[13.5px] leading-7 text-[#8b98b8]">{p.desc}</p>
            </article>
          ))}
          <article className={`${CARD_HOVER} p-6`}>
            <IconBadge d={I.trophy} />
            <h3 className="mt-4 text-[16px] font-extrabold text-white">از تازه‌کار تا استاد</h3>
            <p className="mt-2 text-[13.5px] leading-7 text-[#8b98b8]">
              هر سطحی که هستید، با هم‌سطح‌های خودتان رقابت می‌کنید و بالا می‌روید.
            </p>
            <div className="mt-4">
              <div className="h-1.5 rounded-full bg-gradient-to-l from-[#f5c451] via-[#38d3ff] to-[#2f7bff]" />
              <div className="mt-1.5 flex justify-between text-[11px] text-[#7d8bac]">
                <span>تازه‌کار</span>
                <span>استاد</span>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href={signedIn ? '/home' : '/login'}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f5c451] px-8 text-[15px] font-bold text-[#1a1304] shadow-[0_12px_32px_-12px_rgba(245,196,81,0.8)] transition hover:bg-[#ffd36b]"
          >
            {signedIn ? 'ورود به مسابقه و نبرد' : 'شروع کنید و وارد نبرد شوید'}
            <Svg d={I.arrow} className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── bento features ───────────────────────── */

function Bento() {
  const indicators = ['MA', 'RSI', 'MACD', 'Ichimoku', 'Candles', 'Heikin Ashi', 'Renko', '+'];
  return (
    <section id="features" className="scroll-mt-20 py-20 lg:py-28">
      <div className={WRAP}>
        <SectionHead
          eyebrow="امکانات"
          title="هرچه برای تمرین جدی لازم است"
          desc="تمرکز روی بازپخش، معامله مجازی و بررسی نتیجه؛ نه روی قیمت لحظه‌ای بازار."
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-6">
          {/* A — replay */}
          <article className={`${CARD_HOVER} overflow-hidden lg:col-span-4`}>
            <div className="p-6 pb-0">
              <div className="flex items-center gap-3">
                <IconBadge d={I.replay} />
                <h3 className="text-[17px] font-extrabold text-white">هر نموداری را بازپخش کنید</h3>
              </div>
              <p className="mt-3 max-w-lg text-[13.5px] leading-7 text-[#8b98b8]">
                نقطه شروع را روی نمودار یا با تاریخ انتخاب کنید. متوقف شوید، یک کندل جلو بروید یا
                تایم‌فریم را وسط جلسه عوض کنید.
              </p>
            </div>
            <div className="relative mt-5 h-52 border-t border-white/[0.07] bg-[#060a14]" dir="ltr">
              <MiniCandles n={52} seed={21} hiddenFrom={37} />
              <div className="absolute left-3 top-3 flex gap-1 text-[11px] text-[#7d93c9]">
                {['1m', '5m', '15m', '1H', '4H'].map((t) => (
                  <span
                    key={t}
                    className={`rounded px-1.5 py-0.5 ${t === '5m' ? 'bg-[#2f7bff]/25 text-[#9cc4ff]' : ''}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-[#9cb3e6] backdrop-blur">
                <Svg d={I.stepBack} className="h-3.5 w-3.5" />
                <span className="flex h-6 w-6 items-center justify-center rounded bg-[#2f7bff] text-white">
                  <Svg d={I.play} className="h-3 w-3" />
                </span>
                <Svg d={I.stepFwd} className="h-3.5 w-3.5" />
              </div>
            </div>
          </article>

          {/* B — virtual account */}
          <article className={`${CARD_HOVER} p-6 lg:col-span-2`}>
            <IconBadge d={I.candles} />
            <h3 className="mt-4 text-[17px] font-extrabold text-white">مثل حساب واقعی</h3>
            <p className="mt-2 text-[13.5px] leading-7 text-[#8b98b8]">
              حجم، حد ضرر، حد سود و اسپرد؛ بدون ریسک سرمایه.
            </p>
            <div className="mt-5 divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-[#060a14] px-4">
              <Row k="Size" v="0.40 lot" />
              <Row k="Spread" v="0.30" />
              <Row k="SL" v="2334.80" tone="down" />
              <Row k="TP" v="2352.40" tone="up" />
              <Row k="Result" v="+1.62R" tone="up" />
            </div>
          </article>

          {/* C — journal (auto-saved + manual images/notes) */}
          <article className={`${CARD_HOVER} overflow-hidden lg:col-span-4`}>
            <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div>
                <IconBadge d={I.journal} />
                <h3 className="mt-4 text-[17px] font-extrabold text-white">ژورنال خودکار</h3>
                <p className="mt-2 text-[13.5px] leading-7 text-[#8b98b8]">
                  هر معامله خودبه‌خود در ژورنال ذخیره می‌شود. یادداشت، تگ و عکس تحلیل را هم هر وقت
                  خواستید خودتان به همان معامله اضافه کنید.
                </p>
                <ul className="mt-4 space-y-2 text-[13px] text-[#c9d4f0]">
                  {[
                    'ثبت خودکار هر معامله',
                    'افزودن عکس و یادداشت دلخواه',
                    'مرور جلسه بدون گم شدن جزئیات',
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <span className="text-[#38d3ff]">
                        <Svg d={I.check} className="h-4 w-4" />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-[#060a14] p-4">
                <div className="flex items-center justify-between gap-2" dir="ltr">
                  <span className="font-mono text-[11.5px] text-[#9cb3e6]">
                    XAUUSD · BUY · 12 Mar
                  </span>
                  <span
                    className="flex items-center gap-1 rounded-full bg-[#38d3ff]/[0.12] px-2 py-0.5 text-[10.5px] font-semibold text-[#38d3ff]"
                    dir="rtl"
                  >
                    <Svg d={I.check} className="h-3 w-3" />
                    ذخیره خودکار
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2" dir="ltr">
                  {[
                    ['Entry', '2341.20', ''],
                    ['SL', '2334.80', DOWN],
                    ['TP', '2352.40', UP],
                    ['Result', '+1.62R', UP],
                  ].map(([k, v, c]) => (
                    <div key={k} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                      <div className="text-[9.5px] uppercase tracking-wide text-[#6c7a9c]">{k}</div>
                      <div
                        className="font-mono text-[11.5px] font-bold"
                        style={{ color: c || '#dbe4f8' }}
                      >
                        {v}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="my-3 flex items-center gap-2 text-[10.5px] text-[#6c7a9c]">
                  <span className="h-px flex-1 bg-white/[0.07]" />
                  افزوده‌شده توسط شما
                  <span className="h-px flex-1 bg-white/[0.07]" />
                </div>

                <p className="text-[12.5px] leading-6 text-[#b8c6e6]">
                  ورود بعد از بازگشت به ناحیه تقاضا؛ منتظر بسته شدن کندل تایید ماندم.
                </p>
                <div className="mt-3 flex items-center gap-2" dir="ltr">
                  <div className="h-14 w-20 overflow-hidden rounded-lg border border-white/10 bg-[#04070f]">
                    <MiniCandles n={14} seed={9} />
                  </div>
                  <div className="h-14 w-20 overflow-hidden rounded-lg border border-white/10 bg-[#04070f]">
                    <MiniCandles n={14} seed={17} />
                  </div>
                  <span className="flex h-14 w-20 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-white/20 text-[10px] text-[#7d8bac]">
                    <Svg d={I.plus} className="h-4 w-4" />
                    <span dir="rtl">افزودن عکس</span>
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['لندن', 'ریتریسمنت', 'طبق پلن'].map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-[#2f7bff]/[0.12] px-2 py-0.5 text-[11px] text-[#9cc4ff]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>

          {/* D — drawing tools */}
          <article className={`${CARD_HOVER} p-6 lg:col-span-2`}>
            <IconBadge d={I.pen} />
            <h3 className="mt-4 text-[17px] font-extrabold text-white">ابزار ترسیم</h3>
            <p className="mt-2 text-[13.5px] leading-7 text-[#8b98b8]">
              خط روند، فیبوناچی، کانال و پروفایل حجم روی بازپخش می‌مانند.
            </p>
            <div
              className="mt-5 h-[132px] rounded-xl border border-white/[0.07] bg-[#060a14]"
              dir="ltr"
            >
              <svg viewBox="0 0 300 132" className="h-full w-full" aria-hidden="true">
                {[
                  { y: 24, t: '0' },
                  { y: 52, t: '0.382' },
                  { y: 80, t: '0.618' },
                  { y: 108, t: '1' },
                ].map((l) => (
                  <g key={l.t}>
                    <line
                      x1="14"
                      x2="286"
                      y1={l.y}
                      y2={l.y}
                      stroke="rgba(90,162,255,0.35)"
                      strokeDasharray="3 4"
                    />
                    <text x="18" y={l.y - 4} fill="#6f82b3" fontSize="9" fontFamily="monospace">
                      {l.t}
                    </text>
                  </g>
                ))}
                <path
                  d="M24 100 L80 70 L120 88 L190 40 L240 56 L276 28"
                  fill="none"
                  stroke={UP}
                  strokeWidth="1.6"
                />
                <line x1="24" y1="112" x2="276" y2="20" stroke="#38d3ff" strokeWidth="1.2" />
                <circle cx="24" cy="112" r="3" fill="#04070f" stroke="#38d3ff" />
                <circle cx="276" cy="20" r="3" fill="#04070f" stroke="#38d3ff" />
              </svg>
            </div>
          </article>

          {/* E — indicators */}
          <article className={`${CARD_HOVER} lg:col-span-6`}>
            <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <IconBadge d={I.wave} />
                <div>
                  <h3 className="text-[17px] font-extrabold text-white">
                    اندیکاتور و انواع نمودار
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-7 text-[#8b98b8]">
                    همان نموداری که با آن تحلیل می‌کنید.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:max-w-md md:justify-end" dir="ltr">
                {indicators.map((t) => (
                  <span
                    key={t}
                    className="rounded-lg border border-white/[0.09] bg-white/[0.03] px-2.5 py-1 font-mono text-[11.5px] text-[#c9d4f0]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── dashboard + stats ───────────────────────── */

const SESSIONS = [
  {
    symbol: 'XAUUSD',
    name: 'اسکالپ لندن',
    tf: '15m',
    range: '12 Mar – 18 Mar 2025',
    pnl: '+۱٬۲۴۰',
    wr: '۶۲٪',
    trades: '۱۸',
    up: true,
  },
  {
    symbol: 'EURUSD',
    name: 'شکست آسیا',
    tf: '5m',
    range: '3 Feb – 7 Feb 2025',
    pnl: '−۲۱۸',
    wr: '۴۴٪',
    trades: '۲۶',
    up: false,
  },
  {
    symbol: 'NAS100',
    name: 'روند نیویورک',
    tf: '1H',
    range: '20 Jan – 31 Jan 2025',
    pnl: '+۳٬۴۸۰',
    wr: '۵۸٪',
    trades: '۱۴',
    up: true,
  },
  {
    symbol: 'GBPUSD',
    name: 'ریتریسمنت ۴ساعته',
    tf: '4H',
    range: '8 Dec – 22 Dec 2024',
    pnl: '+۸۹۵',
    wr: '۷۱٪',
    trades: '۹',
    up: true,
  },
] as const;

function Dashboard({ signedIn }: { signedIn: boolean }) {
  const stats = [
    { label: 'نرخ برد', value: '۵۸٪', sub: 'از ۱۸ معامله' },
    { label: 'فاکتور سود', value: '۱٫۸۴', sub: 'سود / زیان' },
    { label: 'میانگین R', value: '+۰٫۶۲', sub: 'به ازای هر معامله' },
    { label: 'بیشینه افت', value: '−۴٫۲٪', sub: 'از اوج موجودی' },
  ];
  return (
    <section className="py-16 lg:py-24">
      <div className={WRAP}>
        <SectionHead
          eyebrow="داشبورد و آمار"
          title="همه جلسه‌ها، یک‌جا؛ نتیجه هر جلسه، روی یک صفحه"
          desc="از همان‌جا که ماندید ادامه دهید، عملکرد را ببینید و با اعدادی که برای قضاوت استراتژی لازم است تصمیم بگیرید."
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          {/* sessions */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5 text-[12px] text-[#7d8bac]">
              <span className="font-semibold text-[#c9d4f0]">جلسه‌های اخیر</span>
              <span>سود و زیان · نرخ برد</span>
            </div>
            <ul>
              {SESSIONS.map((s, i) => (
                <li
                  key={s.symbol + s.name}
                  className={`flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.02] ${
                    i < SESSIONS.length - 1 ? 'border-b border-white/[0.06]' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-bold text-white" dir="ltr">
                        {s.symbol}
                      </span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-[#9cc4ff]">
                        {s.tf}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-[12px] text-[#7d8bac]">
                      {s.name}
                      <span className="mx-1.5 text-white/20">·</span>
                      <span dir="ltr">{s.range}</span>
                    </div>
                  </div>
                  <div className="text-end">
                    <div
                      className="font-mono text-[13.5px] font-bold"
                      style={{ color: s.up ? UP : DOWN }}
                    >
                      {s.pnl} $
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#7d8bac]">
                      برد {s.wr}
                      <span className="mx-1 text-white/20">·</span>
                      {s.trades} معامله
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-white/[0.07] p-4">
              <Link
                href={signedIn ? '/backtest' : '/login'}
                className={`${BTN_GHOST} h-10 w-full text-[13px]`}
              >
                {signedIn ? 'جلسه‌های من' : 'اولین جلسه را بسازید'}
                <Svg d={I.arrow} className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* stats */}
          <div className={`${CARD} flex flex-col p-5`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/[0.07] bg-[#060a14] px-4 py-4"
                >
                  <div className="text-[12px] text-[#7d8bac]">{s.label}</div>
                  <div className="mt-1.5 font-mono text-[26px] font-black tracking-tight text-white">
                    {s.value}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#6c7a9c]">{s.sub}</div>
                </div>
              ))}
            </div>
            <div className="relative mt-3 min-h-[180px] flex-1 overflow-hidden rounded-xl border border-white/[0.07] bg-[#060a14]">
              <div className="absolute start-4 top-3 z-10 text-[12px] text-[#7d8bac]">
                منحنی موجودی
              </div>
              <div className="absolute inset-0 pt-8">
                <EquityMini id="eq-dash" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── trade journal table ───────────────────────── */

const TRADES = [
  ['12 Mar 14:02', 'خرید', '0.40', '2341.20', '2334.80', '2352.40', '+186.40', '+1.62R'],
  ['12 Mar 11:18', 'فروش', '0.20', '2356.10', '2362.40', '2344.00', '−48.20', '−0.76R'],
  ['11 Mar 16:41', 'خرید', '0.30', '2328.50', '2322.00', '2340.80', '+124.00', '+1.90R'],
  ['11 Mar 09:05', 'فروش', '0.10', '2368.80', '2374.20', '2358.40', '+41.60', '+1.22R'],
  ['10 Mar 21:12', 'خرید', '0.50', '2312.40', '2304.10', '2328.00', '−92.50', '−1.00R'],
] as const;

function TradeTable() {
  return (
    <section className="py-12 lg:py-16">
      <div
        className={`${WRAP} grid items-center gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]`}
      >
        <SectionHead
          align="start"
          eyebrow="بک‌تست"
          title="استراتژی را روی بازار واقعی بسنجید"
          desc="هر ورود ثبت می‌شود: حجم، حد ضرر، حد سود، نتیجه و نسبت ریسک به ریوارد. هر معامله خودکار در ژورنال ذخیره می‌شود."
        />
        <div className={`${CARD} overflow-hidden`} dir="ltr">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.02] text-[11px] uppercase tracking-wide text-[#7d8bac]">
                  {['Time', 'Side', 'Size', 'Entry', 'SL', 'TP', 'P&L', 'R'].map((h) => (
                    <th key={h} className="px-3 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRADES.map((row) => (
                  <tr
                    key={row[0]}
                    className="border-b border-white/[0.05] transition hover:bg-white/[0.02] last:border-0"
                  >
                    {row.map((cell, i) => (
                      <td
                        key={i}
                        className="whitespace-nowrap px-3 py-3 font-mono"
                        style={{
                          color:
                            i === 6 || i === 7
                              ? cell.startsWith('+')
                                ? UP
                                : DOWN
                              : i === 1
                                ? cell === 'خرید'
                                  ? UP
                                  : DOWN
                                : '#c9d4f0',
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── pricing ───────────────────────── */

function Pricing({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="pricing" className="relative scroll-mt-20 overflow-hidden py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_45%_at_50%_55%,rgba(47,123,255,0.14),transparent_70%)]" />
      <div className={`${WRAP} relative`}>
        <SectionHead
          eyebrow="قیمت"
          title="سه طرح، از رایگان تا حرفه‌ای"
          desc="همان طرح‌های تنظیمات حساب. مبتدی برای شروع، متوسط برای تمرین منظم، و حرفه‌ای برای جلسه و نبرد نامحدود."
        />
        <LandingPricing signedIn={signedIn} />
      </div>
    </section>
  );
}

/* ───────────────────────── faq ───────────────────────── */

function Faq() {
  const items: ReadonlyArray<readonly [string, ReactNode]> = [
    [
      'این پلتفرم چیست؟',
      <>
        <BrandName /> محیط تمرین معامله است: بازارهای تاریخی را کندل‌به‌کندل بازپخش می‌کنید، با حساب
        مجازی معامله می‌کنید و نتیجه را در آمار و ژورنال می‌بینید. قیمت لحظه‌ای بازار زنده موضوع این
        محصول نیست.
      </>,
    ],
    [
      'آیا با سرمایه واقعی معامله می‌شود؟',
      'خیر. همه معاملات روی حساب مجازی جلسه است. هدف، سنجش استراتژی قبل از ریسک روی حساب واقعی است.',
    ],
    [
      'بازپخش چطور کار می‌کند؟',
      'نقطه شروع را روی نمودار یا با تاریخ انتخاب می‌کنید. کندل‌های بعد پنهان می‌شوند و بازار با سرعت دلخواه جلو می‌آید. می‌توانید متوقف شوید، یک کندل جلو بروید یا تایم‌فریم را عوض کنید.',
    ],
    [
      'چه نمادهایی در دسترس است؟',
      'طلا، جفت‌ارزهای اصلی و شاخص نزدک؛ همان نمادهایی که برای بک‌تست فارکس و شاخص استفاده می‌شود.',
    ],
    [
      'مسابقه و نبرد چیست؟',
      'یک بازه تاریخی مشترک برای همه شرکت‌کننده‌ها. همه روی همان کندل‌ها معامله می‌کنند و رتبه با امتیاز الو جابه‌جا می‌شود؛ از تازه‌کار تا استاد.',
    ],
    [
      'ثبت‌نام چطور است؟',
      'شماره موبایل را وارد می‌کنید و کد پیامکی را می‌زنید. اگر حساب نداشته باشید ساخته می‌شود.',
    ],
    [
      'هزینه اشتراک چقدر است؟',
      `طرح مبتدی رایگان است. طرح متوسط ${faNumber(MID_TOMAN)} تومان و طرح حرفه‌ای ${faNumber(PRO_TOMAN)} تومان در ماه است. پرداخت سالانه برابر همان مبلغ برای دوازده ماه است.`,
    ],
  ];
  return (
    <section id="faq" className="scroll-mt-20 py-20 lg:py-24">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <SectionHead eyebrow="سوالات متداول" title="پاسخ پرسش‌های رایج" />
        <div className="mt-12 divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080c17]">
          {items.map(([q, a]) => (
            <details key={q} className="group px-6 transition-colors open:bg-white/[0.02]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-bold text-white [&::-webkit-details-marker]:hidden">
                {q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-[#9cc4ff] transition-transform duration-300 group-open:rotate-45">
                  <Svg d={I.plus} className="h-4 w-4" />
                </span>
              </summary>
              <p className="pb-6 pe-10 text-[14px] leading-8 text-[#8b98b8]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── final cta ───────────────────────── */

function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="px-5 pb-24 lg:px-8">
      <div className="relative mx-auto max-w-[1100px] overflow-hidden rounded-[28px] border border-white/10 bg-[#070c1a] px-6 py-16 text-center sm:px-16 sm:py-20">
        <div className="pointer-events-none absolute inset-0" style={GRID_BG} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_100%,rgba(47,123,255,0.40),transparent_70%)]" />
        <div className="relative">
          <h2 className="text-[30px] font-black leading-[1.4] text-white sm:text-[44px] sm:leading-[1.3]">
            تمرین را <span className={GRADIENT_TEXT}>از امروز</span> شروع کنید
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-8 text-[#9fb0d6]">
            بدون سرمایه واقعی. یک جلسه بسازید، بازار را بازپخش کنید و ببینید استراتژی‌تان روی تاریخ
            چه می‌کند.
          </p>
          <div className="mt-9 flex justify-center">
            <Link
              href={signedIn ? '/home' : '/login'}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-8 text-[15px] font-bold text-[#071330] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] transition hover:bg-[#eaf1ff]"
            >
              {signedIn ? 'ورود به داشبورد' : 'شروع کنید'}
              <Svg d={I.arrow} className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── footer ───────────────────────── */

/** Official eNamad markup. Must stay byte-for-byte; `rel` hides the seal. */
const ENAMAD_SEAL =
  "<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=8343802&Code=5bo2myaIWwmdvi940YyWJ3fB7dchv2Kp'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=8343802&Code=5bo2myaIWwmdvi940YyWJ3fB7dchv2Kp' alt='' style='cursor:pointer' code='5bo2myaIWwmdvi940YyWJ3fB7dchv2Kp'></a>";

function Footer({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="border-t border-white/[0.07]">
      <div className={`${WRAP} grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]`}>
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[13px] leading-7 text-[#7d8bac]">
            محیط تمرین معامله: بازپخش بازار، حساب مجازی، ژورنال و آمار. بدون ریسک سرمایه.
          </p>
        </div>
        <nav aria-label="لینک‌های پایین صفحه">
          <div className="text-[13px] font-bold text-white">محصول</div>
          <ul className="mt-4 space-y-2.5">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="text-[13px] text-[#7d8bac] transition hover:text-white">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <div className="text-[13px] font-bold text-white">حساب کاربری</div>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link
                href={signedIn ? '/home' : '/login'}
                className="text-[13px] text-[#7d8bac] transition hover:text-white"
              >
                {signedIn ? 'داشبورد' : 'ورود / ثبت‌نام'}
              </Link>
            </li>
            <li>
              <Link
                href={signedIn ? '/backtest' : '/login'}
                className="text-[13px] text-[#7d8bac] transition hover:text-white"
              >
                جلسه‌های بک‌تست
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.06]">
        <div
          className={`${WRAP} flex flex-col items-center justify-between gap-4 py-6 sm:flex-row`}
        >
          <p className="text-xs text-[#6c7a9c]">
            © ۱۴۰۵ <BrandName />. تمامی حقوق محفوظ است.
          </p>
          <p className="text-center text-xs text-[#6c7a9c]">
            این پلتفرم برای آموزش و تمرین است و توصیه سرمایه‌گذاری نیست.
          </p>
          <div
            className="shrink-0"
            aria-label="نماد اعتماد الکترونیکی"
            dangerouslySetInnerHTML={{ __html: ENAMAD_SEAL }}
          />
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── page ───────────────────────── */

export function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="relative overflow-x-clip bg-[#04070f] text-[#e8eefc] antialiased selection:bg-[#2f7bff]/40">
      <Header signedIn={signedIn} />
      <main>
        <Hero signedIn={signedIn} />
        <FactsStrip />
        <HowItWorks signedIn={signedIn} />
        <ChartDemo />
        <Battle signedIn={signedIn} />
        <Bento />
        <Dashboard signedIn={signedIn} />
        <TradeTable />
        <Pricing signedIn={signedIn} />
        <Faq />
        <FinalCta signedIn={signedIn} />
      </main>
      <Footer signedIn={signedIn} />
    </div>
  );
}
