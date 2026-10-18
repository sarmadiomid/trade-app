/** Replay-session scene for the landing hero (pure SVG, no live-market cues). */

const W = 760;
const H = 420;
const PLOT_H = 318;
const RIGHT = 62;
const N = 52;
const REVEALED = 38;
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
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const out: Candle[] = [];
  let price = 2348;
  for (let i = 0; i < N; i++) {
    const drift = i < 14 ? -0.9 : i < 26 ? 1.35 : i < 34 ? -0.45 : 0.7;
    const o = price;
    const c = o + drift + (rnd() - 0.5) * 4.2;
    const h = Math.max(o, c) + rnd() * 1.8;
    const l = Math.min(o, c) - rnd() * 1.8;
    out.push({ o, h, l, c, v: 0.28 + rnd() * 0.72 + Math.abs(c - o) * 0.08 });
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

const CANDLES = series();
const CLOSES = CANDLES.map((c) => c.c);
const EMA = ema(CLOSES, 9);
const MIN = Math.min(...CANDLES.map((c) => c.l)) - 3;
const MAX = Math.max(...CANDLES.map((c) => c.h)) + 3;
const STEP = (W - RIGHT - 18) / N;
const x = (i: number) => 14 + i * STEP + STEP / 2;
const y = (p: number) => 26 + ((MAX - p) / (MAX - MIN)) * (PLOT_H - 40);

const entryIdx = 27;
const entry = CANDLES[entryIdx]!.c;
const stop = entry - 11;
const target = entry + 18;
const last = CANDLES[REVEALED - 1]!;
const line = (pts: number[], fy: (v: number) => number) =>
  pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${fy(v).toFixed(1)}`).join(' ');

export function HeroChart() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="بازپخش نمودار طلا با پوزیشن باز و کندل‌های آینده پنهان"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={`h${i}`}
          x1="0"
          x2={W - RIGHT}
          y1={26 + i * 52}
          y2={26 + i * 52}
          stroke="#5a78c8"
          strokeOpacity=".1"
        />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={`v${i}`}
          y1="0"
          y2={PLOT_H}
          x1={16 + i * 90}
          x2={16 + i * 90}
          stroke="#5a78c8"
          strokeOpacity=".07"
        />
      ))}

      <text x="14" y="16" fontSize="11" fontFamily={MONO} fill={EMA_COLOR}>
        EMA 9
      </text>
      <text x="78" y="16" fontSize="11" fontFamily={MONO} fill="#7dd3fc">
        Position LONG 0.40
      </text>

      <rect
        x={x(entryIdx)}
        y={y(target)}
        width={W - RIGHT - x(entryIdx)}
        height={Math.max(1, y(entry) - y(target))}
        fill={UP}
        opacity=".13"
      />
      <rect
        x={x(entryIdx)}
        y={y(entry)}
        width={W - RIGHT - x(entryIdx)}
        height={Math.max(1, y(stop) - y(entry))}
        fill={DOWN}
        opacity=".13"
      />
      <line
        x1={x(entryIdx)}
        x2={W - RIGHT}
        y1={y(entry)}
        y2={y(entry)}
        stroke="#9cc4ff"
        strokeDasharray="3 3"
        strokeOpacity=".7"
      />
      <line
        x1={x(entryIdx)}
        x2={W - RIGHT}
        y1={y(target)}
        y2={y(target)}
        stroke={UP}
        strokeOpacity=".55"
      />
      <line
        x1={x(entryIdx)}
        x2={W - RIGHT}
        y1={y(stop)}
        y2={y(stop)}
        stroke={DOWN}
        strokeOpacity=".55"
      />

      {CANDLES.map((c, i) => (
        <rect
          key={`vol${i}`}
          x={x(i) - STEP * 0.32}
          width={STEP * 0.64}
          y={PLOT_H - c.v * 28}
          height={c.v * 28}
          fill={c.c >= c.o ? UP : DOWN}
          opacity={i < REVEALED ? 0.22 : 0.05}
        />
      ))}

      {CANDLES.map((c, i) => {
        const up = c.c >= c.o;
        const color = up ? UP : DOWN;
        const top = y(Math.max(c.o, c.c));
        return (
          <g key={i} opacity={i < REVEALED ? 1 : 0.08}>
            <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1.2" />
            <rect
              x={x(i) - STEP * 0.34}
              y={top}
              width={STEP * 0.68}
              height={Math.max(1.2, y(Math.min(c.o, c.c)) - top)}
              rx="1"
              fill={color}
            />
          </g>
        );
      })}

      <path
        d={line(EMA.slice(0, REVEALED), y)}
        stroke={EMA_COLOR}
        strokeWidth="1.7"
        fill="none"
        strokeOpacity=".9"
      />

      <circle cx={x(entryIdx)} cy={y(entry)} r="4" fill="#030a1c" stroke={UP} strokeWidth="2" />
      <text x={x(entryIdx) + 8} y={y(entry) - 8} fill="#9cc4ff" fontSize="10" fontFamily={MONO}>
        LONG 0.40
      </text>

      <line
        x1={x(REVEALED - 1) + STEP * 0.4}
        x2={x(REVEALED - 1) + STEP * 0.4}
        y1="0"
        y2={PLOT_H}
        stroke="#38d3ff"
        strokeWidth="1.6"
      />

      <line
        x1="0"
        x2={W - RIGHT}
        y1={y(last.c)}
        y2={y(last.c)}
        stroke={UP}
        strokeDasharray="2 3"
        strokeOpacity=".75"
      />
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
        {last.c.toFixed(1)}
      </text>
      {[0, 1, 2, 3, 4].map((i) => {
        const p = MAX - ((MAX - MIN) / 5) * (i + 0.5);
        return (
          <text
            key={i}
            x={W - RIGHT / 2}
            y={y(p) + 3}
            fill="#6f84b8"
            fontSize="10"
            textAnchor="middle"
            fontFamily={MONO}
          >
            {p.toFixed(1)}
          </text>
        );
      })}

      <line x1="0" x2={W} y1={PLOT_H} y2={PLOT_H} stroke="#5a78c8" strokeOpacity=".18" />
      {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'].map((t, i) => (
        <text
          key={t}
          x={48 + i * 96}
          y={PLOT_H + 18}
          fill="#6f84b8"
          fontSize="10"
          textAnchor="middle"
          fontFamily={MONO}
        >
          {t}
        </text>
      ))}
      <line x1={W - RIGHT} x2={W - RIGHT} y1="0" y2={H} stroke="#5a78c8" strokeOpacity=".18" />

      <rect x="16" y={PLOT_H + 32} width="728" height="66" rx="10" fill="#0a1838" />
      <text x="36" y={PLOT_H + 58} fill="#9cc4ff" fontSize="12" fontFamily={MONO}>
        ▶  1x   ·   12 Mar 2025  14:15
      </text>
      <text x="280" y={PLOT_H + 58} fill="#4a9dff" fontSize="12" fontFamily={MONO}>
        LONG  +$186.40   ·   R 1 : 1.6
      </text>
      <text x="520" y={PLOT_H + 58} fill="#8d9cc4" fontSize="12" fontFamily={MONO}>
        Balance  $10,186.40
      </text>
    </svg>
  );
}
