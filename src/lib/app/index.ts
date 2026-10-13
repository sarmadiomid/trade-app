export { ChartApp, type ChartAppOptions } from './chart-app';
export {
  createBrowserDependencies,
  createPlaybackDependencies,
  type AppDependencies,
} from './composition';
export type { AppEventMap, UiCommand } from './app-events';
export { APP_CONFIG } from './config';
export { CHART_SETTINGS_SCHEMA } from './settings/chart-settings-schema';
export { chordLabel, type KeyInput } from './shortcuts/keys';
export type { ShortcutDefinition, ShortcutCategory } from './shortcuts/shortcut-registry';
export type { ImportResult } from './services/theme-service';
export * from './lessons';
export {
  BacktestController,
  type BacktestCommand,
  type BacktestEventMap,
  type RewindCheck,
} from './backtest/backtest-controller';
export {
  BacktestRuntime,
  createBacktestServices,
  type BacktestServices,
} from './backtest/backtest-runtime';
export type { BacktestSnapshot, PositionView, PropProgress } from './backtest/snapshot';
export type { OrderTicket, RightClickOrder } from './backtest/trading-api';
