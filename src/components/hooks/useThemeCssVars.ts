'use client';

import { useEffect } from 'react';
import { shiftThemeForEdit } from '@/lib/themes';
import { THEME_CSS_VARS } from '../ui/tokens';
import { useUiStore } from '../state/ui-store';

/**
 * Pushes the active theme's UI colours into CSS custom properties (design tokens).
 * `editShift` nudges the surface the same way the chart does while a lesson is paused.
 */
export function useThemeCssVars(editShift = false): void {
  const theme = useUiStore((s) => s.activeTheme);
  useEffect(() => {
    const shown = editShift ? shiftThemeForEdit(theme) : theme;
    const root = document.documentElement;
    for (const [cssVar, key] of Object.entries(THEME_CSS_VARS)) {
      root.style.setProperty(cssVar, shown.colors[key]);
    }
    root.style.colorScheme = shown.dark ? 'dark' : 'light';
  }, [theme, editShift]);
}
