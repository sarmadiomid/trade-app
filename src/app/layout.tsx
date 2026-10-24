import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'چارتیکس',
  description: 'بک‌تست و بازپخش بازار؛ معامله تمرینی بدون سرمایه واقعی',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#07090f',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden antialiased">{children}</body>
    </html>
  );
}
