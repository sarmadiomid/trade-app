import type { DrawingToolDefinition } from '../../framework';
import {
  HORIZONTAL_LINE_DEFAULTS,
  HorizontalLine,
  horizontalLineSettings,
  horizontalLineStyleSchema,
  type HorizontalLineStyle,
} from '../horizontal-line';

export const horizontalRayTool: DrawingToolDefinition<HorizontalLineStyle> = {
  id: 'horizontal-ray',
  label: 'Horizontal Ray',
  icon: 'M5 12h16M3 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  shortcut: 'Alt+J',
  group: 'lines',
  placement: { kind: 'single' },
  defaults: { ...HORIZONTAL_LINE_DEFAULTS, textAlign: 'left' },
  styleSchema: horizontalLineStyleSchema,
  themeDefaults: { color: 'drawingLine', textColor: 'drawingLine' },
  toolbar: ['color', 'lineWidth', 'lineStyle'],
  pointLabels: ['Point'],
  settings: horizontalLineSettings,
  create: (init) => new HorizontalLine('horizontal-ray', init, true),
};
