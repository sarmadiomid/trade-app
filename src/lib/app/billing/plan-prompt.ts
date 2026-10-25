/**
 * The upgrade modal's open message. UI subscribes; anything that hits a plan
 * limit (a click, a guard, or a server rejection) can open it without React.
 */
let message: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function planPrompt(): string | null {
  return message;
}

export function openPlanPrompt(next: string): void {
  message = next;
  emit();
}

export function closePlanPrompt(): void {
  if (message === null) return;
  message = null;
  emit();
}

export function subscribePlanPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
