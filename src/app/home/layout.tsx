import type { ReactNode } from 'react';
import { HomeLocale } from './locale';
import '../backtest/backtest.css';
import './home.css';

const VAZIRMATN = 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css';

export default function HomeLayout({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href={VAZIRMATN} precedence="default" />
      <HomeLocale>{children}</HomeLocale>
    </>
  );
}
