import type { ExecEvent, ExitReason } from '@/lib/backtest';

const REASON: Readonly<Record<ExitReason, string>> = {
  tp: 'Take profit hit',
  sl: 'Stop loss hit',
  manual: 'Position closed',
  partial: 'Partially closed',
  'session-end': 'Closed at session end',
  'stop-out': 'Stopped out',
  'rule-breach': 'Closed: prop rule breached',
};

const money = (v: number) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`;

/** Toast text for an execution event (null = not worth a toast). */
export function describeEvent(
  e: ExecEvent,
  precision: number,
): { level: 'info' | 'success' | 'error'; text: string } | null {
  switch (e.type) {
    case 'filled': {
      const p = e.position;
      const what = e.from === 'market' ? 'Market' : e.from === 'limit' ? 'Limit' : 'Stop';
      return {
        level: 'info',
        text: `${what} ${p.side === 'buy' ? 'buy' : 'sell'} ${p.volume.toFixed(2)} filled @ ${p.entryPrice.toFixed(precision)}`,
      };
    }
    case 'exit': {
      const pnl = e.closed ? e.closed.netPnl : e.exit.pnl - e.exit.commission;
      return {
        level: pnl >= 0 ? 'success' : 'error',
        text: `#${e.positionId} ${REASON[e.exit.reason]} @ ${e.exit.price.toFixed(precision)} · ${money(pnl)}`,
      };
    }
    case 'break-even':
      return { level: 'info', text: `#${e.positionId} Stop loss moved to break even` };
    case 'stopped':
      return e.status === 'ended'
        ? { level: 'info', text: 'Session completed' }
        : { level: 'error', text: `Session stopped: ${e.reason}` };
    case 'target-reached':
      return { level: 'success', text: 'Profit target reached' };
    default:
      return null;
  }
}
