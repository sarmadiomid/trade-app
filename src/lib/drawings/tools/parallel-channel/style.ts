import { z } from 'zod';
import { zColor, zLineStyle, zLineWidth, zOpacity } from '../../framework';

export const parallelChannelStyleSchema = z.object({
  color: zColor,
  opacity: zOpacity,
  lineWidth: zLineWidth,
  lineStyle: zLineStyle,
  extendLeft: z.boolean(),
  extendRight: z.boolean(),
  showMiddleLine: z.boolean(),
  middleColor: zColor,
  middleOpacity: zOpacity,
  middleWidth: zLineWidth,
  middleStyle: zLineStyle,
  fillEnabled: z.boolean(),
  fillColor: zColor,
  fillOpacity: zOpacity,
});

export type ParallelChannelStyle = z.infer<typeof parallelChannelStyleSchema>;

export const PARALLEL_CHANNEL_DEFAULTS: ParallelChannelStyle = {
  color: '#2962ff',
  opacity: 1,
  lineWidth: 2,
  lineStyle: 'solid',
  extendLeft: false,
  extendRight: false,
  showMiddleLine: true,
  middleColor: '#2962ff',
  middleOpacity: 1,
  middleWidth: 1,
  middleStyle: 'dashed',
  fillEnabled: true,
  fillColor: '#2962ff',
  fillOpacity: 0.2,
};
