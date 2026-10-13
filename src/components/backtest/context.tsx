'use client';

import { createContext, useContext } from 'react';
import type { BacktestController } from '@/lib/app';

export const BacktestContext = createContext<BacktestController | null>(null);

/** The session's controller. Only use below <BacktestContext.Provider> once it exists. */
export function useBacktest(): BacktestController {
  const c = useContext(BacktestContext);
  if (!c) throw new Error('useBacktest() called outside of an opened session');
  return c;
}
