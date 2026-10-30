import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/marketing/Logo';
import { PricingSignedIn } from '@/components/marketing/PricingSignedIn';
import { absoluteUrl } from '@/lib/seo/site';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'قیمت و طرح‌های اشتراک | Candelo',
  description:
    'طرح مبتدی رایگان، متوسط و حرفه‌ای Candelo برای بک‌تست و بازپخش بازار با حساب مجازی. قیمت ماهانه و سالانه.',
  alternates: { canonical: absoluteUrl('/pricing') },
  openGraph: {
    title: 'قیمت‌های Candelo',
    description: 'از رایگان تا حرفه‌ای — تمرین معامله بدون سرمایه واقعی.',
    url: absoluteUrl('/pricing'),
    locale: 'fa_IR',
    images: [{ url: absoluteUrl('/og.png'), width: 1200, height: 630 }],
  },
};

const WRAP = 'mx-auto w-full max-w-[1200px] px-5 lg:px-8';

export default function PricingPage() {
  return (
    <div className="min-h-full bg-[#04070f] text-[#e8eefc]">
      <header className="border-b border-white/[0.07]">
        <div className={`${WRAP} flex items-center justify-between py-5`}>
          <Link href="/" aria-label="خانه">
            <Logo />
          </Link>
          <div className="flex items-center gap-4 text-[13px]">
            <Link href="/guides" className="text-[#9cc4ff] hover:text-white">
              راهنماها
            </Link>
            <Link href="/login" className="font-semibold text-[#9cc4ff] hover:text-white">
              ورود
            </Link>
          </div>
        </div>
      </header>

      <main className={`${WRAP} py-16 lg:py-20`}>
        <p className="text-center text-xs font-semibold text-[#9cc4ff]">قیمت</p>
        <h1 className="mt-3 text-center text-[28px] font-black leading-[1.4] text-white sm:text-[40px]">
          سه طرح، از رایگان تا حرفه‌ای
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-8 text-[#8b98b8]">
          همان امکانات محصول روی صفحه اصلی. مبتدی برای شروع، متوسط برای تمرین منظم، حرفه‌ای برای جلسه
          و نبرد گسترده‌تر. پرداخت از طریق درگاه معتبر انجام می‌شود.
        </p>

        <PricingSignedIn />

        <p className="mx-auto mt-12 max-w-2xl text-center text-[13px] leading-7 text-[#7d8bac]">
          Candelo توصیه سرمایه‌گذاری نیست. جزئیات محدودیت هر طرح در تنظیمات اشتراک داخل حساب هم آمده
          است. پرسش‌های رایج را در{' '}
          <Link href="/#faq" className="text-[#8cbcff] hover:text-white">
            سوالات متداول
          </Link>{' '}
          ببینید یا{' '}
          <Link href="/about" className="text-[#8cbcff] hover:text-white">
            درباره ما
          </Link>{' '}
          را بخوانید.
        </p>
      </main>
    </div>
  );
}
