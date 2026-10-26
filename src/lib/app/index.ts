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
  browserBacktestServices,
  createBacktestServices,
  type BacktestServices,
} from './backtest/backtest-runtime';
export type { BacktestSnapshot, PositionView, PropProgress } from './backtest/snapshot';
export type { OrderTicket, RightClickOrder } from './backtest/trading-api';
export { scanExcursions } from './backtest/analytics-service';
export { BattleRuntime, type BattleSeat } from './battle/battle-runtime';
export { battleSessionSettings, battleAccountConfig } from './battle/battle-config';
export {
  PLAN_IDS,
  PLAN_LABEL,
  STANDARD_BALANCE,
  chartTypeAllowed,
  chartRecordDenial,
  chartTypeDenial,
  currentPlan,
  denyPlan,
  guardPlan,
  drawingToolAllowed,
  drawingToolDenial,
  closePlanPrompt,
  entitlements,
  historyDenial,
  installPlan,
  isPlanInstalled,
  isPlanLimitMessage,
  limitMessage,
  normalizePlan,
  openPlanPrompt,
  openWelcomePlanPrompt,
  planPrompt,
  planPromptKind,
  queueWelcomePlan,
  requiresPlan,
  selectableHistoryStart,
  sessionSettingsDenial,
  setPlanDeniedHandler,
  subscribePlanPrompt,
  symbolAllowed,
  symbolDenial,
  symbolMinPlan,
  welcomePlanQueued,
  type PlanId,
} from './billing';
