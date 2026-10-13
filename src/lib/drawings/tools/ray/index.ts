import type { DrawingToolDefinition } from '../../framework';
import { trendLineTool } from '../trend-line';
import { TREND_LINE_DEFAULTS, type TrendLineStyle } from '../trend-line/style';
import { TrendLine } from '../trend-line/trend-line';

/** Trend line extended to the right through its second point. */
export const rayTool: DrawingToolDefinition<TrendLineStyle> = {
  id: 'ray',
  label: 'Ray',
  icon: 'M3 19a2 2 0 1 0 4 0 2 2 0 1 0-4 0M11 13a2 2 0 1 0 4 0 2 2 0 1 0-4 0M6.5 17.5l4.6-3M14.5 11.5L21 7',
  group: 'lines',
  placement: trendLineTool.placement,
  defaults: { ...TREND_LINE_DEFAULTS, extendRight: true },
  styleSchema: trendLineTool.styleSchema,
  themeDefaults: { color: 'drawingLine' },
  angleConstraint: true,
  toolbar: trendLineTool.toolbar,
  pointLabels: ['Start', 'Point'],
  settings: trendLineTool.settings,
  create: (init) => new TrendLine('ray', init),
};
