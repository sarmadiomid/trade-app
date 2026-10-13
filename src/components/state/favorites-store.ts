import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import type { StorageAdapter } from '@/lib/core';

export interface FavoritesState {
  /** Favorite drawing tool ids, in toolbar order. */
  tools: string[];
  visible: boolean;
  vertical: boolean;
  /** Top-left offset inside the chart area; null keeps the default placement. */
  pos: { x: number; y: number } | null;
}

interface FavoritesActions {
  toggle(id: string): void;
  move(id: string, toIndex: number): void;
  setVisible(visible: boolean): void;
  setVertical(vertical: boolean): void;
  setPos(pos: { x: number; y: number } | null): void;
}

type Persisted = Pick<FavoritesState, 'tools' | 'visible' | 'vertical' | 'pos'>;

let adapter: StorageAdapter | null = null;

const storage: PersistStorage<Persisted> = {
  getItem: async (name) =>
    ((await adapter?.get(name)) as StorageValue<Persisted> | undefined) ?? null,
  setItem: (name, value) => adapter?.set(name, value),
  removeItem: (name) => adapter?.remove(name),
};

export const useFavoritesStore = create<FavoritesState & FavoritesActions>()(
  persist(
    (set) => ({
      tools: [],
      visible: true,
      vertical: false,
      pos: null,
      toggle: (id) =>
        set((s) =>
          s.tools.includes(id)
            ? { tools: s.tools.filter((t) => t !== id) }
            : { tools: [...s.tools, id], visible: true },
        ),
      move: (id, toIndex) =>
        set((s) => {
          const tools = s.tools.filter((t) => t !== id);
          tools.splice(Math.max(0, Math.min(tools.length, toIndex)), 0, id);
          return { tools };
        }),
      setVisible: (visible) => set({ visible }),
      setVertical: (vertical) => set({ vertical }),
      setPos: (pos) => set({ pos }),
    }),
    {
      name: 'drawing-favorites',
      version: 1,
      storage,
      skipHydration: true,
      partialize: ({ tools, visible, vertical, pos }) => ({ tools, visible, vertical, pos }),
    },
  ),
);

/** Persists favorites through `next` (null keeps them in memory only) and loads them from it. */
export async function bindFavoritesStorage(next: StorageAdapter | null): Promise<void> {
  adapter = next;
  if (next) await useFavoritesStore.persist.rehydrate();
}
