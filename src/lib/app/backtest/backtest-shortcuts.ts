import type { ChartApp } from '../chart-app';
import type { ShortcutDefinition } from '../shortcuts/shortcut-registry';
import type { BacktestController } from './backtest-controller';

type Get = () => BacktestController | null;

/**
 * FX Replay's hotkeys (support article "Available hotkeys for FX Replay"). Registered ahead of
 * the chart's own shortcuts, so e.g. Alt+M opens a market order instead of toggling the magnet.
 * On macOS Option works as Alt.
 */
export function backtestShortcuts(get: Get): Array<ShortcutDefinition<ChartApp>> {
  const def = (
    id: string,
    keys: string[],
    description: string,
    run: (c: BacktestController) => void,
    allowRepeat = false,
    when: (c: BacktestController) => boolean = () => true,
  ): ShortcutDefinition<ChartApp> => ({
    id: `backtest-${id}`,
    keys,
    description,
    category: 'Backtest',
    allowRepeat,
    when: () => {
      const c = get();
      return c !== null && !c.inputBlocked && when(c);
    },
    run: () => {
      const c = get();
      if (c) run(c);
    },
  });
  return [
    def('next', ['Ctrl+Space'], 'Emit next candle', (c) => void c.next(), true),
    def('play', ['Alt+1'], 'Play / pause', (c) => c.togglePlay()),
    def('freq-down', ['Alt+2'], 'Decrease frequency', (c) => c.shiftFrequency(-1)),
    def('freq-up', ['Alt+3'], 'Increase frequency', (c) => c.shiftFrequency(1)),
    def('ticker-down', ['Alt+4'], 'Decrease ticker value', (c) => c.shiftTickerValue(-1)),
    def('ticker-up', ['Alt+5'], 'Increase ticker value', (c) => c.shiftTickerValue(1)),
    def('rewind', ['Alt+Z'], 'Rewind one candle', (c) => c.requestRewind(), true),
    def('new-order', ['Alt+,'], 'New order', (c) =>
      c.command({ type: 'order-ticket', orderType: null }),
    ),
    def('new-limit', ['Alt+B'], 'New limit order', (c) =>
      c.command({ type: 'order-ticket', orderType: 'limit' }),
    ),
    def('new-stop', ['Alt+N'], 'New stop order', (c) =>
      c.command({ type: 'order-ticket', orderType: 'stop' }),
    ),
    def('new-market', ['Alt+M'], 'New market order', (c) =>
      c.command({ type: 'order-ticket', orderType: 'market' }),
    ),
    def(
      'prop-rules',
      ['Tab'],
      'Prop Firm Rules panel',
      (c) => c.command({ type: 'prop-rules' }),
      false,
      (c) => c.session.settings.type === 'prop',
    ),
    def('shortcut-list', ['Ctrl+Alt+H', 'Ctrl+Shift+H'], 'Show shortcuts', (c) =>
      c.command({ type: 'shortcuts' }),
    ),
  ];
}
