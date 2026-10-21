'use client';

import { useEffect, type ReactNode } from 'react';
import { Icon } from '../../ui/Icon';

/** Bottom sheet used by the phone chart and the backtest session. */
export function MobileSheet({
  title,
  onClose,
  children,
  tall = false,
  footer,
  hideClose = false,
}: {
  readonly title?: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly tall?: boolean;
  readonly footer?: ReactNode;
  /** Title stays, the corner close button is omitted (the body draws its own). */
  readonly hideClose?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Panel'}
        className={`relative flex w-full animate-pop flex-col rounded-t-2xl border border-b-0 border-line bg-panel text-fg shadow-2xl ${
          tall ? 'h-[min(92%,760px)]' : 'max-h-[min(92%,760px)]'
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-fg/25" />
        {title ? (
          <div className="flex items-center justify-between px-4 pb-1 pt-3">
            <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
            {hideClose ? (
              <span className="w-8" />
            ) : (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}
