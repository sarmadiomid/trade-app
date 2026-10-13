/** Decorative, deterministic chart scene for the landing page hero (pure SVG). */

const W = 760;
const H = 450;
const PLOT_H = 320;
const PANE_TOP = 352;
const PANE_BOTTOM = 440;
const RIGHT = 64;
const N = 54;
const UP = '#4a9dff';
const DOWN = '#ef5b7a';
const EMA_COLOR = '#f5c451';
const MONO = 'ui-monospace, monospace';

interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

function series(): Candle[] {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const out: Candle[] = [];
  let price = 100;
  for (let i = 0; i < N; i++) {
    const drift = i < 18 ? -0.35 : i < 30 ? 0.9 : i < 38 ? -0.6 : 0.85;
    const o = price;
    const c = o + drift + (rnd() - 0.5) * 3.2;
    const h = Math.max(o, c) + rnd() * 1.6;
    const l = Math.min(o, c) - rnd() * 1.6;
    out.push({ o, h, l, c, v: 0.3 + rnd() * 0.7 + Math.abs(c - o) * 0.15 });
    price = c;
  }
  return out;
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1]! * (1 - k)));
  return out;
}

function rsi(values: number[], period: number): number[] {
  const out: number[] = [50];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    const n = Math.min(i, period);
    gain = (gain * (n - 1) + g) / n;
    loss = (loss * (n - 1) + l) / n;
    out.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  }
  return out;
}

const CANDLES = series();
const CLOSES = CANDLES.map((c) => c.c);
const EMA = ema(CLOSES, 9);
const RSI = rsi(CLOSES, 14);
const MIN = Math.min(...CANDLES.map((c) => c.l)) - 2;
const MAX = Math.max(...CANDLES.map((c) => c.h)) + 2;
const STEP = (W - RIGHT - 16) / N;
const x = (i: number) => 12 + i * STEP + STEP / 2;
const y = (p: number) => 28 + ((MAX - p) / (MAX - MIN)) * (PLOT_H - 46);
const ry = (v: number) => PANE_TOP + 8 + ((100 - v) / 100) * (PANE_BOTTOM - PANE_TOP - 16);

const lowIdx = CANDLES.reduce((b, c, i) => (c.l < CANDLES[b]!.l ? i : b), 0);
const highIdx = CANDLES.reduce((b, c, i) => (c.h > CANDLES[b]!.h && i < 34 ? i : b), 0);
const FIB = [0, 0.382, 0.5, 0.618, 1];
const last = CANDLES[N - 1]!;
const line = (pts: number[], fy: (v: number) => number) =>
  pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${fy(v).toFixed(1)}`).join(' ');

export function HeroChart() {
  const lo = CANDLES[lowIdx]!.l;
  const hi = CANDLES[highIdx]!.h;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="نمودار شمعی با اندیکاتور میانگین متحرک، RSI و ابزارهای ترسیم"
    >
      <defs>
        <linearGradient id="hc-fib" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38d3ff" stopOpacity=".1" />
          <stop offset="1" stopColor="#2f7bff" stopOpacity=".03" />
        </linearGradient>
        <linearGradient id="hc-rsi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b7bff" stopOpacity=".25" />
          <stop offset="1" stopColor="#8b7bff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: 6 }, (_, i) => (
        <line key={`h${i}`} x1="0" x2={W - RIGHT} y1={28 + i * 55} y2={28 + i * 55} stroke="#5a78c8" strokeOpacity=".1" />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`v${i}`} y1="0" y2={PANE_BOTTOM} x1={12 + i * 85} x2={12 + i * 85} stroke="#5a78c8" strokeOpacity=".07" />
      ))}

      <text x="12" y="16" fontSize="11" fontFamily={MONO} fill="#9cc4ff">
        BTCUSDT · 1H · Binance
      </text>
      <text x="180" y="16" fontSize="11" fontFamily={MONO} fill={EMA_COLOR}>
        EMA 9 {EMA[N - 1]!.toFixed(2)}
      </text>
      <text x="300" y="16" fontSize="11" fontFamily={MONO} fill="#7dd3fc">
        Fib Retracement
      </text>

      <rect x={x(lowIdx)} y={y(hi)} width={x(N - 1) - x(lowIdx)} height={y(lo) - y(hi)} fill="url(#hc-fib)" />
      {FIB.map((f) => {
        const p = hi - (hi - lo) * f;
        return (
          <g key={f}>
            <line
              x1={x(lowIdx)}
              x2={W - RIGHT}
              y1={y(p)}
              y2={y(p)}
              stroke="#5aa2ff"
              strokeOpacity={f === 0.618 ? 0.85 : 0.35}
              strokeDasharray={f === 0 || f === 1 ? undefined : '4 4'}
            />
            <text x={W - RIGHT - 34} y={y(p) - 4} fill="#8fb8ff" fontSize="9.5" fontFamily={MONO}>
              {f.toFixed(3)}
            </text>
          </g>
        );
      })}

      {CANDLES.map((c, i) => (
        <rect
          key={`vol${i}`}
          x={x(i) - STEP * 0.32}
          width={STEP * 0.64}
          y={PLOT_H - c.v * 30}
          height={c.v * 30}
          fill={c.c >= c.o ? UP : DOWN}
          opacity=".2"
        />
      ))}

      {CANDLES.map((c, i) => {
        const up = c.c >= c.o;
        const top = y(Math.max(c.o, c.c));
        return (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={up ? UP : DOWN} strokeWidth="1.2" />
            <rect
              x={x(i) - STEP * 0.34}
              y={top}
              width={STEP * 0.68}
              height={Math.max(1.2, y(Math.min(c.o, c.c)) - top)}
              rx="1"
              fill={up ? UP : DOWN}
            />
          </g>
        );
      })}

      <path d={line(EMA, y)} stroke={EMA_COLOR} strokeWidth="1.8" fill="none" strokeOpacity=".95" />

      <path
        className="mk-draw"
        d={`M${x(lowIdx)},${y(lo) + 6} L${x(N - 1) + 30},${y(lo + (last.c - lo) * 1.05) + 6}`}
        stroke="#38d3ff"
        strokeWidth="2"
        fill="none"
      />
      <circle cx={x(lowIdx)} cy={y(lo) + 6} r="4.5" fill="#030a1c" stroke="#38d3ff" strokeWidth="2" />

      <line x1="0" x2={W - RIGHT} y1={y(last.c)} y2={y(last.c)} stroke={UP} strokeDasharray="2 3" strokeOpacity=".8" />
      <rect x={W - RIGHT + 2} y={y(last.c) - 10} width={RIGHT - 6} height="20" rx="3" fill={UP} />
      <text
        x={W - RIGHT / 2 - 1}
        y={y(last.c) + 4}
        fill="#fff"
        fontSize="11"
        fontWeight="700"
        textAnchor="middle"
        fontFamily={MONO}
      >
        {last.c.toFixed(2)}
      </text>
      {[0, 1, 2, 3, 4].map((i) => {
        const p = MAX - ((MAX - MIN) / 5) * (i + 0.5);
        return (
          <text key={i} x={W - RIGHT / 2} y={y(p) + 3} fill="#6f84b8" fontSize="10" textAnchor="middle" fontFamily={MONO}>
            {p.toFixed(1)}
          </text>
        );
      })}

      <line x1="0" x2={W} y1={PLOT_H} y2={PLOT_H} stroke="#5a78c8" strokeOpacity=".18" />
      {['09:00', '12:00', '15:00', '18:00', '21:00', '00:00', '03:00', '06:00'].map((t, i) => (
        <text key={t} x={40 + i * 85} y={PLOT_H + 20} fill="#6f84b8" fontSize="10" textAnchor="middle" fontFamily={MONO}>
          {t}
        </text>
      ))}

      <line x1="0" x2={W} y1={PANE_TOP} y2={PANE_TOP} stroke="#5a78c8" strokeOpacity=".18" />
      <rect x="0" y={ry(70)} width={W - RIGHT} height={ry(30) - ry(70)} fill="#8b7bff" opacity=".06" />
      {[70, 30].map((v) => (
        <g key={v}>
          <line x1="0" x2={W - RIGHT} y1={ry(v)} y2={ry(v)} stroke="#8b7bff" strokeOpacity=".4" strokeDasharray="3 4" />
          <text x={W - RIGHT / 2} y={ry(v) + 3} fill="#6f84b8" fontSize="10" textAnchor="middle" fontFamily={MONO}>
            {v}
          </text>
        </g>
      ))}
      <path d={`${line(RSI, ry)} L${x(N - 1)},${PANE_BOTTOM} L${x(0)},${PANE_BOTTOM} Z`} fill="url(#hc-rsi)" />
      <path d={line(RSI, ry)} stroke="#a594ff" strokeWidth="1.6" fill="none" />
      <text x="12" y={PANE_TOP + 14} fontSize="10.5" fontFamily={MONO} fill="#a594ff">
        RSI 14 · {RSI[N - 1]!.toFixed(1)}
      </text>
      <line x1={W - RIGHT} x2={W - RIGHT} y1="0" y2={H} stroke="#5a78c8" strokeOpacity=".18" />
    </svg>
  );
}
