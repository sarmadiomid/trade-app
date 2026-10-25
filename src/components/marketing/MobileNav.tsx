'use client';

import { useRef } from 'react';
import { Icon } from '../ui/Icon';

/** In-flow menu so it stays inside the scrolling page and closes after a section link. */
export function MobileNav({ items }: { items: readonly { href: string; label: string }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="group border-t border-[var(--mk-line)] lg:hidden">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-5 text-sm font-semibold text-[var(--mk-muted)] [&::-webkit-details-marker]:hidden">
        فهرست
        <Icon
          name="chevronDown"
          size={16}
          className="transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <nav className="flex flex-col px-3 pb-3" aria-label="ناوبری موبایل">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={() => {
              if (ref.current) ref.current.open = false;
            }}
            className="cursor-pointer rounded-md px-2 py-2.5 text-sm text-[var(--mk-muted)] hover:bg-white/[0.04] hover:text-[var(--mk-text)]"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
