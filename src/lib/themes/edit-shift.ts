import type { Theme, ThemeColorKey } from '@/lib/core';
import { parseColor, toRgbaString } from '@/lib/core';

/**
 * Surface colours that shift while a lesson is paused and the chart is editable.
 * Candles, drawings and text stay put so the lesson itself still reads the same.
 */
const SURFACE_KEYS: readonly ThemeColorKey[] = [
  'background',
  'backgroundGradientEnd',
  'grid',
  'scaleBorder',
  'crosshairLabelBg',
  'uiPanel',
  'uiPanelBorder',
  'uiHover',
  'drawingHandle',
];

/** Cool slate the dark surface leans toward; cool gray for light. */
const DARK_TARGET = '#3d5278';
const LIGHT_TARGET = '#d4dff0';
const DARK_AMOUNT = 0.2;
const LIGHT_AMOUNT = 0.28;

function mixToward(color: string, target: string, amount: number): string {
  const a = parseColor(color);
  const b = parseColor(target);
  return toRgbaString({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
    a: a.a,
  });
}

/**
 * A small cool shift of the chart's surface, so paused editing looks different from playback.
 * Always pass the real theme — shifting an already shifted theme compounds the change.
 */
export function shiftThemeForEdit(theme: Theme): Theme {
  const target = theme.dark ? DARK_TARGET : LIGHT_TARGET;
  const amount = theme.dark ? DARK_AMOUNT : LIGHT_AMOUNT;
  const colors = { ...theme.colors };
  for (const key of SURFACE_KEYS) colors[key] = mixToward(colors[key], target, amount);
  return { ...theme, colors };
}
