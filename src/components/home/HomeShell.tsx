'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { formatIranianMobile } from '@/auth/phone';
import { faDigits } from '@/lib/locale/jalali';
import { LogoMark } from '../marketing/Logo';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { initials } from '../platform/AppHeader';
import type { Me } from '../platform/api';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';

const VERSION = faDigits('0.1.0');

export const HOME_ICONS = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  bars: 'M4 19V9M10 19V5M16 19v-6M21 19H3',
  sun: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 0 0 21 14.5z',
  bell: 'M6 16V10a6 6 0 0 1 12 0v6l1.5 2h-15zM10 19a2 2 0 0 0 4 0',
  book: 'M4 5h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM8 5v14',
  flame: 'M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-2 1.2-3.6 1.2-3.6S9 10 10.2 10C10.2 7.5 12 3 12 3z',
} as const;

type Scheme = 'dark' | 'light';
type Menu = 'lang' | 'bell' | 'account';

const NAV: ReadonlyArray<{
  href: string;
  label: string;
  icon: IconName | null;
  path?: string;
  badge?: string;
  badgeTone?: 'new' | 'beta';
}> = [
  { href: '/home', label: 'تمرین', icon: null, path: HOME_ICONS.bars },
  { href: '/chart', label: 'نمودار', icon: 'chart' },
  { href: '/backtest', label: 'استراتژی‌ها', icon: 'target', badge: 'جدید', badgeTone: 'new' },
  { href: '/battle', label: 'نبردها', icon: 'swords', badge: 'بتا', badgeTone: 'beta' },
];

const schemeListeners = new Set<() => void>();
const navListeners = new Set<() => void>();

function subscribe(listeners: Set<() => void>) {
  return (onStoreChange: () => void) => {
    listeners.add(onStoreChange);
    return () => listeners.delete(onStoreChange);
  };
}

const subscribeScheme = subscribe(schemeListeners);
const subscribeNav = subscribe(navListeners);

function readScheme(): Scheme {
  return localStorage.getItem('chartix-home-scheme') === 'light' ? 'light' : 'dark';
}

function readCollapsed(): boolean {
  return localStorage.getItem('chartix-home-nav') === '1';
}

function writeScheme(next: Scheme) {
  localStorage.setItem('chartix-home-scheme', next);
  schemeListeners.forEach((listener) => listener());
}

function writeCollapsed(next: boolean) {
  localStorage.setItem('chartix-home-nav', next ? '1' : '0');
  navListeners.forEach((listener) => listener());
}

interface ShellContextValue {
  readonly scheme: Scheme;
  readonly toggleScheme: () => void;
  readonly openDrawer: () => void;
  readonly menu: Menu | null;
  readonly openMenu: (id: Menu) => void;
  readonly notices: number;
  readonly noticeMenu: ReactNode;
}

const ShellContext = createContext<ShellContextValue | null>(null);

function useShell(): ShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error('Shell controls must render inside HomeShell');
  return value;
}

/** Sidebar and account chrome shared by practice and battles. */
export function HomeShell({
  user,
  notices,
  noticeMenu,
  children,
}: {
  readonly user: Me;
  readonly notices: number;
  readonly noticeMenu: ReactNode;
  readonly children: ReactNode;
}) {
  useThemeCssVars();
  const pathname = usePathname();
  const router = useRouter();
  const scheme = useSyncExternalStore(subscribeScheme, readScheme, () => 'dark' as const);
  const collapsed = useSyncExternalStore(subscribeNav, readCollapsed, () => false);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!menu && !drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(null);
      setDrawer(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest('[data-home-menu]')) setMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, drawer]);

  const toggleScheme = () => writeScheme(scheme === 'dark' ? 'light' : 'dark');
  const toggleNav = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      writeCollapsed(!collapsed);
      return;
    }
    setDrawer((d) => !d);
  };
  const openMenu = (id: Menu) => setMenu((cur) => (cur === id ? null : id));
  const logout = async () => {
    setLeaving(true);
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    router.replace('/');
    router.refresh();
  };

  return (
    <ShellContext.Provider
      value={{
        scheme,
        toggleScheme,
        openDrawer: () => setDrawer(true),
        menu,
        openMenu,
        notices,
        noticeMenu,
      }}
    >
      <div
        data-scheme={scheme}
        lang="fa"
        dir="rtl"
        className="home-shell flex h-full min-h-0 overflow-hidden"
      >
        {drawer ? (
          <button
            type="button"
            aria-label="بستن منو"
            className="fixed inset-0 z-30 bg-black/55 lg:hidden"
            onClick={() => setDrawer(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 start-0 z-40 flex w-[260px] shrink-0 flex-col border-e border-[var(--h-line)] bg-[var(--h-side)] transition-[width,transform] duration-200 lg:relative ${
            drawer ? 'translate-x-0' : 'max-lg:translate-x-full'
          } ${collapsed ? 'lg:w-[76px]' : 'lg:w-[260px]'}`}
        >
          <div
            className={`flex h-16 items-center gap-2.5 px-4 ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
          >
            <button
              type="button"
              aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}
              aria-expanded={drawer || !collapsed}
              onClick={toggleNav}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)]"
            >
              <Icon path={HOME_ICONS.menu} size={18} />
            </button>
            <Link
              href="/home"
              aria-label="خانه چارتیکس"
              className={`flex min-w-0 items-center gap-2 ${collapsed ? 'lg:hidden' : ''}`}
              onClick={() => setDrawer(false)}
            >
              <LogoMark size={26} />
              <span className="truncate text-[16px] font-extrabold tracking-tight">چارتیکس</span>
            </Link>
          </div>

          <div className={`flex flex-col items-center px-4 pb-4 ${collapsed ? 'lg:px-2' : ''}`}>
            <span className="relative">
              <span
                className={`flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#4a5672,#171c28)] font-bold text-white ${
                  collapsed
                    ? 'h-11 w-11 text-[14px] lg:h-11 lg:w-11'
                    : 'h-[72px] w-[72px] text-[22px]'
                }`}
              >
                {initials(user.name)}
              </span>
              <span
                className={`absolute -bottom-1 end-0 rounded-md bg-[var(--h-accent)] font-bold text-white ${
                  collapsed ? 'px-1 py-px text-[8px] lg:hidden' : 'px-1.5 py-0.5 text-[10px]'
                }`}
              >
                رایگان
              </span>
            </span>
            <p
              className={`mt-3 max-w-full truncate text-[13.5px] font-semibold ${collapsed ? 'lg:hidden' : ''}`}
            >
              {user.name}
            </p>
          </div>

          <div className="mx-4 h-px bg-[var(--h-line)]" />

          <nav aria-label="بخش‌ها" className="mt-3 flex flex-col gap-1 px-3">
            {NAV.map((item) => {
              const activeNav =
                pathname === item.href ||
                (item.href !== '/home' && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={activeNav ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setDrawer(false)}
                  className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition ${
                    activeNav
                      ? 'bg-[var(--h-soft)] text-[var(--h-text)]'
                      : 'text-[var(--h-muted)] hover:bg-[var(--h-chip)] hover:text-[var(--h-text)]'
                  } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
                >
                  {item.path ? (
                    <Icon path={item.path} size={18} className="shrink-0" />
                  ) : (
                    <Icon name={item.icon ?? 'chart'} size={18} className="shrink-0" />
                  )}
                  <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                  {item.badge ? (
                    <NavBadge
                      tone={item.badgeTone ?? 'beta'}
                      className={collapsed ? 'lg:hidden' : ''}
                    >
                      {item.badge}
                    </NavBadge>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto px-3 pb-3">
            <div className="mx-1 mb-2 h-px bg-[var(--h-line)]" />
            <Link
              href="/lessons"
              title={collapsed ? 'آموزش' : undefined}
              onClick={() => setDrawer(false)}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)] ${
                collapsed ? 'lg:justify-center lg:px-0' : ''
              }`}
            >
              <Icon path={HOME_ICONS.book} size={18} className="shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>آموزش</span>
              <NavBadge tone="new" className={collapsed ? 'lg:hidden' : ''}>
                جدید
              </NavBadge>
            </Link>

            <div className="relative" data-home-menu="">
              {menu === 'account' ? (
                <div className="absolute start-0 bottom-full z-10 mb-2 w-56 rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-3 shadow-2xl">
                  <p className="truncate text-[13px] font-semibold">{user.name}</p>
                  <p className="mt-0.5 font-mono text-[12px] text-[var(--h-muted)]" dir="ltr">
                    {formatIranianMobile(user.phone)}
                  </p>
                  <div className="mt-2 flex flex-col gap-0.5 border-t border-[var(--h-line)] pt-2">
                    <Link
                      href="/battle?tab=profile"
                      className="rounded-lg px-2 py-1.5 text-[13px] hover:bg-[var(--h-chip)]"
                      onClick={() => setMenu(null)}
                    >
                      پروفایل نبرد
                    </Link>
                    <Link
                      href="/"
                      className="rounded-lg px-2 py-1.5 text-[13px] hover:bg-[var(--h-chip)]"
                      onClick={() => setMenu(null)}
                    >
                      وب‌سایت چارتیکس
                    </Link>
                    <button
                      type="button"
                      disabled={leaving}
                      onClick={() => void logout()}
                      className="rounded-lg px-2 py-1.5 text-start text-[13px] text-[#ff8b9a] hover:bg-[var(--h-chip)] disabled:opacity-50"
                    >
                      {leaving ? 'در حال خروج…' : 'خروج'}
                    </button>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                aria-expanded={menu === 'account'}
                aria-haspopup="menu"
                title={collapsed ? 'تنظیمات حساب' : undefined}
                onClick={() => openMenu('account')}
                className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)] ${
                  collapsed ? 'lg:justify-center lg:px-0' : ''
                }`}
              >
                <Icon name="settings" size={18} className="shrink-0" />
                <span className={collapsed ? 'lg:hidden' : ''}>تنظیمات حساب</span>
              </button>
            </div>
            <p
              className={`px-3 pt-2 text-[11px] text-[var(--h-muted)] ${collapsed ? 'lg:hidden' : ''}`}
            >
              نسخه {VERSION}
            </p>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </ShellContext.Provider>
  );
}

/** Mobile control that opens the shared sidebar. */
export function ShellMenuButton() {
  const { openDrawer } = useShell();
  return (
    <button
      type="button"
      aria-label="منو"
      onClick={openDrawer}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--h-muted)] hover:bg-[var(--h-chip)] lg:hidden"
    >
      <Icon path={HOME_ICONS.menu} size={18} />
    </button>
  );
}

/** Pro, language, theme, help and notices. Sits in each page's own header. */
export function ShellTools() {
  const { scheme, toggleScheme, menu, openMenu, notices, noticeMenu } = useShell();
  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/#pricing"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--h-line)] bg-[var(--h-chip)] px-3 text-[13px] font-semibold transition hover:border-[var(--h-accent)]"
      >
        <Icon name="crown" size={14} />
        پرو
      </Link>
      <div className="relative" data-home-menu="">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menu === 'lang'}
          onClick={() => openMenu('lang')}
          className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)]"
        >
          فا
          <Icon name="chevronDown" size={14} />
        </button>
        {menu === 'lang' ? (
          <div
            role="menu"
            className="absolute end-0 top-full z-20 mt-2 w-52 rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-2 shadow-2xl"
          >
            <p className="flex items-center gap-1.5 px-2 py-1.5 text-[13px] font-medium">
              <Icon name="check" size={14} className="text-[var(--h-accent)]" />
              فارسی
            </p>
            <p className="px-2 pb-1 text-[12px] leading-6 text-[var(--h-muted)]">
              رابط چارتیکس به فارسی است.
            </p>
          </div>
        ) : null}
      </div>
      <IconButton label={scheme === 'dark' ? 'زمینه روشن' : 'زمینه تیره'} onClick={toggleScheme}>
        <Icon path={scheme === 'dark' ? HOME_ICONS.sun : HOME_ICONS.moon} size={16} />
      </IconButton>
      <Link
        href="/#faq"
        aria-label="راهنما"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)]"
      >
        <Icon name="info" size={16} />
      </Link>
      <div className="relative" data-home-menu="">
        <IconButton label="اعلان‌ها" pressed={menu === 'bell'} onClick={() => openMenu('bell')}>
          <Icon path={HOME_ICONS.bell} size={16} />
          {notices > 0 ? (
            <span className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#ff6b81]" />
          ) : null}
        </IconButton>
        {menu === 'bell' ? (
          <div
            role="menu"
            className="absolute end-0 top-full z-20 mt-2 w-72 rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-2 shadow-2xl"
          >
            <p className="px-2 py-1 text-[12px] font-semibold text-[var(--h-muted)]">اعلان‌ها</p>
            {notices === 0 ? (
              <p className="px-2 py-3 text-[13px] text-[var(--h-muted)]">اعلانی ندارید.</p>
            ) : (
              <div className="flex flex-col gap-1" onClick={() => openMenu('bell')}>
                {noticeMenu}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function IconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  readonly label: string;
  readonly pressed?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)]"
    >
      {children}
    </button>
  );
}

function NavBadge({
  children,
  tone,
  className = '',
}: {
  readonly children: string;
  readonly tone: 'new' | 'beta';
  readonly className?: string;
}) {
  return (
    <span
      className={`ms-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none ${className} ${
        tone === 'new'
          ? 'bg-[var(--h-accent)] text-white'
          : 'border border-[var(--h-accent)]/50 text-[var(--h-accent)]'
      }`}
    >
      {children}
    </span>
  );
}
