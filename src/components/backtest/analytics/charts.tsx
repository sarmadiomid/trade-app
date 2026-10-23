'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';

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

/** Axis label with as many digits as the tick spacing needs (10,200 / 10,400, not 10k / 10k). */
function tickLabel(v: number, ticks: readonly number[]): string {
  const step = ticks.length > 1 ? Math.abs(ticks[1]! - ticks[0]!) : Math.abs(v) || 1;
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  const out = (Math.abs(v) < step / 1e6 ? 0 : v).toLocaleString('fa-IR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return out.replace('-', '−');
}

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
  gradient = false,
  xLabels,
  label,
}: {
  readonly points: readonly LinePoint[];
  readonly height?: number;
  readonly baseline?: number;
  readonly color?: string;
  readonly fill?: boolean;
  /** Soft wash under the line, down to the floor of the plot. */
  readonly gradient?: boolean;
  /** One label per point; a handful are drawn on the x axis. */
  readonly xLabels?: readonly string[];
  readonly label: string;
}) {
  const gid = `line-${useId().replace(/:/g, '')}`;
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const labelled = xLabels !== undefined && xLabels.length === points.length && points.length > 0;
  const pad = { l: 52, r: 16, t: 12, b: labelled ? 36 : 22 };
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
  const floor = gradient || baseline === undefined ? height - pad.b : geo.y(baseline);
  const area = `${d}L${geo.x(points.length - 1)},${floor}L${geo.x(0)},${floor}Z`;
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((fx - pad.l) / (W - pad.l - pad.r)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const hp = hover === null ? null : points[hover]!;
  return (
    <div className="relative" dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        role="img"
        aria-label={label}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {gradient ? (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.38" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
        ) : null}
        {geo.ticks.map((t, _i, ticks) => (
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
              {tickLabel(t, ticks)}
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
        {fill ? (
          <path d={area} fill={gradient ? `url(#${gid})` : color} opacity={gradient ? 1 : 0.12} />
        ) : null}
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {labelled && xLabels
          ? labelIndexes(points.length).map((i) => (
              <text
                key={i}
                x={geo.x(i)}
                y={height - 8}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                fontSize={10.5}
                fill={CHART.text}
              >
                {xLabels[i] ?? ''}
              </text>
            ))
          : null}
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
    <div className="relative" dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        role="img"
        aria-label={label}
        onMouseLeave={() => setTip(null)}
      >
        {niceTicks(lo, hi).map((t, _i, ticks) => (
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
              {tickLabel(t, ticks)}
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

/** Evenly spaced indexes, always including the first and last point. */
function labelIndexes(count: number, max = 5): number[] {
  if (count <= 1) return count === 1 ? [0] : [];
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const out = new Set<number>();
  for (let i = 0; i < max; i++) out.add(Math.round((i * (count - 1)) / (max - 1)));
  return [...out].sort((a, b) => a - b);
}

/** Win / loss ring. A full track shows when every part is zero. */
export function DonutChart({
  parts,
  center,
  caption,
  label,
}: {
  readonly parts: readonly { value: number; color: string }[];
  readonly center: string;
  readonly caption: string;
  readonly label: string;
}) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  const cx = 100;
  const cy = 100;
  const r = 68;
  const width = 18;
  const circ = 2 * Math.PI * r;
  const active = parts.filter((part) => part.value > 0);
  const gap = active.length > 1 ? 0.016 : 0;
  const slices: ReactNode[] = [];
  let cursor = 0;
  if (total > 0) {
    parts.forEach((part, i) => {
      if (part.value <= 0) return;
      const frac = part.value / total;
      const len = Math.max(0, frac - gap) * circ;
      slices.push(
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={part.color}
          strokeWidth={width}
          strokeDasharray={`${len} ${circ - len}`}
          strokeDashoffset={-cursor * circ}
        />,
      );
      cursor += frac;
    });
  }
  return (
    <div className="relative mx-auto w-[188px]" dir="ltr">
      <svg viewBox="0 0 200 200" className="w-full" role="img" aria-label={label}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={width}
        />
        <g transform={`rotate(-90 ${cx} ${cy})`}>{slices}</g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] text-muted">{caption}</span>
        <span className="mt-1 text-[22px] font-semibold tabular-nums leading-none">{center}</span>
      </div>
    </div>
  );
}

/** Four-to-n axis spider. Values at or below zero sit at the centre; the legend keeps the sign. */
export function RadarChart({
  axes,
  color = '#4c8dff',
  label,
  format,
  ceiling,
}: {
  readonly axes: readonly { label: string; value: number }[];
  readonly color?: string;
  readonly label: string;
  readonly format: (value: number) => string;
  readonly ceiling?: number;
}) {
  const n = Math.max(axes.length, 1);
  const cx = 120;
  const cy = 108;
  const radius = 64;
  const plotted = axes.map((axis) => Math.max(0, axis.value));
  const cap = ceiling ?? Math.max(...plotted, 0);
  const at = (i: number, mag: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(ang) * radius * mag, cy + Math.sin(ang) * radius * mag] as const;
  };
  const ring = (mag: number) =>
    axes
      .map((_, i) =>
        at(i, mag)
          .map((v) => v.toFixed(1))
          .join(','),
      )
      .join(' ');
  const hasShape = cap > 0 && plotted.some((value) => value > 0);
  const poly = hasShape
    ? axes.map((_, i) => at(i, Math.min(1, plotted[i]! / cap)).join(',')).join(' ')
    : '';
  return (
    <div dir="ltr">
      <svg viewBox="0 0 240 216" className="w-full" role="img" aria-label={label}>
        {[0.34, 0.67, 1].map((mag) => (
          <polygon
            key={mag}
            points={ring(mag)}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = at(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          );
        })}
        {hasShape ? (
          <polygon points={poly} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2} />
        ) : null}
        {axes.map((axis, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const x = cx + Math.cos(ang) * (radius + 20);
          const y = cy + Math.sin(ang) * (radius + 16);
          const cos = Math.cos(ang);
          const anchor = cos > 0.4 ? 'start' : cos < -0.4 ? 'end' : 'middle';
          return (
            <text
              key={axis.label}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={11}
              fill={CHART.text}
            >
              {axis.label}
            </text>
          );
        })}
      </svg>
      <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
        {axes.map((axis) => (
          <li key={axis.label} className="flex items-center justify-between gap-2">
            <span className="text-muted">{axis.label}</span>
            <span className="tabular-nums text-fg">{format(axis.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars around zero (weekday and month P&L). */
export function HBars({
  rows,
  label,
  format,
}: {
  readonly rows: readonly { label: string; value: number; tip: string }[];
  readonly label: string;
  readonly format: (value: number) => string;
}) {
  const max = Math.max(1e-9, ...rows.map((row) => Math.abs(row.value)));
  return (
    <div className="flex flex-col gap-2.5" role="img" aria-label={label}>
      {rows.map((row) => {
        const span = (Math.abs(row.value) / max) * 50;
        const positive = row.value >= 0;
        const tone =
          row.value > 0.004 ? 'text-up' : row.value < -0.004 ? 'text-down' : 'text-muted';
        return (
          <div
            key={row.label}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: 'minmax(4.75rem, auto) 1fr auto' }}
            title={row.tip}
          >
            <span className="text-[12.5px] text-muted">{row.label}</span>
            <div className="relative h-2 rounded-full bg-white/5" dir="ltr">
              <span className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
              <span
                className="absolute top-0 h-full rounded-full"
                style={{
                  width: `${span}%`,
                  left: positive ? '50%' : `${50 - span}%`,
                  background: positive ? 'var(--tc-up)' : 'var(--tc-down)',
                }}
              />
            </div>
            <span className={`min-w-16 text-end text-[12px] tabular-nums ${tone}`}>
              {format(row.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ height }: { readonly height: number }) {
  return (
    <div className="flex items-center justify-center text-[12.5px] text-muted" style={{ height }}>
      هنوز معامله‌ای نیست
    </div>
  );
}
