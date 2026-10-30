import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from './Logo';

const WRAP = 'mx-auto w-full max-w-3xl px-5 py-12 lg:px-8 lg:py-16';

export function MarketingDoc({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full bg-[#04070f] text-[#e8eefc]">
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" aria-label="بازگشت به صفحه اصلی">
            <Logo />
          </Link>
          <Link
            href="/login"
            className="text-[13px] font-semibold text-[#9cc4ff] transition hover:text-white"
          >
            ورود
          </Link>
        </div>
      </header>
      <article className={WRAP}>
        <h1 className="text-[28px] font-black leading-[1.4] tracking-tight text-white sm:text-[36px]">
          {title}
        </h1>
        <div className="prose-doc mt-10 space-y-6 text-[15px] leading-8 text-[#b7c3de] [&_a]:text-[#8cbcff] [&_a]:underline-offset-4 hover:[&_a]:text-white [&_h2]:mt-10 [&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:ps-5">
          {children}
        </div>
      </article>
      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-5 py-6 text-[13px] text-[#7d8bac] lg:px-8">
          <Link href="/" className="hover:text-white">
            خانه
          </Link>
          <Link href="/lessons" className="hover:text-white">
            آموزش
          </Link>
          <Link href="/guides" className="hover:text-white">
            راهنماها
          </Link>
          <Link href="/pricing" className="hover:text-white">
            قیمت
          </Link>
          <Link href="/about" className="hover:text-white">
            درباره ما
          </Link>
          <Link href="/privacy" className="hover:text-white">
            حریم خصوصی
          </Link>
          <Link href="/terms" className="hover:text-white">
            شرایط استفاده
          </Link>
        </div>
      </footer>
    </div>
  );
}
