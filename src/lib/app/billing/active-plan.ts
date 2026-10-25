import type { PlanId } from './entitlements';

/**
 * The signed-in user's plan, installed by the client after `/api/me` loads.
 * Until then enforcement stays off so tests and the first paint are unchanged;
 * the server still rejects anything the plan does not allow.
 */
let installed = false;
let plan: PlanId = 'beginner';
let onDenied: ((message: string) => void) | null = null;

export function installPlan(next: PlanId): void {
  installed = true;
  plan = next;
}

export function isPlanInstalled(): boolean {
  return installed;
}

export function currentPlan(): PlanId {
  return plan;
}

export function setPlanDeniedHandler(handler: ((message: string) => void) | null): void {
  onDenied = handler;
}

export function denyPlan(message: string): void {
  onDenied?.(message);
}

/** Returns true when the action may proceed. A denial toasts only after the plan is installed. */
export function guardPlan(denial: string | null): boolean {
  if (!installed || !denial) return true;
  onDenied?.(denial);
  return false;
}
