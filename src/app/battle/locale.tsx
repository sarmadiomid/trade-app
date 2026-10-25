'use client';

import { useEffect, type ReactNode } from 'react';
import { PlanSync } from '@/components/billing/PlanUpgradeModal';

/** Switches the document to Persian RTL while a battle route is mounted, then restores it. */
export function BattleLocale({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const prev = {
      lang: html.lang,
      dir: html.getAttribute('dir'),
      fa: html.classList.contains('bt-fa'),
    };
    html.lang = 'fa';
    html.dir = 'rtl';
    html.classList.add('bt-fa');
    return () => {
      html.lang = prev.lang;
      if (prev.dir === null) html.removeAttribute('dir');
      else html.setAttribute('dir', prev.dir);
      if (!prev.fa) html.classList.remove('bt-fa');
    };
  }, []);
  return (
    <>
      <PlanSync />
      {children}
    </>
  );
}
