import type { ReactNode } from 'react';
import { BattleLocale } from './locale';
import '../backtest/backtest.css';
import '../home/home.css';

const VAZIRMATN = 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css';

export default function BattleLayout({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href={VAZIRMATN} precedence="default" />
      <BattleLocale>{children}</BattleLocale>
    </>
  );
}
