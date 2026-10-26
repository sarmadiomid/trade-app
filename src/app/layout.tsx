import type { Metadata, Viewport } from 'next';
import './globals.css';

const POPPINS = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap';

export const metadata: Metadata = {
  title: 'Candelo',
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
      <head>
        <meta name="enamad" content="34914740" />
      </head>
      <body className="h-full overflow-hidden antialiased">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={POPPINS} precedence="default" />
        {children}
      </body>
    </html>
  );
}
