import { formatNumber } from '@/lib/core';
import { pnl } from '../execution/math';
import type { AccountConfig, AccountState, PendingOrder, Position } from '../execution/types';

export type LineKind = 'entry' | 'order' | 'sl' | 'tp';

/** One horizontal trade line on the chart. */
export interface TradeLine {
  /** `${ownerId}:${kind}` */
  readonly key: string;
  readonly ownerId: string;
  readonly owner: 'position' | 'order';
  readonly kind: LineKind;
  readonly price: number;
  readonly color: string;
  readonly dashed: boolean;
  readonly text: string;
  /** Can be dragged vertically. */
  readonly draggable: boolean;
  /** Shows a ✕ (close position / cancel order / remove level). */
  readonly closable: boolean;
  /** Ghost buttons on the entry label for missing levels. */
  readonly ghosts: ReadonlyArray<'sl' | 'tp'>;
}

export const TRADE_COLORS = {
  buy: '#2962ff',
  sell: '#f23645',
  sl: '#ff9800',
  tp: '#22ab94',
} as const;

/** A level being dragged: overrides the stored price while the gesture lasts. */
export interface DragOverride {
  readonly ownerId: string;
  readonly kind: LineKind;
  readonly price: number;
}

const money = (v: number) => `${v >= 0 ? '+' : '−'}$${formatNumber(Math.abs(v), 2)}`;
const pct = (v: number, base: number) =>
  `${v >= 0 ? '+' : '−'}${Math.abs((v / base) * 100).toFixed(2)}%`;

function levelText(
  cfg: AccountConfig,
  label: 'SL' | 'TP',
  side: Position['side'],
  entry: number,
  price: number,
  volume: number,
  balance: number,
): string {
  const v = pnl(cfg, side, entry, price, volume);
  return `${label}  ${money(v)} (${pct(v, balance)})`;
}

/**
 * Lines for every open position and pending order, with live P&L texts. A drag override
 * replaces one level (and moves an order's brackets with it) so the label updates live.
 */
export function buildTradeLines(
  cfg: AccountConfig,
  s: AccountState,
  floating: (p: Position) => number,
  precision: number,
  drag: DragOverride | null,
): TradeLine[] {
  const out: TradeLine[] = [];
  const over = (id: string, kind: LineKind, price: number | null) =>
    drag && drag.ownerId === id && drag.kind === kind ? drag.price : price;

  for (const p of s.positions) {
    const color = TRADE_COLORS[p.side];
    const f = floating(p);
    const sl = over(p.id, 'sl', p.sl);
    const tp = over(p.id, 'tp', p.tp);
    out.push({
      key: `${p.id}:entry`,
      ownerId: p.id,
      owner: 'position',
      kind: 'entry',
      price: p.entryPrice,
      color,
      dashed: false,
      text: `${p.side === 'buy' ? 'BUY' : 'SELL'} ${p.volume.toFixed(2)}  ${money(f)}`,
      draggable: false,
      closable: true,
      ghosts: [
        ...(sl === null ? (['sl'] as const) : []),
        ...(tp === null ? (['tp'] as const) : []),
      ],
    });
    if (sl !== null)
      out.push(
        level(
          p.id,
          'position',
          'sl',
          sl,
          levelText(cfg, 'SL', p.side, p.entryPrice, sl, p.volume, s.balance),
        ),
      );
    if (tp !== null)
      out.push(
        level(
          p.id,
          'position',
          'tp',
          tp,
          levelText(cfg, 'TP', p.side, p.entryPrice, tp, p.volume, s.balance),
        ),
      );
  }

  for (const o of s.orders) out.push(...orderLines(cfg, o, s.balance, precision, drag));
  return out;
}

function orderLines(
  cfg: AccountConfig,
  o: PendingOrder,
  balance: number,
  precision: number,
  drag: DragOverride | null,
): TradeLine[] {
  const moved = drag && drag.ownerId === o.id && drag.kind === 'order' ? drag.price - o.price : 0;
  const price = o.price + moved;
  const pick = (kind: 'sl' | 'tp', v: number | null) =>
    drag && drag.ownerId === o.id && drag.kind === kind
      ? drag.price
      : v === null
        ? null
        : v + moved;
  const sl = pick('sl', o.sl);
  const tp = pick('tp', o.tp);
  const name = `${o.side === 'buy' ? 'BUY' : 'SELL'} ${o.kind === 'limit' ? 'LIMIT' : 'STOP'}`;
  const out: TradeLine[] = [
    {
      key: `${o.id}:order`,
      ownerId: o.id,
      owner: 'order',
      kind: 'order',
      price,
      color: TRADE_COLORS[o.side],
      dashed: true,
      text: `${name} ${o.volume.toFixed(2)} @ ${price.toFixed(precision)}`,
      draggable: true,
      closable: true,
      ghosts: [
        ...(sl === null ? (['sl'] as const) : []),
        ...(tp === null ? (['tp'] as const) : []),
      ],
    },
  ];
  if (sl !== null)
    out.push(
      level(o.id, 'order', 'sl', sl, levelText(cfg, 'SL', o.side, price, sl, o.volume, balance)),
    );
  if (tp !== null)
    out.push(
      level(o.id, 'order', 'tp', tp, levelText(cfg, 'TP', o.side, price, tp, o.volume, balance)),
    );
  return out;
}

function level(
  ownerId: string,
  owner: TradeLine['owner'],
  kind: 'sl' | 'tp',
  price: number,
  text: string,
): TradeLine {
  return {
    key: `${ownerId}:${kind}`,
    ownerId,
    owner,
    kind,
    price,
    color: TRADE_COLORS[kind],
    dashed: owner === 'order',
    text,
    draggable: true,
    closable: true,
    ghosts: [],
  };
}
