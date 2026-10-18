import type { BattleStatus, WinCondition } from '@/lib/battles';
import { WIN_FA } from './fa';

export const STATUS: Readonly<Record<BattleStatus, readonly [string, string]>> = {
  standby: ['در انتظار', 'bg-[#f5c451]/15 text-[#f5c451]'],
  countdown: ['شروع', 'bg-accent/15 text-accent'],
  live: ['در جریان', 'bg-up/15 text-up'],
  paused: ['متوقف', 'bg-[#f5c451]/15 text-[#f5c451]'],
  completed: ['تمام‌شده', 'bg-hover text-muted'],
  cancelled: ['لغوشده', 'bg-hover text-muted'],
};

export const winConditionName = (w: WinCondition) => WIN_FA[w].name;

export const pctClass = (v: number) =>
  v > 0.004 ? 'text-up' : v < -0.004 ? 'text-down' : 'text-muted';

export {
  ago,
  battleTitle,
  clockFa,
  compactMoney,
  faChat,
  faEndReason,
  faMessage,
  faReason,
  minutes,
  placeWord as ordinal,
  rankLabel,
  RANK_FA,
  signed,
  signedPct,
  traders,
  WIN_FA,
} from './fa';

export const ASSET_COLORS: Readonly<Record<string, string>> = {
  XAUUSD: '#f2c14e',
  EURUSD: '#5b8cff',
  GBPUSD: '#b07cff',
  AUDUSD: '#45d6c4',
  NAS100: '#ff7a59',
};
