'use client';

import { useUiStore } from '../../state/ui-store';
import { TimeframeScrubber } from './TimeframeScrubber';

/** Symbol and the drag-to-change interval control, for chart pages without a custom phone bar. */
export function MobileTimeDock() {
  const symbol = useUiStore((s) => s.symbol?.symbol ?? '');
  return (
    <div className="flex h-14 w-full items-center gap-2 bg-chart px-3 pb-[env(safe-area-inset-bottom)]">
      <span className="shrink-0 text-[15px] font-semibold tracking-tight text-fg">{symbol}</span>
      <TimeframeScrubber />
    </div>
  );
}
