import type { LoggedAction } from './model';

export type ReplayPlan = { readonly kind: 'meta' } | { readonly kind: 'advance' } | { readonly kind: 'replay' };

/** Stable comparison: object key order must not make two equal actions look different. */
function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${k}:${canon(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const sameAction = (a: LoggedAction, b: LoggedAction) => a.t === b.t && canon(a.a) === canon(b.a);

/**
 * How to turn the stored session into the proposed one without trusting the client's balance.
 * History at or before the cursor cannot be edited. Rewind drops only actions after the cursor.
 * A later cursor with the same actions is an advance (stops and targets fire on the server).
 */
export function planReplay(
  stored: { readonly actions: readonly LoggedAction[]; readonly cursor: number },
  proposedActions: readonly LoggedAction[],
  cursor: number,
): ReplayPlan | { readonly error: string } {
  const kept = stored.actions.filter((a) => a.t <= cursor);
  if (proposedActions.length < kept.length)
    return { error: 'سابقهٔ معاملات قابل کوتاه شدن نیست' };
  for (let i = 0; i < kept.length; i++) {
    if (!sameAction(kept[i]!, proposedActions[i]!))
      return { error: 'سابقهٔ معاملات قابل تغییر نیست' };
  }
  const extras = proposedActions.slice(kept.length);
  for (const e of extras) {
    if (e.t > cursor) return { error: 'معامله بعد از زمان نمودار ثبت شده است' };
    if (cursor >= stored.cursor && e.t < stored.cursor)
      return { error: 'معامله در گذشتهٔ ثبت‌شده مجاز نیست' };
  }
  if (extras.length === 0 && cursor === stored.cursor) return { kind: 'meta' };
  if (extras.length === 0 && cursor > stored.cursor) return { kind: 'advance' };
  return { kind: 'replay' };
}
