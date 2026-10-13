'use client';

import { useMemo, useState, type ReactNode } from 'react';

/** Series colours (validated: blue slot 1, polarity = the theme's up / down). */
export const CHART = {
  series: '#3987e5',
  up: 'var(--tc-up)',
  down: 'var(--tc-down)',
  grid: 'var(--tc-border)',
  text: 'var(--tc-muted)',
} as const;

/** Position in percent of the chart box (the SVG keeps its aspect ratio). */
interface Tip {
  readonly x: number;
  readonly y: number;
  readonly content: ReactNode;
}

function Tooltip({ tip }: { readonly tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-panel px-2 py-1 text-[11.5px] text-fg shadow-lg"
      style={{ left: `${tip.x}%`, top: `calc(${tip.y}% - 8px)` }}
    >
      {tip.content}
    </div>
  );
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const step0 = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

const compact = (v: number) =>
  Math.abs(v) >= 1000
    ? `${(v / 1000).toFixed(Math.abs(v) >= 10_000 ? 0 : 1)}k`
    : v.toFixed(Math.abs(v) < 10 ? 1 : 0);

export interface LinePoint {
  readonly x: number;
  readonly y: number;
  readonly tip: ReactNode;
}

/** Single-series line (equity curve); crosshair + tooltip on hover. */
export function LineChart({
  points,
  height = 220,
  baseline,
  color = CHART.series,
  fill = true,
  label,
}: {
  readonly points: readonly LinePoint[];
  readonly height?: number;
  readonly baseline?: number;
  readonly color?: string;
  readonly fill?: boolean;
  readonly label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const pad = { l: 48, r: 12, t: 10, b: 22 };
  const geo = useMemo(() => {
    const ys = points.map((p) => p.y);
    if (baseline !== undefined) ys.push(baseline);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const span = max - min || 1;
    const lo = min - span * 0.05;
    const hi = max + span * 0.05;
    const x = (i: number) =>
      pad.l + (points.length < 2 ? 0 : (i / (points.length - 1)) * (W - pad.l - pad.r));
    const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b);
    return { x, y, ticks: niceTicks(lo, hi), lo };
  }, [points, baseline, height, pad.l, pad.r, pad.t, pad.b]);
  if (points.length === 0) return <Empty height={height} />;
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${geo.x(i).toFixed(1)},${geo.y(p.y).toFixed(1)}`)
    .join('');
  const area = `${d}L${geo.x(points.length - 1)},${height - pad.b}L${geo.x(0)},${height - pad.b}Z`;
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((fx - pad.l) / (W - pad.l - pad.r)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const hp = hover === null ? null : points[hover]!;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        role="img"
        aria-label={label}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {geo.ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={geo.y(t)}
              y2={geo.y(t)}
              stroke={CHART.grid}
              strokeWidth={1}
            />
            <text x={pad.l - 6} y={geo.y(t) + 4} textAnchor="end" fontSize={10.5} fill={CHART.text}>
              {compact(t)}
            </text>
          </g>
        ))}
        {baseline !== undefined ? (
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={geo.y(baseline)}
            y2={geo.y(baseline)}
            stroke={CHART.text}
            strokeWidth={1}
            opacity={0.6}
          />
        ) : null}
        {fill ? <path d={area} fill={color} opacity={0.12} /> : null}
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {hp && hover !== null ? (
          <>
            <line
              x1={geo.x(hover)}
              x2={geo.x(hover)}
              y1={pad.t}
              y2={height - pad.b}
              stroke={CHART.text}
              strokeWidth={1}
              opacity={0.5}
            />
            <circle
              cx={geo.x(hover)}
              cy={geo.y(hp.y)}
              r={4}
              fill={color}
              stroke="var(--tc-panel)"
              strokeWidth={2}
            />
          </>
        ) : null}
      </svg>
      <Tooltip
        tip={
          hp && hover !== null
            ? { x: (geo.x(hover) / W) * 100, y: (geo.y(hp.y) / height) * 100, content: hp.tip }
            : null
        }
      />
    </div>
  );
}

export interface BarDatum {
  readonly label: string;
  readonly value: number;
  readonly tip: ReactNode;
}

/** Bars around zero coloured by polarity (P&L by weekday, hour, session…). */
export function BarChart({
  data,
  height = 180,
  label,
  polarity = true,
}: {
  readonly data: readonly BarDatum[];
  readonly height?: number;
  readonly label: string;
  readonly polarity?: boolean;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const W = 800;
  const pad = { l: 48, r: 8, t: 10, b: 24 };
  const vals = data.map((d) => d.value);
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  const lo = min === max ? -1 : min;
  const hi = min === max ? 1 : max;
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b);
  const band = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(40, band - 2));
  if (data.length === 0) return <Empty height={height} />;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        role="img"
        aria-label={label}
        onMouseLeave={() => setTip(null)}
      >
        {niceTicks(lo, hi).map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(t)}
              y2={y(t)}
              stroke={CHART.grid}
              strokeWidth={1}
            />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={10.5} fill={CHART.text}>
              {compact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const top = Math.min(y(d.value), y(0));
          const h = Math.max(1, Math.abs(y(d.value) - y(0)));
          const color = !polarity ? CHART.series : d.value >= 0 ? CHART.up : CHART.down;
          return (
            <g key={d.label}>
              <rect
                x={cx - bw / 2}
                y={top}
                width={bw}
                height={h}
                rx={Math.min(4, bw / 2)}
                fill={color}
              />
              <rect
                x={pad.l + band * i}
                y={pad.t}
                width={band}
                height={height - pad.t - pad.b}
                fill="transparent"
                onMouseEnter={() =>
                  setTip({ x: (cx / W) * 100, y: (top / height) * 100, content: d.tip })
                }
              />
              {data.length <= 24 && (data.length <= 12 || i % 2 === 0) ? (
                <text x={cx} y={height - 8} textAnchor="middle" fontSize={10.5} fill={CHART.text}>
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <line
          x1={pad.l}
          x2={W - pad.r}
          y1={y(0)}
          y2={y(0)}
          stroke={CHART.text}
          strokeWidth={1}
          opacity={0.6}
        />
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

function Empty({ height }: { readonly height: number }) {
  return (
    <div className="flex items-center justify-center text-[12.5px] text-muted" style={{ height }}>
      No trades yet
    </div>
  );
}
