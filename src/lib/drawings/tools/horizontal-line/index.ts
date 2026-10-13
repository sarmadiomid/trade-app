import type { SettingsSchema } from '@/lib/core';
import type { DrawingToolDefinition } from '../../framework';
import { lineFields, textFields } from '../../framework';
import { HorizontalLine } from './horizontal-line';
import {
  HORIZONTAL_LINE_DEFAULTS,
  horizontalLineStyleSchema,
  type HorizontalLineStyle,
} from './style';

export { HorizontalLine } from './horizontal-line';
export { HORIZONTAL_LINE_DEFAULTS, horizontalLineStyleSchema } from './style';
export type { HorizontalLineStyle } from './style';

export const horizontalLineSettings: SettingsSchema = {
  tabs: [
    {
      id: 'style',
      label: 'Style',
      groups: [
        {
          id: 'line',
          fields: [
            ...lineFields({ color: 'color', opacity: 'opacity', width: 'lineWidth', style: 'lineStyle' }),
            { kind: 'boolean', key: 'showPrice', label: 'Price label' },
          ],
        },
      ],
    },
    {
      id: 'text',
      label: 'Text',
      groups: [
        { id: 'text', fields: textFields({ withAlign: 'textAlign', withVAlign: 'textPosition' }) },
      ],
    },
  ],
};

export const horizontalLineTool: DrawingToolDefinition<HorizontalLineStyle> = {
  id: 'horizontal-line',
  label: 'Horizontal Line',
  icon: 'M3 12h18M12 12h.01M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  shortcut: 'Alt+H',
  group: 'lines',
  placement: { kind: 'single' },
  defaults: HORIZONTAL_LINE_DEFAULTS,
  styleSchema: horizontalLineStyleSchema,
  themeDefaults: { color: 'drawingLine', textColor: 'drawingLine' },
  toolbar: ['color', 'lineWidth', 'lineStyle'],
  pointLabels: ['Price'],
  coordinateFields: [['price']],
  settings: horizontalLineSettings,
  create: (init) => new HorizontalLine('horizontal-line', init, false),
};
