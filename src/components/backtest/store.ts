'use client';

import { create } from 'zustand';
import type { BacktestSnapshot, RewindCheck } from '@/lib/app';
import type { AccountStatus, Side } from '@/lib/backtest';

export type TicketType = 'market' | 'limit' | 'stop';

export interface TicketState {
  readonly side: Side;
  readonly type: TicketType;
  readonly price?: number;
}

type Modal =
  | { readonly type: 'completed'; readonly status: AccountStatus; readonly reason: string }
  | { readonly type: 'confirm-rewind'; readonly time: number; readonly check: RewindCheck }
  | { readonly type: 'go-to' }
  | { readonly type: 'settings' }
  | { readonly type: 'shortcuts' }
  | { readonly type: 'partial-close'; readonly positionId: string }
  | { readonly type: 'edit-position'; readonly positionId: string }
  | { readonly type: 'edit-order'; readonly orderId: string };

interface BacktestUiState {
  readonly snap: BacktestSnapshot | null;
  readonly ticket: TicketState | null;
  readonly tab: 'positions' | 'orders' | 'history';
  readonly propOpen: boolean;
  readonly modal: Modal | null;
  setSnap(snap: BacktestSnapshot | null): void;
  openTicket(t: TicketState | null): void;
  setTab(tab: BacktestUiState['tab']): void;
  toggleProp(open?: boolean): void;
  openModal(m: Modal | null): void;
}

/** UI-only state of the backtest view (the session itself lives in the controller). */
export const useBacktestStore = create<BacktestUiState>((set) => ({
  snap: null,
  ticket: null,
  tab: 'positions',
  propOpen: false,
  modal: null,
  setSnap: (snap) => set({ snap }),
  openTicket: (ticket) => set({ ticket }),
  setTab: (tab) => set({ tab }),
  toggleProp: (open) => set((s) => ({ propOpen: open ?? !s.propOpen })),
  openModal: (modal) => set({ modal }),
}));
