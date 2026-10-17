import { WIN_CONDITIONS, type BattleStatus, type WinCondition } from '@/lib/battles';

export const STATUS: Readonly<Record<BattleStatus, readonly [string, string]>> = {
  standby: ['Standby', 'bg-[#f5c451]/15 text-[#f5c451]'],
  countdown: ['Starting', 'bg-accent/15 text-accent'],
  live: ['In Progress', 'bg-up/15 text-up'],
  paused: ['Paused', 'bg-[#f5c451]/15 text-[#f5c451]'],
  completed: ['Completed', 'bg-hover text-muted'],
  cancelled: ['Cancelled', 'bg-hover text-muted'],
};

export const winConditionName = (w: WinCondition) => WIN_CONDITIONS[w].name;

/** "+1.25%" / "−0.40%" / "0.00%". */
export const signedPct = (v: number, decimals = 2) => {
  const r = Math.abs(v) < 0.5 * 10 ** -decimals ? 0 : v;
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(decimals)}%`;
};

export const pctClass = (v: number) =>
  v > 0.004 ? 'text-up' : v < -0.004 ? 'text-down' : 'text-muted';

/** $100K, $2.5M, $5,000. */
export function compactMoney(v: number): string {
  if (v >= 1e6) return `$${+(v / 1e6).toFixed(2)}M`;
  if (v >= 1e4) return `$${+(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString('en-US')}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`;

/** "5m ago", "2h ago", "3d ago". */
export function ago(t: number, now: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const ASSET_COLORS: Readonly<Record<string, string>> = {
  XAUUSD: '#f2c14e',
  EURUSD: '#5b8cff',
  GBPUSD: '#b07cff',
  AUDUSD: '#45d6c4',
  NAS100: '#ff7a59',
};
