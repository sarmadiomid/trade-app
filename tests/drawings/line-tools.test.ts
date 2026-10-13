import { describe, expect, it } from 'vitest';
import { SeriesData, type Candle } from '@/lib/core';
import { PlacementSession, drawingRegistry, toPixel, type ChartPoint } from '@/lib/drawings';
import { computeVolumeProfile } from '@/lib/drawings/tools/volume-profile';
import { at, fakeContext, mockCanvas } from '../helpers/fake-context';

const dc = fakeContext();
const create = (type: string, points: ChartPoint[]) => {
  const def = drawingRegistry.require(type);
  return def.create({ id: 'x', points, style: { ...def.defaults } });
};

describe('Horizontal line / ray', () => {
  it('spans the whole pane (line) or from the anchor to the right (ray)', () => {
    const line = create('horizontal-line', [at(500, 300)]);
    expect(line.hitTest(20, 301, dc)?.part).toBe('body');
    expect(line.hitTest(1900, 299, dc)?.part).toBe('body');
    expect(line.hitTest(500, 340, dc)).toBeNull();
    const ray = create('horizontal-ray', [at(500, 300)]);
    expect(ray.hitTest(20, 300, dc)).toBeNull();
    expect(ray.hitTest(1900, 300, dc)?.part).toBe('body');
  });

  it('shows a price label on the axis unless disabled', () => {
    const line = create('horizontal-line', [at(500, 300)]);
    expect(line.axisLabels?.(dc)?.prices?.[0]?.price).toBeCloseTo(150, 6);
    line.style = { ...line.style, showPrice: false };
    expect(line.axisLabels?.(dc)).toBeNull();
  });

  it('places with a single click', () => {
    const def = drawingRegistry.require('horizontal-line');
    const s = new PlacementSession(def, 'h', { ...def.defaults }, at(500, 300), () => dc);
    expect(s.immediate).toBe(true);
    expect(s.finish().points).toHaveLength(1);
  });
});

describe('Vertical / cross line', () => {
  it('vertical line spans the pane height and labels the time axis', () => {
    const v = create('vertical-line', [at(500, 300)]);
    expect(v.hitTest(501, 5, dc)?.part).toBe('body');
    expect(v.hitTest(501, 595, dc)?.part).toBe('body');
    expect(v.hitTest(540, 300, dc)).toBeNull();
    expect(v.axisLabels?.(dc)?.times?.[0]?.time).toBe(at(500, 300).time);
    expect(v.priceRange?.()).toBeNull();
  });

  it('cross line hits on both lines and labels both axes', () => {
    const c = create('cross-line', [at(500, 300)]);
    expect(c.hitTest(10, 300, dc)?.part).toBe('body');
    expect(c.hitTest(500, 10, dc)?.part).toBe('body');
    expect(c.hitTest(700, 100, dc)).toBeNull();
    const labels = c.axisLabels?.(dc);
    expect(labels?.prices).toHaveLength(1);
    expect(labels?.times).toHaveLength(1);
  });
});

describe('Ray / extended line', () => {
  it('ray extends past its second point only', () => {
    const r = create('ray', [at(300, 300), at(500, 300)]);
    expect(r.hitTest(1500, 300, dc)?.part).toBe('body');
    expect(r.hitTest(100, 300, dc)).toBeNull();
  });

  it('extended line extends both ways', () => {
    const e = create('extended-line', [at(300, 300), at(500, 300)]);
    expect(e.hitTest(1500, 300, dc)?.part).toBe('body');
    expect(e.hitTest(50, 300, dc)?.part).toBe('body');
  });
});

describe('Parallel channel', () => {
  const def = drawingRegistry.require('parallel-channel');

  it('third click sets the channel width; the parallel line starts at the first time', () => {
    const pts = def.finalizePoints!([at(100, 300), at(500, 100), at(300, 300)], dc);
    expect(pts).toHaveLength(3);
    expect(pts[2]!.time).toBe(pts[0]!.time);
    // Base line at x=300 is y=200 → click 100px below → C is 100px below A.
    expect(toPixel(pts[2]!, dc).y).toBeCloseTo(400, 6);
  });

  it('has six handles and moves the parallel line via its middle handle', () => {
    const d = create('parallel-channel', def.finalizePoints!([at(100, 300), at(500, 100), at(300, 300)], dc));
    const anchors = d.getAnchors(dc);
    expect(anchors).toHaveLength(6);
    const m2 = anchors.find((a) => a.index === 5)!;
    d.moveAnchor(5, at(m2.x, m2.y + 50), dc, { shift: false });
    expect(toPixel(d.points[2]!, dc).y).toBeCloseTo(450, 6);
    expect(toPixel(d.points[0]!, dc).y).toBeCloseTo(300, 6);
  });

  it('moving a base corner keeps the channel width', () => {
    const d = create('parallel-channel', def.finalizePoints!([at(100, 300), at(500, 100), at(300, 300)], dc));
    d.moveAnchor(0, at(150, 250), dc, { shift: false });
    const a = toPixel(d.points[0]!, dc);
    const c = toPixel(d.points[2]!, dc);
    expect(c.y - a.y).toBeCloseTo(100, 6);
    expect(d.points[2]!.time).toBe(d.points[0]!.time);
  });

  it('hits inside the background', () => {
    const d = create('parallel-channel', def.finalizePoints!([at(100, 300), at(500, 100), at(300, 300)], dc));
    expect(d.hitTest(300, 250, dc)?.part).toBe('body');
  });
});

describe('Fib retracement', () => {
  it('places level 0 at the end point and 1 at the start (TradingView convention)', () => {
    const d = create('fib-retracement', [at(300, 400), at(700, 200)]) as unknown as {
      levels(): Array<{ value: number; price: number }>;
    };
    const levels = d.levels();
    const p = (v: number) => levels.find((l) => l.value === v)!.price;
    expect(p(0)).toBeCloseTo(200, 6);
    expect(p(1)).toBeCloseTo(100, 6);
    expect(p(0.5)).toBeCloseTo(150, 6);
    expect(p(0.618)).toBeCloseTo(200 - 0.618 * 100, 6);
    expect(levels.map((l) => l.value)).toEqual([0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236]);
  });

  it('reverse swaps the direction; hidden levels are skipped', () => {
    const def = drawingRegistry.require('fib-retracement');
    const d = def.create({
      id: 'f',
      points: [at(300, 400), at(700, 200)],
      style: { ...def.defaults, reverse: true, level1On: false },
    }) as unknown as { levels(): Array<{ value: number; price: number }> };
    const levels = d.levels();
    expect(levels.find((l) => l.value === 0)!.price).toBeCloseTo(100, 6);
    expect(levels.some((l) => l.value === 0.236)).toBe(false);
  });

  it('hits level lines within the anchors span only', () => {
    const d = create('fib-retracement', [at(300, 400), at(700, 200)]);
    const y382 = 600 - (200 - 0.382 * 100) * 2;
    expect(d.hitTest(500, y382, dc)?.part).toBe('body');
    expect(d.hitTest(900, y382, dc)).toBeNull();
    expect(() => d.render(mockCanvas(), dc, { hovered: true, selected: true, placing: false })).not.toThrow();
  });
});

describe('Fixed range volume profile', () => {
  const bar = (time: number, o: number, h: number, l: number, c: number, v: number): Candle => ({
    time,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v,
  });

  it('distributes volume over rows, splits up/down and finds POC and value area', () => {
    const data = SeriesData.fromCandles([
      bar(0, 10, 11, 10, 11, 100), // up, rows 10..11
      bar(1, 11, 11, 10, 10, 50), // down, rows 10..11
      bar(2, 12, 14, 12, 13, 10), // up, rows 12..14
    ]);
    const p = computeVolumeProfile(data, 0, 2, 4, 70)!;
    expect(p.low).toBe(10);
    expect(p.high).toBe(14);
    expect(p.up.reduce((a, b) => a + b, 0) + p.down.reduce((a, b) => a + b, 0)).toBeCloseTo(160, 6);
    expect(p.poc).toBe(0);
    expect(p.down[0]).toBeCloseTo(50, 6);
    expect(p.vaLow).toBe(0);
    expect(p.vaHigh).toBe(0);
  });

  it('expands the value area until it holds the requested share', () => {
    const data = SeriesData.fromCandles(
      Array.from({ length: 10 }, (_, i) => bar(i, i, i + 1, i, i + 1, 10)),
    );
    const p = computeVolumeProfile(data, 0, 9, 10, 70)!;
    const inArea = p.up.slice(p.vaLow, p.vaHigh + 1).reduce((a, b) => a + b, 0);
    expect(inArea / p.totalVolume).toBeGreaterThanOrEqual(0.7);
  });

  it('takes its range from the two anchors (either order)', () => {
    const d = create('fixed-range-volume-profile', [at(700, 200), at(300, 400)]) as unknown as {
      profile(c: typeof dc): { totalVolume: number } | null;
    };
    // Bars 30..70 inclusive, volume 10 each.
    expect(d.profile(dc)!.totalVolume).toBeCloseTo(410, 6);
  });
});
