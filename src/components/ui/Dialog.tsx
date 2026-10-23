'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface DialogProps {
  readonly title: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  /** Replaces the default title bar (include your own close control). */
  readonly header?: ReactNode;
  readonly width?: number;
  readonly initialFocus?: string;
  /** Extra classes on the panel. Use to pin a dialog to its own palette. */
  readonly className?: string;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Accessible modal: focus trap, Escape to close, restores focus, backdrop click closes. */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  header,
  width = 560,
  initialFocus,
  className = '',
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first =
      (initialFocus ? el?.querySelector<HTMLElement>(initialFocus) : null) ??
      el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (n) => !n.hasAttribute('disabled'),
      );
      if (items.length === 0) return;
      const a = items[0]!;
      const b = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    // Bubble, not capture: a nested popover (the Jalali calendar) listens on capture
    // and stops Escape so it closes itself without dismissing the dialog.
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [initialFocus]);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade items-center justify-center bg-black/70 p-3 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        style={{ width }}
        className={`flex max-h-[min(90vh,780px)] max-w-full animate-pop flex-col overflow-hidden rounded-2xl border border-[var(--dlg-line,var(--tc-border))] bg-[var(--dlg-bg,var(--tc-panel))] text-[var(--dlg-fg,var(--tc-text))] shadow-[0_24px_80px_rgba(0,0,0,0.85)] ${className}`}
      >
        {header ?? (
          <div className="flex h-13 shrink-0 items-center justify-between border-b border-[var(--dlg-line,var(--tc-border))] ps-5 pe-3">
            <h2 className="truncate text-[16px] font-bold">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-hover hover:text-fg"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        {footer ? (
          <div className="flex shrink-0 items-center gap-2 border-t border-[var(--dlg-line,var(--tc-border))] px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
