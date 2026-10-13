import type { DrawingToolDefinition } from '../../framework';
import { lineFields } from '../../framework';
import { ParallelChannel, channelPoints } from './channel';
import {
  PARALLEL_CHANNEL_DEFAULTS,
  parallelChannelStyleSchema,
  type ParallelChannelStyle,
} from './style';

export const parallelChannelTool: DrawingToolDefinition<ParallelChannelStyle> = {
  id: 'parallel-channel',
  label: 'Parallel Channel',
  icon: 'M4.5 13.8L13.5 6.2M9.5 17.8L21 8M1.5 15a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M13.5 5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M6.5 19a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',
  group: 'lines',
  placement: { kind: 'points', count: 3 },
  defaults: PARALLEL_CHANNEL_DEFAULTS,
  styleSchema: parallelChannelStyleSchema,
  themeDefaults: { color: 'drawingLine', middleColor: 'drawingLine', fillColor: 'drawingLine' },
  toolbar: ['color', 'fillColor', 'lineWidth', 'lineStyle'],
  pointLabels: ['Point 1', 'Point 2', 'Point 3'],
  finalizePoints: channelPoints,
  normalizePoints: (points) => {
    const [a, b, c] = points;
    if (!a || !b || !c) return [...points];
    return [a, b, { time: a.time, price: c.price }];
  },
  settings: {
    tabs: [
      {
        id: 'style',
        label: 'Style',
        groups: [
          {
            id: 'channel',
            fields: [
              ...lineFields({
                color: 'color',
                opacity: 'opacity',
                width: 'lineWidth',
                style: 'lineStyle',
                label: 'Channel',
              }),
              { kind: 'boolean', key: 'extendLeft', label: 'Extend left' },
              { kind: 'boolean', key: 'extendRight', label: 'Extend right' },
            ],
          },
          {
            id: 'middle',
            label: 'Middle line',
            fields: [
              { kind: 'boolean', key: 'showMiddleLine', label: 'Middle line' },
              ...lineFields({
                color: 'middleColor',
                opacity: 'middleOpacity',
                width: 'middleWidth',
                style: 'middleStyle',
              }).map((f) => ({ ...f, visibleWhen: { key: 'showMiddleLine', truthy: true } })),
            ],
          },
          {
            id: 'background',
            label: 'Background',
            fields: [
              { kind: 'boolean', key: 'fillEnabled', label: 'Background' },
              {
                kind: 'color',
                key: 'fillColor',
                label: 'Fill',
                opacityKey: 'fillOpacity',
                inline: true,
              },
            ],
          },
        ],
      },
    ],
  },
  create: (init) => new ParallelChannel('parallel-channel', init),
};
