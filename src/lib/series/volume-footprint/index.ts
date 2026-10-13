import {
  fontString,
  formatCompact,
  withOpacity,
  type FrameState,
  type SeriesData,
  type SeriesDefinition,
} from '@/lib/core';
import { renderCandles } from '../candlestick/candlestick-renderer';
import { clipPricePane, cssTransform } from '../shared/draw';
import { autoRowSize, barFootprint, valueArea } from '../shared/profile';

const IMBALANCE_RATIO = 3;
const VOLUME_COLOR = '#2962ff';
/** Below this bar width (css px) the footprint cannot show rows and plain candles are drawn. */
const MIN_FOOTPRINT_WIDTH = 10;

function compact(v: number): string {
  const abs = Math.abs(v);
  return formatCompact(v, abs >= 1000 ? 1 : abs >= 10 ? 0 : 2);
}

/**
 * Volume footprint: per bar, a slim candle on the left and the volume traded at each price
 * row on the right (sell × buy, total or delta). Row shading follows volume; the point of
 * control is outlined, the value area marked on the right edge, diagonal imbalances coloured.
 */
function renderFootprint(ctx: CanvasRenderingContext2D, f: FrameState, d: SeriesData): void {
  if (d.length === 0) return;
  const slot = f.timeScale.barSpacing;
  if (slot < MIN_FOOTPRINT_WIDTH) {
    renderCandles(ctx, f);
    return;
  }
  clipPricePane(ctx, f);
  cssTransform(ctx, f);
  const o = f.options;
  const c = f.theme.colors;
  const step = autoRowSize(d, o.footprintTicksPerRow, f.symbol.tickSize, 10);
  const ref = d.close[d.length - 1]!;
  const rowPx = Math.abs(f.priceScale.priceToY(ref) - f.priceScale.priceToY(ref + step));
  const fontPx = Math.max(7, Math.min(11, Math.floor(rowPx) - 2));
  const font = fontString(fontPx);
  const bold = fontString(fontPx, undefined, true);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = font;
  for (let i = f.visible.from; i <= f.visible.to; i++) {
    const fp = barFootprint(d, i, step);
    const rows = fp.buy.length;
    const totals = new Float64Array(rows);
    let maxTotal = 0;
    let maxDelta = 0;
    let delta = 0;
    for (let r = 0; r < rows; r++) {
      totals[r] = fp.buy[r]! + fp.sell[r]!;
      maxTotal = Math.max(maxTotal, totals[r]!);
      maxDelta = Math.max(maxDelta, Math.abs(fp.buy[r]! - fp.sell[r]!));
      delta += fp.buy[r]! - fp.sell[r]!;
    }
    const va = valueArea(totals, o.footprintValueArea);
    const x = f.timeScale.indexToX(i);
    const left = x - slot / 2;
    const stripW = Math.max(1, Math.min(6, slot * 0.1));
    const boxL = left + stripW + 3;
    const boxW = Math.max(1, slot - stripW - 5);
    const up = d.close[i]! >= d.open[i]!;
    const sx = left + 1 + stripW / 2;
    ctx.fillStyle = up ? c.upWick : c.downWick;
    const yh = f.priceScale.priceToY(d.high[i]!);
    const yl = f.priceScale.priceToY(d.low[i]!);
    ctx.fillRect(sx - 0.5, yh, 1, Math.max(1, yl - yh));
    const yo = f.priceScale.priceToY(d.open[i]!);
    const yc = f.priceScale.priceToY(d.close[i]!);
    ctx.fillStyle = up ? c.upBody : c.downBody;
    ctx.fillRect(left + 1, Math.min(yo, yc), stripW, Math.max(1, Math.abs(yc - yo)));
    for (let r = 0; r < rows; r++) {
      const yTop = f.priceScale.priceToY((fp.row0 + r + 1) * step);
      const yBot = f.priceScale.priceToY((fp.row0 + r) * step);
      const top = Math.min(yTop, yBot);
      const h = Math.abs(yBot - yTop);
      const buy = fp.buy[r]!;
      const sell = fp.sell[r]!;
      const total = totals[r]!;
      const rowDelta = buy - sell;
      let fill: string;
      if (o.footprintType === 'volume')
        fill = withOpacity(VOLUME_COLOR, 0.12 + 0.6 * (maxTotal > 0 ? total / maxTotal : 0));
      else if (o.footprintType === 'delta')
        fill = withOpacity(
          rowDelta >= 0 ? c.upBody : c.downBody,
          0.12 + 0.6 * (maxDelta > 0 ? Math.abs(rowDelta) / maxDelta : 0),
        );
      else
        fill = withOpacity(
          rowDelta >= 0 ? c.upBody : c.downBody,
          0.12 + 0.55 * (maxTotal > 0 ? total / maxTotal : 0),
        );
      ctx.fillStyle = fill;
      ctx.fillRect(boxL, top + (h > 3 ? 0.5 : 0), boxW, Math.max(0.5, h - (h > 3 ? 1 : 0)));
      if (r === va.poc && h > 2) {
        ctx.strokeStyle = c.text;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(boxL + 0.5, top + 1, boxW - 1, Math.max(1, h - 2));
      }
      if (h < 8) continue;
      const cy = top + h / 2;
      if (o.footprintType === 'buySell') {
        const sellText = compact(sell);
        const buyText = compact(buy);
        const text = `${sellText} x ${buyText}`;
        if (ctx.measureText(text).width > boxW - 2) continue;
        const sellImb =
          o.footprintImbalance && r + 1 < rows && sell >= IMBALANCE_RATIO * fp.buy[r + 1]! && sell > 0;
        const buyImb =
          o.footprintImbalance && r > 0 && buy >= IMBALANCE_RATIO * fp.sell[r - 1]! && buy > 0;
        const mid = boxL + boxW / 2;
        const xw = ctx.measureText(' x ').width;
        ctx.fillStyle = c.text;
        ctx.fillText('x', mid, cy);
        ctx.textAlign = 'right';
        ctx.font = sellImb ? bold : font;
        ctx.fillStyle = sellImb ? c.downBody : c.text;
        ctx.fillText(sellText, mid - xw / 2, cy);
        ctx.textAlign = 'left';
        ctx.font = buyImb ? bold : font;
        ctx.fillStyle = buyImb ? c.upBody : c.text;
        ctx.fillText(buyText, mid + xw / 2, cy);
        ctx.textAlign = 'center';
        ctx.font = font;
      } else {
        const text = o.footprintType === 'volume' ? compact(total) : compact(rowDelta);
        if (ctx.measureText(text).width > boxW - 2) continue;
        ctx.fillStyle = c.text;
        ctx.fillText(text, boxL + boxW / 2, cy);
      }
    }
    const vaTop = f.priceScale.priceToY((fp.row0 + va.high + 1) * step);
    const vaBot = f.priceScale.priceToY((fp.row0 + va.low) * step);
    ctx.fillStyle = withOpacity(c.text, 0.6);
    ctx.fillRect(boxL + boxW + 0.5, Math.min(vaTop, vaBot), 1, Math.abs(vaBot - vaTop));
    const deltaText = `Δ ${compact(delta)}`;
    ctx.font = font;
    if (ctx.measureText(deltaText).width <= slot - 2) {
      const yBelow = Math.max(yl, f.priceScale.priceToY(fp.row0 * step)) + fontPx;
      ctx.fillStyle = delta >= 0 ? c.upBody : c.downBody;
      ctx.fillText(deltaText, boxL + boxW / 2, yBelow);
    }
  }
}

export const volumeFootprintSeries: SeriesDefinition = {
  id: 'volume-footprint',
  label: 'Volume footprint',
  group: 'profile',
  minBarSpacing: 64,
  icon: 'M6 3v18M4 6h2M4 17h2M10 5h10v3H10zM10 8h10v3H10zM10 11h10v3H10zM10 14h10v3H10z',
  create: (ctx) => ({
    id: 'series.volume-footprint',
    zIndex: 10,
    render: (c, f) => renderFootprint(c, f, f.series),
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
