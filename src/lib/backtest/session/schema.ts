import { z } from 'zod';
import { isTimeframeId, type TimeframeId } from '@/lib/core';
import type { BacktestSession } from './model';

const num = z.number().finite();
const nullableNum = num.nullable();
const side = z.enum(['buy', 'sell']);
const autoBE = z.object({ mode: z.enum(['pips', 'rr']), value: num }).nullable();
const exitReason = z.enum([
  'tp',
  'sl',
  'manual',
  'partial',
  'session-end',
  'stop-out',
  'rule-breach',
]);
const timeframe = z.string().refine(isTimeframeId) as unknown as z.ZodType<TimeframeId>;

const propRules = z.object({
  profitTargetPct: num,
  maxDailyLossPct: num,
  maxTotalLossPct: num,
});

const settings = z.object({
  name: z.string(),
  description: z.string(),
  strategyTag: z.string(),
  type: z.enum(['backtesting', 'prop']),
  symbol: z.string(),
  startingBalance: num,
  startDate: num,
  endDate: num,
  spreadEnabled: z.boolean(),
  spread: num,
  commissionEnabled: z.boolean(),
  commissionPerLot: num,
  propRules: propRules.nullable(),
});

const exit = z.object({
  time: num,
  price: num,
  volume: num,
  pnl: num,
  commission: num,
  reason: exitReason,
});

const position = z.object({
  id: z.string(),
  side,
  entryKind: z.enum(['market', 'limit', 'stop']),
  entryPrice: num,
  entryTime: num,
  initialVolume: num,
  volume: num,
  sl: nullableNum,
  tp: nullableNum,
  initialSl: nullableNum,
  initialTp: nullableNum,
  autoBE,
  breakEven: z.boolean(),
  commission: num,
  exits: z.array(exit),
  worstPrice: num,
  bestPrice: num,
});

const trade = position.extend({
  closeTime: num,
  closePrice: num,
  grossPnl: num,
  netPnl: num,
  closeReason: exitReason,
});

const order = z.object({
  id: z.string(),
  side,
  kind: z.enum(['limit', 'stop']),
  price: num,
  volume: num,
  sl: nullableNum,
  tp: nullableNum,
  autoBE,
  placedAt: num,
});

const account = z.object({
  balance: num,
  positions: z.array(position),
  orders: z.array(order),
  trades: z.array(trade),
  time: num,
  bid: num,
  status: z.enum(['active', 'ended', 'stopped-out', 'failed']),
  day: num,
  dayStartBalance: num,
  targetReachedAt: nullableNum,
  failReason: z.string().nullable(),
});

const optProt = { sl: nullableNum.optional(), tp: nullableNum.optional() };
/** A trader action (validates actions received from clients, e.g. in battles). */
export const tradeActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('market'),
    id: z.string(),
    side,
    volume: num,
    sl: nullableNum,
    tp: nullableNum,
    autoBE: autoBE.optional(),
  }),
  z.object({
    type: z.literal('pending'),
    id: z.string(),
    side,
    kind: z.enum(['limit', 'stop']),
    price: num,
    volume: num,
    sl: nullableNum,
    tp: nullableNum,
    autoBE: autoBE.optional(),
  }),
  z.object({
    type: z.literal('modify-order'),
    id: z.string(),
    price: num.optional(),
    volume: num.optional(),
    ...optProt,
  }),
  z.object({ type: z.literal('cancel-order'), id: z.string() }),
  z.object({
    type: z.literal('modify-position'),
    id: z.string(),
    ...optProt,
    autoBE: autoBE.optional(),
  }),
  z.object({ type: z.literal('close'), id: z.string(), volume: num.optional() }),
  z.object({ type: z.literal('break-even'), id: z.string() }),
  z.object({ type: z.literal('close-all') }),
  z.object({ type: z.literal('cancel-all') }),
]);

export const sessionSchema = z.object({
  id: z.string(),
  createdAt: num,
  updatedAt: num,
  settings,
  prefs: z.object({ tickerValue: timeframe, frequency: num }),
  scalper: z.object({
    enabled: z.boolean(),
    unit: z.enum(['pips', 'ticks', 'percent']),
    sl: nullableNum,
    tp: nullableNum,
    autoBE,
  }),
  quickVolume: num,
  cursor: num,
  actions: z.array(z.object({ t: num, a: tradeActionSchema })),
  account,
  initialBid: num,
  journal: z.record(
    z.string(),
    z.object({
      notes: z.string(),
      tags: z.array(z.string()),
      confidence: nullableNum,
      screenshots: z.array(z.string()),
    }),
  ),
  nextId: num,
});

export function parseSession(data: unknown): BacktestSession | null {
  const r = sessionSchema.safeParse(data);
  return r.success ? (r.data as BacktestSession) : null;
}
