'use client';

import { useEffect, type ReactNode } from 'react';

/** Persian RTL while the admin panel is open. */
export function useAdminLocale(): void {
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
}

export function AdminFrame({ children }: { readonly children: ReactNode }) {
  useAdminLocale();
  return <div className="admin-app h-full">{children}</div>;
}
