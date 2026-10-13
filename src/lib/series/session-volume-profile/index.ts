import type { FrameState, SeriesData, SeriesDefinition } from '@/lib/core';
import { renderCandles } from '../candlestick/candlestick-renderer';
import { cssTransform } from '../shared/draw';
import { valueArea } from '../shared/profile';
import { sessionsInRange, type Session } from '../shared/sessions';

interface SessionProfile {
  readonly low: number;
  readonly step: number;
  readonly up: Float64Array;
  readonly down: Float64Array;
  readonly totals: Float64Array;
  readonly maxTotal: number;
}

/** Volume at price over a session: each bar's volume spread evenly over its high–low range. */
function sessionProfile(d: SeriesData, s: Session, rows: number): SessionProfile | null {
  let low = Infinity;
  let high = -Infinity;
  for (let i = s.from; i <= s.to; i++) {
    low = Math.min(low, d.low[i]!);
    high = Math.max(high, d.high[i]!);
  }
  if (!Number.isFinite(low)) return null;
  if (high <= low) high = low + Math.abs(low) * 1e-6 + 1e-9;
  const n = Math.max(1, Math.round(rows));
  const step = (high - low) / n;
  const up = new Float64Array(n);
  const down = new Float64Array(n);
  for (let i = s.from; i <= s.to; i++) {
    const vol = d.volume[i]!;
    if (!(vol > 0)) continue;
    const lo = d.low[i]!;
    const hi = d.high[i]!;
    const side = d.close[i]! >= d.open[i]! ? up : down;
    const r0 = Math.min(n - 1, Math.max(0, Math.floor((lo - low) / step)));
    const r1 = Math.min(n - 1, Math.max(0, Math.floor((hi - low) / step)));
    if (hi <= lo || r0 === r1) {
      side[r0]! += vol;
      continue;
    }
    for (let r = r0; r <= r1; r++) {
      const rowLo = low + r * step;
      const overlap = Math.min(hi, rowLo + step) - Math.max(lo, rowLo);
      if (overlap > 0) side[r]! += (vol * overlap) / (hi - lo);
    }
  }
  const totals = new Float64Array(n);
  let maxTotal = 0;
  for (let r = 0; r < n; r++) {
    totals[r] = up[r]! + down[r]!;
    maxTotal = Math.max(maxTotal, totals[r]!);
  }
  return { low, step, up, down, totals, maxTotal };
}

/**
 * Candles with a volume profile per session drawn over the session's bars: up/down volume
 * per row, the value area in stronger colours and the point of control as a line.
 */
function renderSessionVolumeProfile(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const d = f.series;
  if (d.length === 0) return;
  renderCandles(ctx, f);
  cssTransform(ctx, f);
  const o = f.options;
  const slot = f.timeScale.barSpacing;
  for (const s of sessionsInRange(d, f.visible.from, f.visible.to, f.timeframe)) {
    const p = sessionProfile(d, s, o.svpRows);
    if (!p || p.maxTotal <= 0) continue;
    const va = valueArea(p.totals, o.svpValueArea);
    const x0 = f.timeScale.indexToX(s.from) - slot / 2;
    const x1 = f.timeScale.indexToX(s.to) + slot / 2;
    const maxW = ((x1 - x0) * o.svpWidth) / 100;
    const right = o.svpPlacement === 'right';
    for (let r = 0; r < p.totals.length; r++) {
      const total = p.totals[r]!;
      if (total <= 0) continue;
      const yTop = f.priceScale.priceToY(p.low + (r + 1) * p.step);
      const yBot = f.priceScale.priceToY(p.low + r * p.step);
      const top = Math.min(yTop, yBot);
      const h = Math.abs(yBot - yTop);
      const gap = h > 3 ? 1 : 0;
      const w = (total / p.maxTotal) * maxW;
      const upW = (p.up[r]! / total) * w;
      const inVa = r >= va.low && r <= va.high;
      ctx.fillStyle = inVa ? o.svpVaUpColor : o.svpUpColor;
      ctx.fillRect(right ? x1 - upW : x0, top + gap / 2, upW, Math.max(0.5, h - gap));
      ctx.fillStyle = inVa ? o.svpVaDownColor : o.svpDownColor;
      ctx.fillRect(right ? x1 - w : x0 + upW, top + gap / 2, w - upW, Math.max(0.5, h - gap));
    }
    if (o.svpShowPoc) {
      const y = f.priceScale.priceToY(p.low + (va.poc + 0.5) * p.step);
      ctx.strokeStyle = o.svpPocColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }
  }
}

export const sessionVolumeProfileSeries: SeriesDefinition = {
  id: 'session-volume-profile',
  label: 'Session volume profile',
  group: 'profile',
  icon: 'M4 3v18M4 5h8M4 9h12M4 13h16M4 17h10M4 21h5',
  create: (ctx) => ({
    id: 'series.session-volume-profile',
    zIndex: 10,
    render: renderSessionVolumeProfile,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
