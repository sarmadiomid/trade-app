import { Vazirmatn } from 'next/font/google';
import './marketing.css';

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-vazirmatn',
});

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} ${vazirmatn.className} mk-root h-full overflow-y-auto overflow-x-hidden scroll-smooth`}
    >
      {children}
    </div>
  );
}
