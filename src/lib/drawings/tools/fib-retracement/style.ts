import { z } from 'zod';
import { zColor, zFontSize, zHAlign, zLineStyle, zLineWidth, zOpacity, zVAlign } from '../../framework';

/** TradingView's default Fib Retracement levels: value, colour, visible. */
export const FIB_LEVELS: ReadonlyArray<readonly [number, string, boolean]> = [
  [0, '#787b86', true],
  [0.236, '#f23645', true],
  [0.382, '#ff9800', true],
  [0.5, '#4caf50', true],
  [0.618, '#089981', true],
  [0.786, '#00bcd4', true],
  [1, '#787b86', true],
  [1.618, '#2962ff', true],
  [2.618, '#f23645', true],
  [3.618, '#9c27b0', true],
  [4.236, '#e91e63', true],
  [1.272, '#ff9800', false],
  [1.414, '#f23645', false],
  [2.272, '#ff9800', false],
  [2.414, '#4caf50', false],
  [2, '#089981', false],
  [3, '#00bcd4', false],
  [3.272, '#787b86', false],
  [3.414, '#2962ff', false],
  [4, '#f23645', false],
  [4.272, '#9c27b0', false],
  [4.414, '#e91e63', false],
  [4.618, '#ff9800', false],
  [4.764, '#089981', false],
];

export const levelKeys = (i: number) =>
  ({ on: `level${i}On`, value: `level${i}`, color: `level${i}Color` }) as const;

const levelShape: Record<string, z.ZodType> = {};
const levelDefaults: Record<string, unknown> = {};
FIB_LEVELS.forEach(([value, color, on], i) => {
  const k = levelKeys(i);
  levelShape[k.on] = z.boolean();
  levelShape[k.value] = z.number().min(-100).max(100);
  levelShape[k.color] = zColor;
  levelDefaults[k.on] = on;
  levelDefaults[k.value] = value;
  levelDefaults[k.color] = color;
});

const baseSchema = z.object({
  showTrendLine: z.boolean(),
  trendColor: zColor,
  trendOpacity: zOpacity,
  trendWidth: zLineWidth,
  trendStyle: zLineStyle,
  levelsWidth: zLineWidth,
  levelsStyle: zLineStyle,
  extendLeft: z.boolean(),
  extendRight: z.boolean(),
  reverse: z.boolean(),
  showPrices: z.boolean(),
  showLevels: z.boolean(),
  levelsFormat: z.enum(['values', 'percent']),
  labelsHAlign: zHAlign,
  labelsVAlign: zVAlign,
  fontSize: zFontSize,
  fillEnabled: z.boolean(),
  fillOpacity: zOpacity,
});

type BaseStyle = z.infer<typeof baseSchema>;

/** Level keys are generated (`level{i}`, `level{i}Color`, `level{i}On`). */
export type FibRetracementStyle = BaseStyle & Record<string, unknown>;

export const fibRetracementStyleSchema = baseSchema
  .extend(levelShape)
  .strip() as unknown as z.ZodType<FibRetracementStyle>;

export const FIB_RETRACEMENT_DEFAULTS: FibRetracementStyle = {
  showTrendLine: true,
  trendColor: '#787b86',
  trendOpacity: 1,
  trendWidth: 1,
  trendStyle: 'dashed',
  levelsWidth: 1,
  levelsStyle: 'solid',
  extendLeft: false,
  extendRight: false,
  reverse: false,
  showPrices: true,
  showLevels: true,
  levelsFormat: 'values',
  labelsHAlign: 'left',
  labelsVAlign: 'middle',
  fontSize: 12,
  fillEnabled: true,
  fillOpacity: 0.15,
  ...levelDefaults,
};
