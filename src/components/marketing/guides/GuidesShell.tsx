import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/marketing/Logo';
import { GUIDE_BTN_PRIMARY, GUIDE_WRAP } from './guides-ui';

const FOOTER_LINKS = [
  { href: '/', label: 'خانه' },
  { href: '/lessons', label: 'آموزش' },
  { href: '/guides', label: 'راهنماها' },
  { href: '/pricing', label: 'قیمت' },
  { href: '/about', label: 'درباره ما' },
  { href: '/privacy', label: 'حریم خصوصی' },
  { href: '/terms', label: 'شرایط استفاده' },
] as const;

export function GuidesShell({
  children,
  active = 'guides',
}: {
  children: ReactNode;
  active?: 'guides' | 'lessons' | 'pricing' | 'about';
}) {
  return (
    <div className="min-h-full bg-[#04070f] text-[#e8eefc]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#2f7bff] focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        پرش به محتوا
      </a>
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#04070f]/80 backdrop-blur-xl">
        <div className={`${GUIDE_WRAP} flex h-16 items-center justify-between gap-4`}>
          <Link href="/" aria-label="بازگشت به صفحه اصلی" className="shrink-0">
            <Logo />
          </Link>
          <nav aria-label="ناوبری اصلی" className="hidden items-center gap-1 md:flex">
            {(
              [
                { href: '/guides', key: 'guides', label: 'راهنماها' },
                { href: '/lessons', key: 'lessons', label: 'آموزش' },
                { href: '/pricing', key: 'pricing', label: 'قیمت' },
                { href: '/about', key: 'about', label: 'درباره' },
              ] as const
            ).map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-[13.5px] font-medium transition-[color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70 ${
                  active === item.key
                    ? 'bg-white/[0.06] text-white'
                    : 'text-[#8b98b8] hover:bg-white/[0.05] hover:text-white'
                }`}
                aria-current={active === item.key ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-lg px-3 text-[13px] font-semibold text-[#c9d4f0] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70 sm:inline-flex"
            >
              ورود
            </Link>
            <Link href="/login" className={`${GUIDE_BTN_PRIMARY} !h-9 !px-3.5 !text-[12.5px]`}>
              شروع تمرین
            </Link>
          </div>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="mt-8 border-t border-white/[0.07]">
        <div className={`${GUIDE_WRAP} flex flex-wrap gap-x-5 gap-y-3 py-7 text-[13px] text-[#7d8bac]`}>
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
