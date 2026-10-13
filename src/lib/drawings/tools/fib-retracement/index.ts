import type { SettingsField } from '@/lib/core';
import type { DrawingToolDefinition } from '../../framework';
import { H_ALIGN_OPTIONS, V_ALIGN_OPTIONS, lineFields } from '../../framework';
import { FibRetracement } from './fib';
import {
  FIB_LEVELS,
  FIB_RETRACEMENT_DEFAULTS,
  fibRetracementStyleSchema,
  levelKeys,
  type FibRetracementStyle,
} from './style';

const levelFields: SettingsField[] = FIB_LEVELS.flatMap((_, i) => {
  const k = levelKeys(i);
  return [
    { kind: 'boolean', key: k.on, label: `Level ${i + 1}` },
    { kind: 'number', key: k.value, label: 'Value', step: 0.001, min: -100, max: 100, inline: true },
    { kind: 'color', key: k.color, label: 'Color', inline: true },
  ] satisfies SettingsField[];
});

export const fibRetracementTool: DrawingToolDefinition<FibRetracementStyle> = {
  id: 'fib-retracement',
  label: 'Fib Retracement',
  icon: 'M3 5h18M3 9.5h18M3 13h18M3 19h18M5 19L19 5',
  shortcut: 'Alt+F',
  group: 'fib',
  placement: { kind: 'points', count: 2 },
  defaults: FIB_RETRACEMENT_DEFAULTS,
  styleSchema: fibRetracementStyleSchema,
  toolbar: ['levelsWidth', 'levelsStyle'],
  pointLabels: ['Start', 'End'],
  settings: {
    tabs: [
      {
        id: 'style',
        label: 'Style',
        groups: [
          {
            id: 'trend',
            fields: [
              { kind: 'boolean', key: 'showTrendLine', label: 'Trend line' },
              ...lineFields({
                color: 'trendColor',
                opacity: 'trendOpacity',
                width: 'trendWidth',
                style: 'trendStyle',
                label: 'Trend line',
              }).map((f) => ({ ...f, visibleWhen: { key: 'showTrendLine', truthy: true } })),
              { kind: 'lineWidth', key: 'levelsWidth', label: 'Levels line' },
              { kind: 'lineStyle', key: 'levelsStyle', label: 'Style', inline: true },
            ],
          },
          { id: 'levels', label: 'Levels', fields: levelFields },
          {
            id: 'options',
            fields: [
              { kind: 'boolean', key: 'extendLeft', label: 'Extend lines left' },
              { kind: 'boolean', key: 'extendRight', label: 'Extend lines right' },
              { kind: 'boolean', key: 'reverse', label: 'Reverse' },
              { kind: 'boolean', key: 'showPrices', label: 'Prices' },
              { kind: 'boolean', key: 'showLevels', label: 'Levels' },
              {
                kind: 'select',
                key: 'levelsFormat',
                label: 'Format',
                inline: true,
                options: [
                  { value: 'values', label: 'Values' },
                  { value: 'percent', label: 'Percents' },
                ],
              },
              { kind: 'select', key: 'labelsHAlign', label: 'Labels', options: H_ALIGN_OPTIONS },
              {
                kind: 'select',
                key: 'labelsVAlign',
                label: 'Vertical',
                inline: true,
                options: V_ALIGN_OPTIONS,
              },
              { kind: 'fontSize', key: 'fontSize', label: 'Font size' },
              { kind: 'boolean', key: 'fillEnabled', label: 'Background' },
              { kind: 'opacity', key: 'fillOpacity', label: 'Opacity', inline: true },
            ],
          },
        ],
      },
    ],
  },
  create: (init) => new FibRetracement('fib-retracement', init),
};
