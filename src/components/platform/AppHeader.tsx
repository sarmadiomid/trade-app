'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { formatIranianMobile } from '@/auth/phone';
import { BRAND_EN, BrandName, LogoMark } from '../marketing/Logo';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import { Popover } from '../ui/Popover';
import { api, type Me } from './api';

export const NAV: ReadonlyArray<{ href: string; label: string; icon: IconName }> = [
  { href: '/home', label: 'Home', icon: 'home' },
  { href: '/chart', label: 'Chart', icon: 'chart' },
  { href: '/backtest', label: 'Backtest', icon: 'replay' },
  { href: '/battle', label: 'Battles', icon: 'bolt' },
];

const NAV_FA: ReadonlyArray<{ href: string; label: string; icon: IconName }> = [
  { href: '/home', label: 'خانه', icon: 'home' },
  { href: '/chart', label: 'نمودار', icon: 'chart' },
  { href: '/backtest', label: 'بک‌تست', icon: 'replay' },
  { href: '/battle', label: 'نبردها', icon: 'bolt' },
];

/** First letters of a display name, for the avatar. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

/** Top bar of the signed-in platform pages: logo, the four sections and the account menu. */
export function AppHeader({
  user,
  end,
  fa = false,
}: {
  readonly user?: Me;
  readonly end?: ReactNode;
  /** Persian labels. The backtest pages turn the document RTL around this bar. */
  readonly fa?: boolean;
}) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(user ?? null);
  useEffect(() => {
    if (!user) void api<Me>('/api/me').then(setMe, () => {});
  }, [user]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 sm:px-6">
        <Link
          href="/home"
          className="me-2 flex shrink-0 items-center gap-2"
          aria-label={fa ? `خانه ${BRAND_EN}` : `${BRAND_EN} home`}
        >
          <LogoMark size={28} />
          <BrandName className="hidden text-[15px] font-bold sm:inline" />
        </Link>
        <nav aria-label={fa ? 'بخش‌ها' : 'Sections'} className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {(fa ? NAV_FA : NAV).map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition sm:px-3 ${
                  active ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-hover hover:text-fg'
                }`}
              >
                <Icon name={n.icon} size={15} />
                <span className="hidden md:inline">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        {end}
        {me ? <UserMenu me={me} fa={fa} /> : <div className="h-8 w-8 rounded-full bg-hover" />}
      </div>
    </header>
  );
}

const ITEM =
  'flex h-8 w-full items-center gap-2 rounded-md px-2 text-start text-[13px] hover:bg-hover disabled:opacity-50';

function UserMenu({ me, fa }: { readonly me: Me; readonly fa: boolean }) {
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const logout = async () => {
    setLeaving(true);
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    router.replace('/');
    router.refresh();
  };
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label={fa ? 'حساب' : 'Account'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full py-1 pe-2 ps-1 transition hover:bg-hover"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#4a8dff] to-[#1f5fe6] text-[11px] font-bold text-white">
          {initials(me.name)}
        </span>
        <span className="hidden max-w-32 truncate text-[13px] font-medium lg:inline">
          {me.name}
        </span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open ? (
        <Popover anchor={anchor} onClose={() => setOpen(false)}>
          <div className="flex w-60 flex-col gap-0.5">
            <div className="px-2 pb-2 pt-1">
              <div className="truncate text-[13px] font-semibold">{me.name}</div>
              <div className="mt-0.5 font-mono text-[12px] text-muted" dir="ltr">
                {formatIranianMobile(me.phone)}
              </div>
            </div>
            <div className="border-t border-line pt-1">
              <Link href="/battle?tab=profile" className={ITEM} onClick={() => setOpen(false)}>
                <Icon name="user" size={15} />
                {fa ? 'پروفایل نبرد' : 'Battle profile'}
              </Link>
              <Link href="/" className={ITEM} onClick={() => setOpen(false)}>
                <Icon name="chevronLeft" size={15} className="rtl:-scale-x-100" />
                {fa ? (
                  <>
                    وب‌سایت <BrandName />
                  </>
                ) : (
                  <>
                    <BrandName /> website
                  </>
                )}
              </Link>
              <button type="button" className={ITEM} disabled={leaving} onClick={logout}>
                <Icon name="logout" size={15} />
                {leaving ? (fa ? 'در حال خروج…' : 'Signing out…') : fa ? 'خروج' : 'Sign out'}
              </button>
            </div>
          </div>
        </Popover>
      ) : null}
    </>
  );
}
