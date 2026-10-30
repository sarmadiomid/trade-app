'use client';

import Link from 'next/link';
import { HOME_ICONS, HomeShell, ShellMenuButton, ShellTools } from './HomeShell';
import type { Me } from '../platform/api';
import { Icon } from '../ui/Icon';

/** `/home/learn`: lessons are not open yet. Same shell as practice, no chart. */
export function LearnSoon({ user }: { readonly user: Me }) {
  return (
    <HomeShell user={user} notices={0} noticeMenu={null}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-4 pt-5 sm:px-8">
          <div className="flex items-center gap-2">
            <ShellMenuButton />
            <h1 className="text-[26px] font-bold sm:text-[30px]">آموزش</h1>
          </div>
          <ShellTools />
        </header>

        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="flex max-w-md flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] text-[var(--h-accent)]">
              <Icon path={HOME_ICONS.book} size={28} />
            </span>
            <span className="mt-5 rounded-md border border-[var(--h-line)] bg-[var(--h-chip)] px-2.5 py-1 text-[12px] font-bold text-[var(--h-muted)]">
              به زودی
            </span>
            <h2 className="mt-4 text-[28px] font-extrabold leading-tight">درس نموداری به‌زودی</h2>
            <p className="mt-3 text-[15px] leading-8 text-[var(--h-muted)]">
              درس‌های تعاملی روی نمودار هنوز داخل حساب باز نشده‌اند. فعلاً راهنماهای عمومی و مرکز
              آموزش را بخوانید، یا از بخش تمرین روی گذشتهٔ بازار کار کنید.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/lessons"
                className="inline-flex h-10 items-center rounded-lg bg-[var(--h-accent)] px-4 text-[13.5px] font-semibold text-white"
              >
                مرکز آموزش
              </Link>
              <Link
                href="/guides"
                className="inline-flex h-10 items-center rounded-lg border border-[var(--h-line)] px-4 text-[13.5px] font-semibold text-[var(--h-text)]"
              >
                راهنماها
              </Link>
              <Link
                href="/home"
                className="inline-flex h-10 items-center rounded-lg px-4 text-[13.5px] font-semibold text-[var(--h-muted)]"
              >
                برگشت به تمرین
              </Link>
            </div>
          </div>
        </div>
      </div>
    </HomeShell>
  );
}
