import type { ReactNode } from 'react';
import { BacktestLocale } from './locale';
import './backtest.css';

const VAZIRMATN = 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css';

export default function BacktestLayout({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href={VAZIRMATN} precedence="default" />
      <BacktestLocale>{children}</BacktestLocale>
    </>
  );
}
