'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { formatIranianMobile } from '@/auth/phone';
import { LogoMark } from '@/components/marketing/Logo';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icons';
import { api } from '@/components/platform/api';
import { faNum } from '@/lib/locale/jalali';

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: IconName;
  /** Show the open-ticket count next to this item. */
  readonly badge?: 'tickets';
}

const NAV_GROUPS: ReadonlyArray<{ label: string | null; items: readonly NavItem[] }> = [
  {
    label: null,
    items: [{ href: '/admin', label: 'نمای کلی', hint: 'وضعیت پلتفرم', icon: 'grid' }],
  },
  {
    label: 'مدیریت',
    items: [
      { href: '/admin/users', label: 'کاربران', hint: 'طرح و مصرف', icon: 'user' },
      {
        href: '/admin/support',
        label: 'پشتیبانی',
        hint: 'صندوق درخواست‌ها',
        icon: 'chat',
        badge: 'tickets',
      },
      { href: '/admin/discounts', label: 'تخفیف‌ها', hint: 'کدهای پرداخت', icon: 'tag' },
    ],
  },
  {
    label: 'بازار و تمرین',
    items: [
      { href: '/admin/symbols', label: 'نمادها', hint: 'قرارداد و داده', icon: 'chart' },
      { href: '/admin/sessions', label: 'تمرین‌ها', hint: 'جلسه‌های بک‌تست', icon: 'replay' },
      { href: '/admin/battles', label: 'نبردها', hint: 'اتاق‌های اخیر', icon: 'swords' },
    ],
  },
];

const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b78ff]/60';

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Open-ticket count for the nav badge. Silent on failure; refreshed on navigation and every minute. */
function useOpenTickets(pathname: string): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      void api<{ openTickets: number }>('/api/admin/overview')
        .then((data) => {
          if (live) setCount(data.openTickets);
        })
        .catch(() => {
          /* the badge is a convenience; stay quiet */
        });
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [pathname]);
  return count;
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function BrandMark() {
  return <LogoMark size={40} />;
}

function Avatar({ name }: { readonly name: string }) {
  const initial = Array.from(name.trim())[0] ?? 'م';
  return (
    <span
      aria-hidden="true"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#3b78ff]/30 to-[#9b7bff]/25 text-[14px] font-semibold text-[#cfdcff] ring-1 ring-white/10"
    >
      {initial}
    </span>
  );
}

function TicketBadge({ count }: { readonly count: number | null }) {
  if (!count || count <= 0) return null;
  return (
    <span
      aria-label={`${faNum(count)} درخواست باز`}
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#f5b544]/15 px-1.5 text-[11px] font-semibold tabular-nums text-[#f7c46a] ring-1 ring-[#f5b544]/30"
    >
      {count > 99 ? `${faNum(99)}+` : faNum(count)}
    </span>
  );
}

function NavLink({
  item,
  active,
  openTickets,
  onNavigate,
}: {
  readonly item: NavItem;
  readonly active: boolean;
  readonly openTickets: number | null;
  readonly onNavigate?: (() => void) | undefined;
}) {
  return (
    <Link
      href={item.href}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      {...(active ? { 'aria-current': 'page' as const } : {})}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 transition ${FOCUS_RING} ${
        active
          ? 'bg-[#3b78ff]/[0.14] text-white'
          : 'text-[var(--a-muted)] hover:bg-white/5 hover:text-[var(--a-text)]'
      }`}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2.5 start-0 w-0.5 rounded-full bg-[#3b78ff]"
        />
      ) : null}
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
          active
            ? 'bg-[var(--a-accent)] text-white shadow-[0_6px_14px_-6px_rgba(59,120,255,0.9)]'
            : 'bg-white/[0.04] group-hover:bg-white/[0.08]'
        }`}
      >
        <Icon name={item.icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold leading-5">{item.label}</span>
        <span
          className={`block truncate text-[11px] ${active ? 'text-white/70' : 'text-[var(--a-muted)]'}`}
        >
          {item.hint}
        </span>
      </span>
      {item.badge === 'tickets' ? <TicketBadge count={openTickets} /> : null}
    </Link>
  );
}

function SidebarContent({
  pathname,
  name,
  phone,
  openTickets,
  drawer = false,
  closeRef,
  onNavigate,
  onClose,
}: {
  readonly pathname: string;
  readonly name: string;
  readonly phone: string;
  readonly openTickets: number | null;
  readonly drawer?: boolean;
  readonly closeRef?: RefObject<HTMLButtonElement | null>;
  readonly onNavigate?: () => void;
  readonly onClose?: () => void;
}) {
  const Title = drawer ? 'div' : 'h1';
  return (
    <>
      <div className="border-b border-[var(--a-line)] px-4 pb-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.22em] text-[var(--a-gold)]">
                CANDELO
              </p>
              <Title className="text-[16px] font-bold leading-tight">پنل مدیریت</Title>
            </div>
          </div>
          {drawer ? (
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="بستن منو"
              className={`grid h-9 w-9 place-items-center rounded-lg text-[var(--a-muted)] transition hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--a-line)] bg-white/[0.03] p-3">
          <Avatar name={name} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{name || 'مدیر'}</p>
            <p
              dir="ltr"
              className="truncate text-end font-mono text-[11.5px] text-[var(--a-muted)]"
            >
              {formatIranianMobile(phone)}
            </p>
          </div>
        </div>
      </div>

      <nav aria-label="منوی مدیریت" className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label ?? `group-${index}`}>
            {group.label ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-[var(--a-muted)]/80">
                {group.label}
              </p>
            ) : null}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  openTickets={openTickets}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--a-line)] p-3">
        <Link
          href="/home"
          {...(onNavigate ? { onClick: onNavigate } : {})}
          className={`flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] text-[var(--a-muted)] transition hover:bg-white/5 hover:text-[var(--a-text)] ${FOCUS_RING}`}
        >
          <Icon name="chevronRight" size={16} />
          بازگشت به کندلو
        </Link>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export function AdminShell({
  name,
  phone,
  children,
}: {
  readonly name: string;
  readonly phone: string;
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const openTickets = useOpenTickets(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  // Close the drawer when the route changes, during render rather than in an effect.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }
  const mainRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const current = NAV_ITEMS.find((item) => isActive(pathname, item.href));

  // Every page change starts at the top. The drawer closes while rendering, above.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Mobile menu: Escape closes it, focus moves in and returns to the button.
  useEffect(() => {
    if (!menuOpen) {
      if (wasOpen.current) {
        wasOpen.current = false;
        menuButtonRef.current?.focus();
      }
      return;
    }
    wasOpen.current = true;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="flex h-full min-h-0">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-[#3b78ff] focus:px-3 focus:py-2 focus:text-[13px] focus:text-white"
      >
        پرش به محتوا
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-[256px] shrink-0 flex-col border-e border-[var(--a-line)] bg-[var(--a-side)] md:flex">
        <SidebarContent pathname={pathname} name={name} phone={phone} openTickets={openTickets} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--a-line)] bg-[var(--a-side)] px-3 md:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="باز کردن منو"
            aria-expanded={menuOpen}
            aria-controls="admin-drawer"
            className={`relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-[#c9d3ea] transition hover:bg-white/[0.07] ${FOCUS_RING}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-[18px] w-[18px]"
            >
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
            {openTickets && openTickets > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#f5b544] ring-2 ring-[var(--a-side)]"
              />
            ) : null}
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold leading-3 tracking-[0.22em] text-[var(--a-gold)]">
              CANDELO
            </p>
            <p className="truncate text-[14px] font-semibold leading-5">
              {current?.label ?? 'پنل مدیریت'}
            </p>
          </div>
        </header>

        <main
          id="admin-main"
          ref={mainRef}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 outline-none sm:px-8"
        >
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>

      {/* Mobile drawer */}
      <div className={`md:hidden ${menuOpen ? '' : 'pointer-events-none'}`} aria-hidden={!menuOpen}>
        <div
          onClick={() => setMenuOpen(false)}
          className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          id="admin-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="منوی مدیریت"
          className={`fixed inset-y-0 start-0 z-50 flex w-[290px] max-w-[88vw] flex-col border-e border-[var(--a-line)] bg-[var(--a-side)] shadow-2xl shadow-black/60 transition-[transform,visibility] duration-200 ${
            menuOpen
              ? 'visible translate-x-0'
              : 'invisible ltr:-translate-x-full rtl:translate-x-full'
          }`}
        >
          <SidebarContent
            drawer
            pathname={pathname}
            name={name}
            phone={phone}
            openTickets={openTickets}
            closeRef={closeRef}
            onNavigate={() => setMenuOpen(false)}
            onClose={() => setMenuOpen(false)}
          />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Access denied                                                       */
/* ------------------------------------------------------------------ */

export function AdminDenied({ phone }: { readonly phone: string }) {
  const display = formatIranianMobile(phone);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; the number stays selectable */
    }
  };

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden px-6 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(59,120,255,0.12),transparent)]"
      />
      <div className="relative w-full max-w-md rounded-3xl border border-[var(--a-line)] bg-[var(--a-card)] p-8 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_24px_60px_-30px_rgba(0,0,0,0.8)]">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#ff6b81]/10 text-[#ff97a7] ring-1 ring-[#ff6b81]/25">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-7 w-7"
          >
            <path d="M12 3 5 6v5.5c0 4.2 2.8 7.6 7 9.5 4.2-1.9 7-5.3 7-9.5V6z" />
            <path d="m9.5 9.5 5 5M14.5 9.5l-5 5" />
          </svg>
        </span>
        <p className="mt-5 text-[11.5px] font-semibold tracking-[0.18em] text-[var(--a-gold)]">
          CANDELO
        </p>
        <h1 className="mt-2 text-[22px] font-bold">دسترسی مدیریت ندارید</h1>
        <p className="mt-3 text-[14px] leading-7 text-[var(--a-muted)]">
          شمارهٔ واردشده در فهرست مدیران نیست.
        </p>

        <div className="mx-auto mt-4 flex max-w-xs items-center justify-between gap-2 rounded-xl border border-[var(--a-line)] bg-white/[0.03] py-2 ps-4 pe-2">
          <span dir="ltr" className="font-mono text-[15px] text-[var(--a-text)]">
            {display}
          </span>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label="کپی شماره"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-[var(--a-muted)] transition hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`h-3.5 w-3.5 ${copied ? 'text-[#8ef0cf]' : ''}`}
            >
              {copied ? (
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              ) : (
                <>
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h8" />
                </>
              )}
            </svg>
            {copied ? 'کپی شد' : 'کپی'}
          </button>
        </div>

        <ol className="mt-6 space-y-3 text-start text-[13.5px] leading-7 text-[var(--a-muted)]">
          {[
            <>
              شمارهٔ بالا را در متغیر <span dir="ltr">ADMIN_PHONES</span> سرور بگذارید.
            </>,
            <>برنامه را دوباره اجرا کنید.</>,
            <>همین صفحه را دوباره باز کنید.</>,
          ].map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-[#b9c6e4] ring-1 ring-white/10">
                {faNum(index + 1)}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <Link
          href="/home"
          className={`mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--a-accent)] px-6 text-[13.5px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(59,120,255,0.8)] transition hover:brightness-110 active:scale-[0.98] ${FOCUS_RING}`}
        >
          بازگشت
        </Link>
      </div>
    </div>
  );
}
