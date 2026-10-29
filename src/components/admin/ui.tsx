'use client';

import { useCallback, useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import { ApiError, api } from '@/components/platform/api';

/* ------------------------------------------------------------------ */
/* Data hook                                                           */
/* ------------------------------------------------------------------ */

export function useAdminQuery<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = `${url}#${tick}`;
  useEffect(() => {
    let live = true;
    void api<T>(url)
      .then((next) => {
        if (!live) return;
        setData(next);
        setError('');
        setLoadedKey(`${url}#${tick}`);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setData(null);
        setError(e instanceof ApiError ? e.message : 'ارتباط برقرار نشد');
        setLoadedKey(`${url}#${tick}`);
      });
    return () => {
      live = false;
    };
  }, [url, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  const loading = loadedKey !== key;
  return {
    data,
    error,
    loading,
    /** True while re-fetching with data already on screen (search, reload). */
    refreshing: loading && data !== null,
    reload,
  };
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function PageHead({
  kicker,
  title,
  text,
  actions,
}: {
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
  /** Optional slot for page-level buttons, shown opposite the title. */
  readonly actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="max-w-3xl">
        <p className="flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.16em] text-[var(--a-gold)]">
          <span aria-hidden="true" className="h-px w-6 bg-[var(--a-gold)]/60" />
          {kicker}
        </p>
        <h2 className="mt-2 text-[26px] font-bold leading-tight tracking-tight sm:text-[28px]">
          {title}
        </h2>
        <p className="mt-2.5 text-[14px] leading-7 text-[var(--a-muted)]">{text}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  children,
  className = '',
  ...rest
}: {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  return (
    <section
      {...rest}
      className={`rounded-2xl border border-[var(--a-line)] bg-[var(--a-card)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_10px_28px_-18px_rgba(0,0,0,0.65)] ${className}`}
    >
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export function Notice({
  tone,
  children,
}: {
  readonly tone: 'ok' | 'bad';
  readonly children: ReactNode;
}) {
  const ok = tone === 'ok';
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] leading-6 ${
        ok
          ? 'border-[#3dcea0]/25 bg-[#3dcea0]/10 text-[#8ef0cf]'
          : 'border-[#ff6b81]/25 bg-[#ff6b81]/10 text-[#ffb3bf]'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mt-1 h-4 w-4 shrink-0"
      >
        {ok ? (
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        ) : (
          <>
            <path d="M12 4 3 19.5h18z" />
            <path d="M12 10v4.5M12 17.2h.01" />
          </>
        )}
      </svg>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { readonly className?: string }) {
  return (
    <div aria-hidden="true" className={`animate-pulse rounded-md bg-white/[0.06] ${className}`} />
  );
}

export function Spinner({ className = 'h-4 w-4' }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.22" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Form styles                                                         */
/* ------------------------------------------------------------------ */

export const fieldClass =
  'h-11 w-full rounded-xl border border-white/10 bg-[#0c1018] px-3 text-[13.5px] text-[var(--a-text)] [color-scheme:dark] outline-none transition placeholder:text-[#667085] hover:border-white/20 focus:border-[#3b78ff] focus:ring-4 focus:ring-[#3b78ff]/15 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-white/10 aria-[invalid=true]:border-[#ff6b81]/60 aria-[invalid=true]:focus:ring-[#ff6b81]/15';

export const labelClass = 'mb-1.5 block text-[12px] font-medium text-[var(--a-muted)]';
