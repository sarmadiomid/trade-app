import {
  currentPlan,
  entitlements,
  guardPlan,
  isPlanInstalled,
  limitMessage,
} from '@/lib/app';
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

/** Saves layouts on the server, then mirrors them locally. Returns the denial when the plan rejects the list. */
export async function persistLayouts(layouts: readonly ChartLayout[]): Promise<string | null> {
  if (isPlanInstalled()) {
    const plan = currentPlan();
    const limit = entitlements(plan).layouts;
    if (limit !== null && layouts.length > limit) {
      const message = limitMessage('چیدمان ذخیره‌شده', plan, limit);
      guardPlan(message);
      return message;
    }
  }
  try {
    const res = await fetch('/api/chart-records', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'layouts', value: layouts }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return body?.error ?? 'چیدمان ذخیره نشد';
    }
    writeLayouts(layouts);
    return null;
  } catch {
    return 'چیدمان ذخیره نشد';
  }
}

/** Server copy of saved layouts, or null when the account has not stored any yet. */
export async function loadServerLayouts(): Promise<ChartLayout[] | null> {
  try {
    const res = await fetch('/api/chart-records', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { records?: { layouts?: unknown } };
    const raw = body.records?.layouts;
    if (!Array.isArray(raw)) return null;
    return raw.filter(isLayout);
  } catch {
    return null;
  }
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
