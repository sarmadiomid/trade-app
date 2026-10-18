import type { ExecEvent, ExitReason } from '@/lib/backtest';
import { faDigits } from '@/lib/locale/jalali';

function reasonFa(reason: string): string {
  const daily = /^Max daily loss \((.+)\)$/.exec(reason);
  if (daily) return `سقف ضرر روزانه (${faDigits(daily[1]!)})`;
  const total = /^Max total loss \((.+)\)$/.exec(reason);
  if (total) return `سقف ضرر کل (${faDigits(total[1]!)})`;
  if (reason === 'Stop out' || reason === 'Stopped out') return 'کال مارجین';
  if (reason === 'Session end') return 'پایان جلسه';
  return reason;
}

const REASON: Readonly<Record<ExitReason, string>> = {
  tp: 'حد سود خورد',
  sl: 'حد ضرر خورد',
  manual: 'معامله بسته شد',
  partial: 'بخشی از حجم بسته شد',
  'session-end': 'در پایان جلسه بسته شد',
  'stop-out': 'کال مارجین',
  'rule-breach': 'به‌خاطر نقض قانون پراپ بسته شد',
};

const money = (v: number) =>
  `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

/** Toast text for an execution event (null = not worth a toast). */
export function describeEvent(
  e: ExecEvent,
  precision: number,
): { level: 'info' | 'success' | 'error'; text: string } | null {
  switch (e.type) {
    case 'filled': {
      const p = e.position;
      const what = e.from === 'market' ? 'بازار' : e.from === 'limit' ? 'لیمیت' : 'استاپ';
      return {
        level: 'info',
        text: `${what} ${p.side === 'buy' ? 'خرید' : 'فروش'} ${p.volume.toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} لات در ${p.entryPrice.toFixed(precision)} پر شد`,
      };
    }
    case 'exit': {
      const pnl = e.closed ? e.closed.netPnl : e.exit.pnl - e.exit.commission;
      return {
        level: pnl >= 0 ? 'success' : 'error',
        text: `#${e.positionId} ${REASON[e.exit.reason]} در ${e.exit.price.toFixed(precision)} · ${money(pnl)}`,
      };
    }
    case 'break-even':
      return { level: 'info', text: `#${e.positionId} حد ضرر به نقطه ورود منتقل شد` };
    case 'stopped':
      return e.status === 'ended'
        ? { level: 'info', text: 'جلسه تمام شد' }
        : { level: 'error', text: `جلسه متوقف شد: ${reasonFa(e.reason)}` };
    case 'target-reached':
      return { level: 'success', text: 'به هدف سود رسیدید' };
    default:
      return null;
  }
}
