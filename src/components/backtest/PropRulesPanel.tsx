'use client';

import { Icon } from '../ui/Icon';
import { money } from './format';
import { useBacktestStore } from './store';

/** FX Replay's Prop Firm Rules panel (Tab): progress of each rule with pass / fail. */
export function PropRulesPanel() {
  const snap = useBacktestStore((s) => s.snap);
  const open = useBacktestStore((s) => s.propOpen);
  const toggle = useBacktestStore((s) => s.toggleProp);
  if (!open || !snap?.prop) return null;
  const p = snap.prop;
  const failed = snap.status === 'failed';
  const rules = [
    {
      label: 'Profit target',
      value: Math.max(0, p.profit),
      limit: p.profitTarget,
      state: snap.targetReached ? 'passed' : 'pending',
      good: true,
    },
    {
      label: 'Max daily loss',
      value: p.dailyLoss,
      limit: p.dailyLimit,
      state: failed && snap.failReason?.startsWith('Max daily') ? 'failed' : 'ok',
      good: false,
    },
    {
      label: 'Max total loss',
      value: p.totalLoss,
      limit: p.totalLimit,
      state: failed && snap.failReason?.startsWith('Max total') ? 'failed' : 'ok',
      good: false,
    },
  ] as const;
  return (
    <div
      className="absolute right-3 top-3 z-20 w-72 animate-pop rounded-lg border border-line bg-panel p-3 text-[12.5px] shadow-xl"
      role="dialog"
      aria-label="Prop Firm Rules"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Prop Firm Rules</span>
        <button
          type="button"
          aria-label="Close"
          onClick={() => toggle(false)}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-hover"
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      <p
        className={`mb-2 rounded px-2 py-1 text-center font-semibold ${failed ? 'bg-down/15 text-down' : snap.targetReached ? 'bg-up/15 text-up' : 'bg-hover text-muted'}`}
      >
        {failed ? 'Failed' : snap.targetReached ? 'Passed' : 'In progress'}
      </p>
      {rules.map((r) => {
        const ratio = r.limit > 0 ? Math.min(1, r.value / r.limit) : 0;
        const color =
          r.state === 'failed'
            ? '#f23645'
            : r.good
              ? '#22ab94'
              : ratio > 0.8
                ? '#ff9800'
                : '#787b86';
        return (
          <div key={r.label} className="mb-2">
            <div className="flex justify-between">
              <span>{r.label}</span>
              <span className="tabular-nums text-muted">
                {money(r.value)} / {money(r.limit)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full" style={{ width: `${ratio * 100}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
