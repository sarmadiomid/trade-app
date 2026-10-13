import type { Candle } from '@/lib/core';
import { ExecutionEngine } from '../execution/engine';
import type { AccountConfig, AccountState } from '../execution/types';
import type { LoggedAction } from '../session/model';

/**
 * Re-runs a session from scratch: the initial account, then the 1-minute bars in order, with
 * each logged action applied at the replay time it was taken. Deterministic, so rewinding
 * gives exactly the state the trader had at that time.
 */
export function resimulate(
  cfg: AccountConfig,
  initial: AccountState,
  actions: readonly LoggedAction[],
  minutes: readonly Candle[],
  until: number,
): ExecutionEngine {
  const engine = new ExecutionEngine(cfg, structuredClone(initial));
  let a = 0;
  const applyUpTo = (t: number) => {
    while (a < actions.length && actions[a]!.t <= t) {
      // Market orders take the replay time the trader acted at (it may be past the last bar).
      engine.state.time = Math.max(engine.state.time, actions[a]!.t);
      engine.apply(actions[a]!.a);
      a += 1;
    }
  };
  for (const bar of minutes) {
    if (bar.time >= until) break;
    applyUpTo(bar.time);
    engine.processBar(bar);
    if (engine.state.status !== 'active') break;
  }
  if (engine.state.status === 'active') {
    engine.state.time = Math.max(engine.state.time, until);
    applyUpTo(until);
  }
  return engine;
}
