import type { DrawingToolDefinition } from '../../framework';
import { trendLineTool } from '../trend-line';
import { TREND_LINE_DEFAULTS, type TrendLineStyle } from '../trend-line/style';
import { TrendLine } from '../trend-line/trend-line';

/** Trend line extended infinitely in both directions. */
export const extendedLineTool: DrawingToolDefinition<TrendLineStyle> = {
  id: 'extended-line',
  label: 'Extended Line',
  icon: 'M7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M13 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0M3 21l4.6-3M10.5 15.5l3-7M16.4 6L21 3',
  group: 'lines',
  placement: trendLineTool.placement,
  defaults: { ...TREND_LINE_DEFAULTS, extendLeft: true, extendRight: true },
  styleSchema: trendLineTool.styleSchema,
  themeDefaults: { color: 'drawingLine' },
  angleConstraint: true,
  toolbar: trendLineTool.toolbar,
  pointLabels: ['Point 1', 'Point 2'],
  settings: trendLineTool.settings,
  create: (init) => new TrendLine('extended-line', init),
};
