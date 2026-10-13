import {
  MINUTE_MS,
  fontString,
  withOpacity,
  type FrameState,
  type SeriesDefinition,
} from '@/lib/core';
import { clipPricePane, cssTransform } from '../shared/draw';
import { autoRowSize, rowOf, valueArea } from '../shared/profile';
import { sessionsInRange } from '../shared/sessions';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const VALUE_AREA_COLOR = '#2962ff';
const POC_COLOR = '#f23645';
const INITIAL_BALANCE_COLOR = '#f7a600';
/** Periods forming the initial balance (the first hour with 30-minute periods). */
const INITIAL_BALANCE_PERIODS = 2;

/**
 * Time Price Opportunity (market profile): each session is drawn over its own bars as a
 * profile of letters, one letter per period (30 min by default) at every price row the
 * period traded. Rows inside the value area are highlighted, the point of control and the
 * initial balance are marked, and the session open/close are ticked on the profile's edges.
 */
function renderTpo(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const d = f.series;
  if (d.length === 0) return;
  clipPricePane(ctx, f);
  cssTransform(ctx, f);
  const o = f.options;
  const c = f.theme.colors;
  const tf = f.timeframe;
  const periodMs = tf.dateOnly ? tf.ms : Math.max(tf.ms, o.tpoPeriod * MINUTE_MS);
  const barsPerPeriod = Math.max(1, periodMs / tf.ms);
  const step = autoRowSize(d, o.tpoTicksPerRow, f.symbol.tickSize, 4 / Math.sqrt(barsPerPeriod));
  const ref = d.close[d.length - 1]!;
  const rowPx = Math.abs(f.priceScale.priceToY(ref) - f.priceScale.priceToY(ref + step));
  const outside = f.theme.dark ? '#787b86' : '#9598a1';
  const fontPx = Math.max(7, Math.min(12, Math.floor(rowPx)));
  ctx.font = fontString(fontPx);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const slot = f.timeScale.barSpacing;
  for (const s of sessionsInRange(d, f.visible.from, f.visible.to, tf)) {
    let rowLo = Infinity;
    let rowHi = -Infinity;
    const periodLo = new Map<number, number>();
    const periodHi = new Map<number, number>();
    for (let i = s.from; i <= s.to; i++) {
      const p = tf.dateOnly ? i - s.from : Math.floor((d.time[i]! - s.start) / periodMs);
      const lo = rowOf(d.low[i]!, step);
      const hi = Math.max(lo, rowOf(d.high[i]! - step * 1e-6, step));
      periodLo.set(p, Math.min(periodLo.get(p) ?? Infinity, lo));
      periodHi.set(p, Math.max(periodHi.get(p) ?? -Infinity, hi));
      rowLo = Math.min(rowLo, lo);
      rowHi = Math.max(rowHi, hi);
    }
    if (!Number.isFinite(rowLo)) continue;
    const rows = rowHi - rowLo + 1;
    const letters: number[][] = Array.from({ length: rows }, () => []);
    const periods = [...periodLo.keys()].sort((a, b) => a - b);
    for (const p of periods) {
      for (let r = periodLo.get(p)!; r <= periodHi.get(p)!; r++) letters[r - rowLo]!.push(p);
    }
    const counts = letters.map((l) => l.length);
    const maxCount = Math.max(...counts);
    const va = valueArea(counts, o.tpoValueArea);
    const x0 = f.timeScale.indexToX(s.from) - slot / 2;
    const width = (s.to - s.from + 1) * slot;
    const cell = Math.max(0.5, Math.min(fontPx * 0.8, (width - 2) / maxCount));
    const useLetters = o.tpoMode === 'letters' && cell >= 6 && rowPx >= 7;
    const left = x0 + 3;
    for (let r = 0; r < rows; r++) {
      const yTop = f.priceScale.priceToY((rowLo + r + 1) * step);
      const yBot = f.priceScale.priceToY((rowLo + r) * step);
      const top = Math.min(yTop, yBot);
      const h = Math.abs(yBot - yTop);
      const inVa = o.tpoShowValueArea && r >= va.low && r <= va.high;
      const color = o.tpoShowPoc && r === va.poc ? POC_COLOR : inVa ? VALUE_AREA_COLOR : outside;
      ctx.fillStyle = useLetters ? color : withOpacity(color, inVa || r === va.poc ? 0.85 : 0.6);
      const row = letters[r]!;
      const blockW = Math.max(0.5, cell - (cell > 3 ? 1 : 0));
      const blockTop = top + (h > 3 ? 0.5 : 0);
      const blockH = Math.max(0.5, h - (h > 3 ? 1 : 0));
      for (let k = 0; k < row.length; k++) {
        const x = left + k * cell;
        if (useLetters) ctx.fillText(LETTERS[row[k]! % LETTERS.length]!, x + cell / 2, top + h / 2);
        else ctx.fillRect(x, blockTop, blockW, blockH);
      }
    }
    const rowY = (r: number) => f.priceScale.priceToY((rowLo + r + 0.5) * step);
    ctx.setLineDash([]);
    if (o.tpoShowPoc) {
      ctx.strokeStyle = POC_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, rowY(va.poc));
      ctx.lineTo(x0 + width - 1, rowY(va.poc));
      ctx.stroke();
    }
    if (o.tpoShowInitialBalance) {
      let ibLo = Infinity;
      let ibHi = -Infinity;
      for (const p of periods.slice(0, INITIAL_BALANCE_PERIODS)) {
        ibLo = Math.min(ibLo, periodLo.get(p)!);
        ibHi = Math.max(ibHi, periodHi.get(p)!);
      }
      if (Number.isFinite(ibLo)) {
        const yA = f.priceScale.priceToY((ibHi + 1) * step);
        const yB = f.priceScale.priceToY(ibLo * step);
        ctx.fillStyle = INITIAL_BALANCE_COLOR;
        ctx.fillRect(x0 + 0.5, Math.min(yA, yB), 2, Math.abs(yB - yA));
      }
    }
    ctx.strokeStyle = c.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const yOpen = f.priceScale.priceToY(d.open[s.from]!);
    ctx.moveTo(x0 - 2, yOpen);
    ctx.lineTo(x0 + 3, yOpen);
    const yClose = f.priceScale.priceToY(d.close[s.to]!);
    const closeRow = Math.min(rows - 1, Math.max(0, rowOf(d.close[s.to]!, step) - rowLo));
    const xEnd = left + counts[closeRow]! * cell;
    ctx.moveTo(Math.min(x0 + width, xEnd + 1), yClose);
    ctx.lineTo(Math.min(x0 + width, xEnd + 1) + 5, yClose);
    ctx.stroke();
  }
}

export const tpoSeries: SeriesDefinition = {
  id: 'tpo',
  label: 'Time price opportunity',
  group: 'profile',
  icon: 'M4 4h3M4 8h6M4 12h9M4 16h5M4 20h2M14 4v16',
  create: (ctx) => ({
    id: 'series.tpo',
    zIndex: 10,
    render: renderTpo,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
