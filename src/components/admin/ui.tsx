'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ApiError, api } from '@/components/platform/api';

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
  return { data, error, loading: loadedKey !== key, reload };
}

export function PageHead({
  kicker,
  title,
  text,
}: {
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
}) {
  return (
    <header className="mb-6 max-w-3xl">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--a-gold)]">{kicker}</p>
      <h2 className="mt-1 text-[26px] font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-[14px] leading-7 text-[var(--a-muted)]">{text}</p>
    </header>
  );
}

export function Panel({
  children,
  className = '',
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--a-line)] bg-[var(--a-card)] ${className}`}
    >
      {children}
    </section>
  );
}

export function Notice({
  tone,
  children,
}: {
  readonly tone: 'ok' | 'bad';
  readonly children: string;
}) {
  return (
    <p
      role="alert"
      className={`rounded-xl px-3 py-2 text-[13px] ${
        tone === 'ok' ? 'bg-[#3dcea0]/10 text-[#8ef0cf]' : 'bg-[#ff6b81]/10 text-[#ffb3bf]'
      }`}
    >
      {children}
    </p>
  );
}

export const fieldClass =
  'h-11 w-full rounded-xl border border-white/10 bg-[#0c1018] px-3 text-[13.5px] text-[var(--a-text)] outline-none transition placeholder:text-[#667085] focus:border-[#3b78ff]';

export const labelClass = 'mb-1.5 block text-[12px] font-medium text-[var(--a-muted)]';
