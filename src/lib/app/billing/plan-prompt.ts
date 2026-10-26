/**
 * The upgrade modal's open message. UI subscribes; anything that hits a plan
 * limit (a click, a guard, or a server rejection) can open it without React.
 * A brand-new account queues a one-time welcome open of the same modal.
 */
const WELCOME_PLAN_KEY = 'candelo:welcome-plan';

export const WELCOME_PLAN_MESSAGE =
  'حساب شما ساخته شد. با طرح مبتدی شروع می‌کنید؛ برای تمرین بیشتر می‌توانید همین حالا ارتقا دهید.';

export type PlanPromptKind = 'limit' | 'welcome';

let message: string | null = null;
let kind: PlanPromptKind = 'limit';
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Remember that this tab just created an account, so the next app screen can open the plans. */
export function queueWelcomePlan(): void {
  storage()?.setItem(WELCOME_PLAN_KEY, '1');
}

export function welcomePlanQueued(): boolean {
  return storage()?.getItem(WELCOME_PLAN_KEY) === '1';
}

export function planPrompt(): string | null {
  return message;
}

export function planPromptKind(): PlanPromptKind | null {
  return message === null ? null : kind;
}

export function openPlanPrompt(next: string): void {
  message = next;
  kind = 'limit';
  emit();
}

export function openWelcomePlanPrompt(): void {
  message = WELCOME_PLAN_MESSAGE;
  kind = 'welcome';
  emit();
}

export function closePlanPrompt(): void {
  if (message === null) return;
  if (kind === 'welcome') storage()?.removeItem(WELCOME_PLAN_KEY);
  message = null;
  kind = 'limit';
  emit();
}

export function subscribePlanPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
