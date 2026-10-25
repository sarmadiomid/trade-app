'use client';

import { useSyncExternalStore } from 'react';
import { installPlan, normalizePlan, type PlanId } from '@/lib/app';

export interface PlanUsage {
  readonly sessions: number;
  readonly sessionLimit: number | null;
  readonly battles: number;
  readonly battleLimit: number | null;
  readonly strategyTags: number;
  readonly strategyTagLimit: number | null;
}

interface PlanState {
  readonly ready: boolean;
  readonly plan: PlanId;
  readonly usage: PlanUsage;
}

const EMPTY_USAGE: PlanUsage = {
  sessions: 0,
  sessionLimit: 2,
  battles: 0,
  battleLimit: 1,
  strategyTags: 0,
  strategyTagLimit: 0,
};

let state: PlanState = { ready: false, plan: 'beginner', usage: EMPTY_USAGE };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void loadPlan();
  return () => listeners.delete(listener);
}

export function loadPlan(): Promise<void> {
  if (state.ready) return Promise.resolve();
  if (!inflight) {
    inflight = fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) =>
        res.ok ? ((await res.json()) as { plan?: unknown; usage?: PlanUsage }) : null,
      )
      .then((body) => {
        const plan = normalizePlan(body?.plan);
        state = {
          ready: true,
          plan,
          usage: body?.usage ?? {
            ...EMPTY_USAGE,
            sessionLimit: null,
            battleLimit: null,
            strategyTagLimit: null,
          },
        };
        installPlan(plan);
        emit();
      })
      .catch(() => {
        state = { ready: true, plan: 'beginner', usage: EMPTY_USAGE };
        installPlan('beginner');
        emit();
      });
  }
  return inflight;
}

export function applyPlan(plan: PlanId, usage?: PlanUsage): void {
  state = { ready: true, plan, usage: usage ?? state.usage };
  installPlan(plan);
  inflight = Promise.resolve();
  emit();
}

export async function refreshPlan(): Promise<void> {
  inflight = null;
  state = { ...state, ready: false };
  emit();
  await loadPlan();
}

export function usePlan(): PlanId {
  return useSyncExternalStore(
    subscribe,
    () => state.plan,
    () => 'beginner',
  );
}

export function usePlanReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.ready,
    () => false,
  );
}

export function usePlanUsage(): PlanUsage {
  return useSyncExternalStore(
    subscribe,
    () => state.usage,
    () => EMPTY_USAGE,
  );
}
