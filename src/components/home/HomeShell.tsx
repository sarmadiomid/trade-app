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
import { APP_CONFIG, PLAN_LABEL } from '@/lib/app';
import type { Theme } from '@/lib/core';
import { faDigits } from '@/lib/locale/jalali';
import { SUPPORT_INBOX_EVENT } from '@/lib/support/catalog';
import { LocalStorageStorage, VersionedStore } from '@/lib/storage';
import { darkTheme, parseTheme, themeRegistry } from '@/lib/themes';
import { BRAND_EN, BrandName, LogoMark } from '../marketing/Logo';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { useUiStore } from '../state/ui-store';
import { usePlan, usePlanReady } from '../billing/usePlan';
import { initials } from '../platform/AppHeader';
import { api, type Me } from '../platform/api';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import { useAccountAvatar } from './account-prefs';

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
type Menu = 'lang' | 'bell' | 'profile';

const NAV: ReadonlyArray<{
  href: string;
  label: string;
  icon: IconName | null;
  path?: string;
  badge?: string;
  badgeTone?: 'new' | 'beta' | 'soon';
}> = [
  { href: '/home', label: 'تمرین', icon: null, path: HOME_ICONS.bars },
  { href: '/battle', label: 'نبردها', icon: 'swords', badge: 'بتا', badgeTone: 'beta' },
  { href: '/home/support', label: 'پشتیبانی', icon: 'chat' },
  {
    href: '/home/learn',
    label: 'آموزش',
    icon: null,
    path: HOME_ICONS.book,
    badge: 'به زودی',
    badgeTone: 'soon',
  },
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
  readonly palette: 'home' | 'theme';
  readonly toggleScheme: () => void;
  readonly openDrawer: () => void;
  readonly menu: Menu | null;
  readonly openMenu: (id: Menu) => void;
  readonly notices: number;
  readonly noticeMenu: ReactNode;
  readonly supportUnread: number;
  readonly user: Me;
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
  palette = 'home',
  children,
}: {
  readonly user: Me;
  readonly notices: number;
  readonly noticeMenu: ReactNode;
  /** `theme` follows the active chart theme. `home` keeps the practice palette. */
  readonly palette?: 'home' | 'theme';
  readonly children: ReactNode;
}) {
  useThemeCssVars();
  const pathname = usePathname();
  const scheme = useSyncExternalStore(subscribeScheme, readScheme, () => 'dark' as const);
  const collapsed = useSyncExternalStore(subscribeNav, readCollapsed, () => false);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [supportUnread, setSupportUnread] = useState(0);
  const onSettings = pathname === '/home/settings' || pathname.startsWith('/home/settings/');

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

  useEffect(() => {
    if (palette !== 'theme') return;
    let cancel = false;
    void themeStore()
      .load(APP_CONFIG.storageKeys.themes, 'themes', validateStoredThemes)
      .then((stored) => {
        if (cancel || !stored) return;
        if (useUiStore.getState().themes.length > 0) return;
        useUiStore.setState({
          themes: [...themeRegistry.list(), ...stored.themes],
          activeTheme: resolveStoredTheme(stored),
        });
      });
    return () => {
      cancel = true;
    };
  }, [palette]);

  useEffect(() => {
    let cancel = false;
    const load = () => {
      void api<{ unread: number }>('/api/support/summary')
        .then((data) => {
          if (!cancel && Number.isFinite(data.unread)) setSupportUnread(data.unread);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 20_000);
    window.addEventListener(SUPPORT_INBOX_EVENT, load);
    return () => {
      cancel = true;
      window.clearInterval(timer);
      window.removeEventListener(SUPPORT_INBOX_EVENT, load);
    };
  }, []);

  const toggleScheme = () => writeScheme(scheme === 'dark' ? 'light' : 'dark');
  const toggleNav = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      writeCollapsed(!collapsed);
      return;
    }
    setDrawer((d) => !d);
  };
  const openMenu = (id: Menu) => setMenu((cur) => (cur === id ? null : id));

  return (
    <ShellContext.Provider
      value={{
        scheme,
        palette,
        toggleScheme,
        openDrawer: () => setDrawer(true),
        menu,
        openMenu,
        notices,
        noticeMenu,
        supportUnread,
        user,
      }}
    >
      <div
        data-scheme={scheme}
        data-palette={palette === 'theme' ? 'theme' : undefined}
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
              aria-label={`خانه ${BRAND_EN}`}
              className={`flex min-w-0 items-center gap-2 ${collapsed ? 'lg:hidden' : ''}`}
              onClick={() => setDrawer(false)}
            >
              <LogoMark size={26} />
              <BrandName className="truncate text-[16px] font-bold tracking-tight" />
            </Link>
          </div>

          <div className={`flex flex-col items-center px-4 pb-4 ${collapsed ? 'lg:px-2' : ''}`}>
            <span className="relative">
              <ShellAvatar
                user={user}
                className={`rounded-full border font-bold ${
                  palette === 'theme'
                    ? 'border-line bg-hover text-fg'
                    : 'border-[var(--h-line)] bg-[radial-gradient(circle_at_32%_28%,#252832,#121419)] text-white'
                } ${
                  collapsed
                    ? 'h-11 w-11 text-[14px] lg:h-11 lg:w-11'
                    : 'h-[72px] w-[72px] text-[22px]'
                }`}
              />
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
                item.href === '/home'
                  ? pathname === '/home' ||
                    pathname.startsWith('/home/stats') ||
                    pathname.startsWith('/home/journal')
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const orbit = item.href === '/battle';
              const support = item.href === '/home/support';
              const unreadLabel =
                support && supportUnread > 0
                  ? supportUnread > 9
                    ? `${faDigits(9)}+`
                    : faDigits(supportUnread)
                  : null;
              const badge = unreadLabel ?? item.badge;
              const badgeTone = unreadLabel ? 'new' : (item.badgeTone ?? 'beta');
              const body = (
                <>
                  <span className="relative shrink-0">
                    {item.path ? (
                      <Icon path={item.path} size={18} />
                    ) : (
                      <Icon name={item.icon ?? 'chart'} size={18} />
                    )}
                    {collapsed && unreadLabel ? (
                      <span className="absolute -end-1 -top-1 hidden h-2 w-2 rounded-full bg-[var(--h-accent)] ring-2 ring-[var(--h-side)] lg:block" />
                    ) : null}
                  </span>
                  <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                  {badge ? (
                    <NavBadge tone={badgeTone} className={collapsed ? 'lg:hidden' : ''}>
                      {badge}
                    </NavBadge>
                  ) : null}
                </>
              );
              const row = `flex items-center gap-3 px-3 text-[14px] font-medium transition ${
                collapsed ? 'lg:justify-center lg:px-0' : ''
              } ${
                activeNav
                  ? 'bg-[var(--h-soft)] text-[var(--h-text)]'
                  : 'text-[var(--h-muted)] hover:text-[var(--h-text)]'
              }`;
              const linkProps = {
                href: item.href,
                'aria-current': activeNav ? ('page' as const) : undefined,
                title: collapsed
                  ? unreadLabel
                    ? `${item.label}، ${faDigits(supportUnread)} پاسخ جدید`
                    : badge
                      ? `${item.label}، ${badge}`
                      : item.label
                  : undefined,
                onClick: () => setDrawer(false),
              };
              if (orbit) {
                return (
                  <Link key={item.href} {...linkProps} className="nav-battle-ring">
                    <span
                      className={`${row} h-10 rounded-[10px] ${
                        activeNav
                          ? ''
                          : 'bg-[var(--h-side)] hover:bg-[color-mix(in_srgb,var(--h-text)_8%,var(--h-side))]'
                      }`}
                    >
                      {body}
                    </span>
                  </Link>
                );
              }
              return (
                <Link
                  key={item.href}
                  {...linkProps}
                  className={`${row} h-11 rounded-xl ${activeNav ? '' : 'hover:bg-[var(--h-chip)]'}`}
                >
                  {body}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto px-3 pb-3">
            <div className="mx-1 mb-2 h-px bg-[var(--h-line)]" />
            <Link
              href="/home/settings"
              aria-current={onSettings ? 'page' : undefined}
              title={collapsed ? 'تنظیمات حساب' : undefined}
              onClick={() => setDrawer(false)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition ${
                onSettings
                  ? 'bg-[var(--h-soft)] text-[var(--h-text)]'
                  : 'text-[var(--h-muted)] hover:bg-[var(--h-chip)] hover:text-[var(--h-text)]'
              } ${collapsed ? 'lg:h-11 lg:justify-center lg:px-0' : ''}`}
            >
              <Icon name="settings" size={18} className="shrink-0" />
              <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
                <span className="block truncate">تنظیمات حساب</span>
                <span
                  dir="ltr"
                  className="block truncate text-start text-[11px] font-normal text-[var(--h-muted)]"
                >
                  {formatIranianMobile(user.phone)}
                </span>
              </span>
            </Link>
            <p
              className={`px-3 pt-2 text-[11px] text-[var(--h-muted)] ${collapsed ? 'lg:hidden' : ''}`}
            >
              {`نسخه ${VERSION}`}
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

/** Pro, language, theme, help, notices and the account menu. Sits in each page's own header. */
export function ShellTools() {
  const { scheme, palette, toggleScheme, menu, openMenu, notices, noticeMenu, supportUnread } =
    useShell();
  const plan = usePlan();
  const planReady = usePlanReady();
  const planLabel = PLAN_LABEL[plan];
  return (
    <div className="flex flex-nowrap items-center justify-end gap-0.5 sm:gap-1.5">
      <Link
        href="/home/settings?tab=subscription"
        aria-label={planReady ? `طرح ${planLabel}` : 'طرح اشتراک'}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--h-line)] bg-[var(--h-chip)] px-2 text-[12px] font-semibold transition hover:border-[var(--h-accent)] sm:h-9 sm:px-3 sm:text-[13px]"
      >
        <Icon name="crown" size={14} />
        <span className="max-[380px]:sr-only">{planReady ? planLabel : '…'}</span>
      </Link>
      <div className="relative" data-home-menu="">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menu === 'lang'}
          onClick={() => openMenu('lang')}
          className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[12px] font-semibold text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)] sm:h-9 sm:gap-1 sm:px-2.5 sm:text-[13px]"
        >
          فا
          <Icon name="chevronDown" size={14} className="max-sm:hidden" />
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
              رابط <BrandName /> به فارسی است.
            </p>
          </div>
        ) : null}
      </div>
      {palette === 'home' ? (
        <IconButton label={scheme === 'dark' ? 'زمینه روشن' : 'زمینه تیره'} onClick={toggleScheme}>
          <Icon path={scheme === 'dark' ? HOME_ICONS.sun : HOME_ICONS.moon} size={16} />
        </IconButton>
      ) : null}
      <Link
        href="/#faq"
        aria-label="راهنما"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)] sm:h-9 sm:w-9"
      >
        <Icon name="info" size={16} />
      </Link>
      <div className="relative" data-home-menu="">
        <IconButton label="اعلان‌ها" pressed={menu === 'bell'} onClick={() => openMenu('bell')}>
          <Icon path={HOME_ICONS.bell} size={16} />
          {notices + supportUnread > 0 ? (
            <span className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-down" />
          ) : null}
        </IconButton>
        {menu === 'bell' ? (
          <div
            role="menu"
            className="absolute end-0 top-full z-20 mt-2 w-72 rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-2 shadow-2xl"
          >
            <p className="px-2 py-1 text-[12px] font-semibold text-[var(--h-muted)]">اعلان‌ها</p>
            {notices === 0 && supportUnread === 0 ? (
              <p className="px-2 py-3 text-[13px] text-[var(--h-muted)]">اعلانی ندارید.</p>
            ) : (
              <div className="flex flex-col gap-1" onClick={() => openMenu('bell')}>
                {supportUnread > 0 ? (
                  <Link
                    href="/home/support"
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] hover:bg-[var(--h-chip)]"
                  >
                    <Icon name="chat" size={14} className="shrink-0 text-[var(--h-accent)]" />
                    <span className="min-w-0">
                      پاسخ جدید پشتیبانی
                      <span className="mt-0.5 block text-[11px] text-[var(--h-muted)]">
                        {faDigits(supportUnread)} پیام خوانده‌نشده
                      </span>
                    </span>
                  </Link>
                ) : null}
                {noticeMenu}
              </div>
            )}
          </div>
        ) : null}
      </div>
      <ProfileMenu />
    </div>
  );
}

function ProfileMenu() {
  const { user, menu, openMenu } = useShell();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [admin, setAdmin] = useState(false);
  const open = menu === 'profile';

  useEffect(() => {
    let live = true;
    api<{ admin?: boolean }>('/api/me')
      .then((me) => {
        if (live) setAdmin(me.admin === true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const logout = async () => {
    setLeaving(true);
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    router.replace('/');
    router.refresh();
  };

  return (
    <div className="relative" data-home-menu="">
      <button
        type="button"
        aria-label="حساب کاربری"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => openMenu('profile')}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full py-1 pe-1 ps-1 text-[13px] font-semibold transition hover:bg-[var(--h-chip)] sm:h-9 sm:pe-1.5"
      >
        <ShellAvatar
          user={user}
          className="h-7 w-7 rounded-full bg-[var(--h-accent)] text-[11px] font-bold text-white"
        />
        <span className="hidden max-w-28 truncate sm:inline">{user.name}</span>
        <Icon name="chevronDown" size={14} className="hidden text-[var(--h-muted)] sm:block" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-full z-20 mt-2 w-60 rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-2 shadow-2xl"
        >
          <div className="px-2 pb-2 pt-1">
            <p className="truncate text-[13px] font-semibold">{user.name}</p>
            <p dir="ltr" className="mt-0.5 text-end font-mono text-[12px] text-[var(--h-muted)]">
              {formatIranianMobile(user.phone)}
            </p>
          </div>
          <div className="border-t border-[var(--h-line)] pt-1">
            <Link
              href="/home/settings"
              role="menuitem"
              className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-[13px] font-medium transition hover:bg-[var(--h-chip)]"
            >
              <Icon name="settings" size={15} />
              تنظیمات حساب
            </Link>
            {admin ? (
              <Link
                href="/admin"
                role="menuitem"
                className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-[13px] font-medium transition hover:bg-[var(--h-chip)]"
              >
                <Icon name="grid" size={15} />
                پنل مدیریت
              </Link>
            ) : null}
            <button
              type="button"
              role="menuitem"
              disabled={leaving}
              onClick={() => void logout()}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-[#ff6b81] transition hover:bg-[var(--h-chip)] disabled:opacity-50"
            >
              <Icon name="logout" size={15} />
              {leaving ? 'در حال خروج…' : 'خروج'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ShellAvatar({
  user,
  className,
}: {
  readonly user: Me;
  readonly className: string;
}) {
  const avatar = useAccountAvatar(user.id);
  return (
    <span className={`flex items-center justify-center overflow-hidden ${className}`}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(user.name)
      )}
    </span>
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
      className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)] sm:h-9 sm:w-9"
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
  readonly tone: 'new' | 'beta' | 'soon';
  readonly className?: string;
}) {
  return (
    <span
      className={`ms-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none ${className} ${
        tone === 'new'
          ? 'bg-[var(--h-accent)] text-white'
          : tone === 'soon'
            ? 'border border-[var(--h-line)] bg-[var(--h-chip)] text-[var(--h-muted)]'
            : 'border border-[var(--h-accent)]/50 text-[var(--h-accent)]'
      }`}
    >
      {children}
    </span>
  );
}

type StoredThemes = { readonly themes: Theme[]; readonly activeId: string };

function themeStore() {
  return new VersionedStore(new LocalStorageStorage(localStorage));
}

function validateStoredThemes(data: unknown): StoredThemes | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as { themes?: unknown; activeId?: unknown };
  const themes = Array.isArray(d.themes)
    ? d.themes.map((t) => parseTheme(t)).filter((t): t is Theme => t !== null)
    : [];
  return { themes, activeId: typeof d.activeId === 'string' ? d.activeId : darkTheme.id };
}

function resolveStoredTheme(stored: StoredThemes): Theme {
  return (
    themeRegistry.get(stored.activeId) ??
    stored.themes.find((t) => t.id === stored.activeId) ??
    darkTheme
  );
}
