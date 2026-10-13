import { describe, expect, it } from 'vitest';
import {
  CommandHistory,
  createIdGenerator,
  createRng,
  type ChartPointerEvent,
  type InteractionHandler,
} from '@/lib/core';
import { DrawingManager, drawingRegistry } from '@/lib/drawings';
import { T0, STEP, at } from '../helpers/fake-context';
import { fakeEngine } from '../helpers/fake-engine';

type Extent = { min: number; max: number } | null;

function setup() {
  const engine = fakeEngine();
  let handler: InteractionHandler | undefined;
  let contributor: ((from: number, to: number) => Extent) | undefined;
  engine.addInteractionHandler = (h) => {
    handler = h;
    return () => undefined;
  };
  engine.addPriceRangeContributor = (fn) => {
    contributor = fn;
    return () => undefined;
  };
  const manager = new DrawingManager(
    engine,
    new CommandHistory(),
    drawingRegistry,
    createIdGenerator(createRng(1)),
  );
  const extent = (from = 0, to = T0 + 500 * STEP) => contributor!(from, to);
  return { manager, handler: () => handler!, extent };
}

function pointer(x: number, y: number): ChartPointerEvent {
  const p = at(x, y);
  return {
    x,
    y,
    clientX: x,
    clientY: y,
    region: 'price-pane',
    pointerType: 'mouse',
    button: 0,
    shift: false,
    ctrl: false,
    alt: false,
    index: x / 10,
    time: p.time,
    price: p.price,
  };
}

describe('drawing placement', () => {
  it('returns to the cursor after a drawing is placed', () => {
    const { manager, handler } = setup();
    manager.setTool('trend-line');
    const h = handler();
    h.onPointerDown?.(pointer(100, 200));
    h.onPointerUp?.(pointer(100, 200));
    h.onPointerDown?.(pointer(400, 100));
    expect(manager.store.size).toBe(1);
    expect(manager.tool).toBeNull();
  });

  it('keeps the tool when stay-in-drawing-mode is on', () => {
    const { manager, handler } = setup();
    manager.setModes({ stayInDrawingMode: true });
    manager.setTool('rectangle');
    const h = handler();
    h.onPointerDown?.(pointer(80, 180));
    h.onPointerUp?.(pointer(220, 80));
    expect(manager.store.size).toBe(1);
    expect(manager.tool).toBe('rectangle');
  });
});

describe('drawing price extent while editing', () => {
  it('keeps the settled price extent while a drawing is held, so auto-scale does not jump', () => {
    const { manager, handler, extent } = setup();
    const drawing = manager.createDrawing('trend-line', [
      { time: T0 + 10 * STEP, price: 400 },
      { time: T0 + 40 * STEP, price: 450 },
    ])!;
    manager.add([drawing]);
    const settled = extent();
    expect(settled).toEqual({ min: 400, max: 450 });

    // Press on the line. The frame built during the press must not drop the drawing.
    handler().onPointerDown?.(pointer(250, -250));
    expect(manager.selected?.id).toBe(drawing.id);
    expect(extent()).toEqual(settled);

    drawing.points = [
      { time: T0 + 10 * STEP, price: 900 },
      { time: T0 + 40 * STEP, price: 950 },
    ];
    expect(extent()).toEqual(settled);

    handler().onPointerUp?.(pointer(250, -250));
    expect(extent()).toEqual({ min: 900, max: 950 });
  });
});
