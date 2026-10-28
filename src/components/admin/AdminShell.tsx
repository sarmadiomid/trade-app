'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { formatIranianMobile } from '@/auth/phone';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icons';

const NAV: ReadonlyArray<{ href: string; label: string; hint: string; icon: IconName }> = [
  { href: '/admin', label: 'نمای کلی', hint: 'وضعیت پلتفرم', icon: 'grid' },
  { href: '/admin/users', label: 'کاربران', hint: 'طرح و مصرف', icon: 'user' },
  { href: '/admin/symbols', label: 'نمادها', hint: 'قرارداد و داده', icon: 'chart' },
  { href: '/admin/support', label: 'پشتیبانی', hint: 'صندوق درخواست‌ها', icon: 'chat' },
  { href: '/admin/discounts', label: 'تخفیف‌ها', hint: 'کدهای پرداخت', icon: 'tag' },
  { href: '/admin/battles', label: 'نبردها', hint: 'اتاق‌های اخیر', icon: 'swords' },
  { href: '/admin/sessions', label: 'تمرین‌ها', hint: 'جلسه‌های بک‌تست', icon: 'replay' },
];

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
  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-[248px] shrink-0 flex-col border-s border-[var(--a-line)] bg-[var(--a-side)] md:flex">
        <div className="border-b border-[var(--a-line)] px-5 py-5">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[var(--a-gold)]">
            CANDELO
          </p>
          <h1 className="mt-1 text-[18px] font-bold">پنل مدیریت</h1>
          <p className="mt-2 truncate text-[12.5px] text-[var(--a-muted)]">{name}</p>
          <p dir="ltr" className="text-end font-mono text-[12px] text-[var(--a-muted)]">
            {formatIranianMobile(phone)}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <div className="border-t border-[var(--a-line)] p-3">
          <Link
            href="/home"
            className="flex h-10 items-center gap-2 rounded-xl px-3 text-[13px] text-[var(--a-muted)] transition hover:bg-white/5 hover:text-[var(--a-text)]"
          >
            <Icon name="chevronRight" size={16} />
            بازگشت به کندلو
          </Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex gap-2 overflow-x-auto border-b border-[var(--a-line)] px-3 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] ${
                isActive(pathname, item.href)
                  ? 'bg-[var(--a-accent)] text-white'
                  : 'bg-white/5 text-[var(--a-muted)]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
}: {
  readonly item: (typeof NAV)[number];
  readonly active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
        active
          ? 'bg-[var(--a-accent)] text-white'
          : 'text-[var(--a-muted)] hover:bg-white/5 hover:text-[var(--a-text)]'
      }`}
    >
      <Icon name={item.icon} size={18} />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">{item.label}</span>
        <span className={`block text-[11px] ${active ? 'text-white/75' : 'text-[var(--a-muted)]'}`}>
          {item.hint}
        </span>
      </span>
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminDenied({ phone }: { readonly phone: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-md rounded-3xl border border-[var(--a-line)] bg-[var(--a-card)] p-8 text-center">
        <p className="text-[12px] font-semibold tracking-[0.18em] text-[var(--a-gold)]">CANDELO</p>
        <h1 className="mt-3 text-[22px] font-bold">دسترسی مدیریت ندارید</h1>
        <p className="mt-3 text-[14px] leading-7 text-[var(--a-muted)]">
          شمارهٔ واردشده در فهرست مدیران نیست. آن را در متغیر <span dir="ltr">ADMIN_PHONES</span>{' '}
          سرور بگذارید و برنامه را دوباره اجرا کنید.
        </p>
        <p dir="ltr" className="mt-4 font-mono text-[15px] text-[var(--a-text)]">
          {formatIranianMobile(phone)}
        </p>
        <Link
          href="/home"
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-[var(--a-accent)] px-4 text-[13.5px] font-semibold text-white"
        >
          بازگشت
        </Link>
      </div>
    </div>
  );
}
