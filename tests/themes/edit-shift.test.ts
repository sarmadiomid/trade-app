import { describe, expect, it } from 'vitest';
import { darkTheme, lightTheme, shiftThemeForEdit } from '@/lib/themes';

describe('shiftThemeForEdit', () => {
  it('nudges the chart surface and leaves candles, text and drawings alone', () => {
    for (const theme of [darkTheme, lightTheme]) {
      const next = shiftThemeForEdit(theme);
      expect(next.id).toBe(theme.id);
      expect(next.dark).toBe(theme.dark);
      expect(next.colors.background).not.toBe(theme.colors.background);
      expect(next.colors.uiPanel).not.toBe(theme.colors.uiPanel);
      expect(next.colors.grid).not.toBe(theme.colors.grid);
      expect(next.colors.upBody).toBe(theme.colors.upBody);
      expect(next.colors.downBody).toBe(theme.colors.downBody);
      expect(next.colors.uiText).toBe(theme.colors.uiText);
      expect(next.colors.drawingLine).toBe(theme.colors.drawingLine);
      expect(next.colors.uiAccent).toBe(theme.colors.uiAccent);
    }
  });
});
