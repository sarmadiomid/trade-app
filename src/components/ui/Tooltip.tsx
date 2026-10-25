'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  readonly label: string;
  readonly shortcut?: string | undefined;
  readonly side?: 'bottom' | 'right' | 'top';
  readonly children: ReactNode;
}

const SHOW_DELAY = 300;
const GAP = 8;

/**
 * Label shown on hover or focus. Portalled so it is not clipped by, and does not
 * widen, overflow toolbars (the drawing rail in particular).
 */
export function Tooltip({ label, shortcut, side = 'bottom', children }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const hover = useRef(false);
  const focus = useRef(false);
  const timer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const sync = () => {
    clearTimer();
    if (hover.current || focus.current) {
      timer.current = window.setTimeout(() => setOpen(true), SHOW_DELAY);
      return;
    }
    setOpen(false);
    setPos(null);
  };

  useEffect(() => clearTimer, []);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;

    const place = () => {
      const a = anchor.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      let top = a.bottom + GAP;
      let left = a.left + (a.width - t.width) / 2;
      if (side === 'right') {
        top = a.top + (a.height - t.height) / 2;
        left = a.right + GAP;
        if (left + t.width > window.innerWidth - GAP) left = a.left - t.width - GAP;
      } else if (side === 'top') {
        top = a.top - t.height - GAP;
        if (top < GAP) top = a.bottom + GAP;
      } else if (top + t.height > window.innerHeight - GAP) {
        top = a.top - t.height - GAP;
      }
      left = Math.max(GAP, Math.min(left, window.innerWidth - t.width - GAP));
      top = Math.max(GAP, Math.min(top, window.innerHeight - t.height - GAP));
      setPos({ top, left });
    };

    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, side, label, shortcut]);

  return (
    <span
      ref={anchorRef}
      className="relative inline-flex"
      onMouseEnter={() => {
        hover.current = true;
        sync();
      }}
      onMouseLeave={() => {
        hover.current = false;
        sync();
      }}
      onFocus={() => {
        focus.current = true;
        sync();
      }}
      onBlur={() => {
        focus.current = false;
        sync();
      }}
    >
      {children}
      {open
        ? createPortal(
            <span
              ref={tipRef}
              role="tooltip"
              style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
              className="pointer-events-none fixed z-70 whitespace-nowrap rounded-md bg-[#0b0e14f2] px-2 py-1 text-xs text-white shadow-lg"
            >
              {label}
              {shortcut ? (
                <span dir="ltr" className="ms-2 text-[#9aa0ab]">
                  {shortcut}
                </span>
              ) : null}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
