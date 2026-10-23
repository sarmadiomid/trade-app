import type { BacktestController } from '@/lib/app';
import type { MenuEntry } from '../drawing/ContextMenu';
import { lots } from './format';
import { useBacktestStore } from './store';

const ORDER_FA: Readonly<Record<string, string>> = {
  'Buy Limit': 'خرید لیمیت',
  'Buy Stop': 'خرید استاپ',
  'Sell Limit': 'فروش لیمیت',
  'Sell Stop': 'فروش استاپ',
};

/**
 * Right-click orders on the trading chart. Backtest and Battle share this menu.
 * Rewind entries appear only when the host allows stepping backward.
 */
export function sessionChartMenu(
  c: BacktestController,
  point: { readonly time: number; readonly price: number },
): MenuEntry[] {
  const ui = useBacktestStore.getState();
  if (c.ended || !ui.actionsEnabled) return [];
  const vol = c.session.quickVolume > 0 ? c.session.quickVolume : c.cfg.lotMin;
  const p = c.spec.pricePrecision;
  const orders: MenuEntry[] = c.trading.rightClickOrders(point.price).map((o) => ({
    label: `${ORDER_FA[o.label] ?? o.label} ${lots(vol)} @ ${o.price.toFixed(p)}`,
    run: () => {
      c.trading.place({
        side: o.side,
        type: o.kind,
        price: o.price,
        volume: vol,
        sl: null,
        tp: null,
      });
    },
  }));
  const entries: MenuEntry[] = [
    ...orders,
    {
      label: 'سفارش تازه روی این قیمت…',
      icon: 'plus',
      run: () => {
        const o = c.trading.rightClickOrders(point.price)[0];
        if (o)
          useBacktestStore.getState().openTicket({ side: o.side, type: o.kind, price: o.price });
      },
    },
  ];
  if (ui.allowRewind && point.time < c.cursor)
    entries.push({
      label: 'بازپخش تا این نقطه',
      icon: 'replay',
      run: () =>
        void c.replayToBar(point.time).then((check) => {
          if (!check.ok)
            useBacktestStore.getState().openModal({
              type: 'confirm-rewind',
              time: Math.min(c.cursor, point.time),
              check,
            });
        }),
    });
  return entries;
}
