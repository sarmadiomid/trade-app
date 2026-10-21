'use client';

import { create } from 'zustand';
import type { BacktestSnapshot, RewindCheck } from '@/lib/app';
import type { Side } from '@/lib/backtest';

export type TicketType = 'market' | 'limit' | 'stop';

export interface TicketState {
  readonly side: Side;
  readonly type: TicketType;
  readonly price?: number;
}

type Modal =
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
  readonly panelHidden: boolean;
  readonly modal: Modal | null;
  /** Phone replay deck is open in place of the session bar. */
  readonly replayDeck: boolean;
  setReplayDeck(open: boolean): void;
  setSnap(snap: BacktestSnapshot | null): void;
  openTicket(t: TicketState | null): void;
  setTab(tab: BacktestUiState['tab']): void;
  toggleProp(open?: boolean): void;
  setPanelHidden(hidden: boolean): void;
  openModal(m: Modal | null): void;
}

/** UI-only state of the backtest view (the session itself lives in the controller). */
export const useBacktestStore = create<BacktestUiState>((set) => ({
  snap: null,
  ticket: null,
  tab: 'positions',
  propOpen: false,
  panelHidden: false,
  modal: null,
  replayDeck: false,
  setReplayDeck: (replayDeck) => set({ replayDeck }),
  setSnap: (snap) => set({ snap }),
  openTicket: (ticket) => set({ ticket }),
  setTab: (tab) => set({ tab }),
  toggleProp: (open) => set((s) => ({ propOpen: open ?? !s.propOpen })),
  setPanelHidden: (panelHidden) => set({ panelHidden }),
  openModal: (modal) => set({ modal }),
}));
