import type { TimeframeId } from '@/lib/core';

const KEY = 'chart-mobile-layouts';
const ACTIVE = 'chart-mobile-layout-active';

export interface ChartLayout {
  readonly id: string;
  readonly name: string;
  readonly chartType: string;
  readonly timeframe: TimeframeId;
  readonly themeId: string;
  readonly volumeVisible: boolean;
}

function isLayout(value: unknown): value is ChartLayout {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.chartType === 'string' &&
    typeof row.timeframe === 'string' &&
    typeof row.themeId === 'string' &&
    typeof row.volumeVisible === 'boolean'
  );
}

export function readLayouts(): ChartLayout[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isLayout) : [];
  } catch {
    return [];
  }
}

export function writeLayouts(layouts: readonly ChartLayout[]): void {
  localStorage.setItem(KEY, JSON.stringify(layouts));
}

export function readActiveLayout(): string | null {
  try {
    return localStorage.getItem(ACTIVE);
  } catch {
    return null;
  }
}

export function writeActiveLayout(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE, id);
  else localStorage.removeItem(ACTIVE);
}
