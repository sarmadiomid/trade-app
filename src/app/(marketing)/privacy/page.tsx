import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingDoc } from '@/components/marketing/MarketingDoc';
import { SUPPORT_EMAIL } from '@/lib/support/catalog';
import { absoluteUrl } from '@/lib/seo/site';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'حریم خصوصی | Candelo',
  description: 'سیاست حریم خصوصی Candelo: چه داده‌هایی جمع می‌کنیم، چرا، و چگونه محافظت می‌شوند.',
  alternates: { canonical: absoluteUrl('/privacy') },
  openGraph: {
    title: 'حریم خصوصی | Candelo',
    description: 'نحوه جمع‌آوری و استفاده از داده‌های کاربران در Candelo.',
    url: absoluteUrl('/privacy'),
    locale: 'fa_IR',
    images: [{ url: absoluteUrl('/og.png'), width: 1200, height: 630 }],
  },
};

export default function PrivacyPage() {
  return (
    <MarketingDoc title="حریم خصوصی">
      <p className="text-[#8b98b8]">آخرین به‌روزرسانی: ۳۰ مهر ۱۴۰۵</p>
      <p>
        این صفحه توضیح می‌دهد Candelo (کندلو) هنگام استفاده شما از{' '}
        <Link href="/">candelo.ir</Link> چه اطلاعاتی را پردازش می‌کند. با ساخت حساب یا استفاده از
        سرویس، این سیاست را می‌پذیرید.
      </p>

      <h2>۱. داده‌هایی که جمع می‌کنیم</h2>
      <ul>
        <li>
          <strong className="text-white">شماره موبایل</strong> برای ورود با رمز یک‌بارمصرف (OTP)
        </li>
        <li>
          <strong className="text-white">نام نمایشی و تنظیمات حساب</strong> در صورت وارد کردن شما
        </li>
        <li>
          <strong className="text-white">داده‌های تمرین</strong> مثل جلسه‌های بک‌تست، معاملات مجازی،
          ژورنال و آمار
        </li>
        <li>
          <strong className="text-white">اطلاعات پرداخت</strong> برای اشتراک‌های پولی؛ پردازش درگاه
          توسط ارائه‌دهنده پرداخت انجام می‌شود و ما شماره کارت کامل ذخیره نمی‌کنیم
        </li>
        <li>
          <strong className="text-white">پیام‌های پشتیبانی</strong> و فایل‌هایی که ضمیمه می‌کنید
        </li>
        <li>
          <strong className="text-white">داده‌های فنی محدود</strong> مانند آدرس IP هنگام درخواست OTP
          برای جلوگیری از سوءاستفاده، و کوکی نشست امن
        </li>
      </ul>

      <h2>۲. هدف استفاده</h2>
      <ul>
        <li>احراز هویت و حفظ نشست ورود</li>
        <li>ارائه بازپخش، معامله مجازی، ژورنال، نبرد و امکانات طرح شما</li>
        <li>صدور فاکتور/اشتراک و پشتیبانی</li>
        <li>امنیت سرویس و مقابله با سوءاستفاده از OTP</li>
      </ul>

      <h2>۳. کوکی‌ها و نشست</h2>
      <p>
        برای ماندن در حساب، یک کوکی نشست امن (<code className="text-[#9cc4ff]">httpOnly</code>) روی
        مرورگر شما قرار می‌گیرد. این کوکی برای ردیابی تبلیغاتی استفاده نمی‌شود.
      </p>

      <h2>۴. اشتراک‌گذاری</h2>
      <p>
        داده‌های شما را نمی‌فروشیم. ممکن است برای ارائه سرویس با پردازنده‌های مورد اعتماد (میزبانی،
        پیامک OTP، درگاه پرداخت، نماد اعتماد) در حد لازم به اشتراک گذاشته شود. در صورت الزام قانونی
        ممکن است اطلاعات محدودی افشا شود.
      </p>

      <h2>۵. نگهداری و امنیت</h2>
      <p>
        داده‌ها تا وقتی حساب فعال است یا برای تعهدات قانونی/مالی لازم باشد نگهداری می‌شوند. از HTTPS و
        کنترل‌های دسترسی سمت سرور استفاده می‌کنیم؛ هیچ سیستمی مطلقاً بدون ریسک نیست.
      </p>

      <h2>۶. حقوق شما</h2>
      <p>
        می‌توانید اطلاعات پروفایل را در تنظیمات حساب به‌روزرسانی کنید و از طریق پشتیبانی برای حذف حساب
        یا پرسش درباره داده‌ها درخواست بدهید:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>

      <h2>۷. تغییرات</h2>
      <p>
        در صورت به‌روزرسانی این سیاست، نسخه جدید در همین صفحه منتشر می‌شود. ادامه استفاده به معنی
        پذیرش نسخه به‌روز است.
      </p>

      <p>
        همچنین <Link href="/terms">شرایط استفاده</Link> و{' '}
        <Link href="/about">درباره ما</Link> را ببینید.
      </p>
    </MarketingDoc>
  );
}
