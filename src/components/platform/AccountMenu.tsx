'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatIranianMobile } from '@/auth/phone';
import type { RemoteStorage } from '@/lib/storage';
import { useApp } from '../state/app-context';
import { Icon } from '../ui/Icon';
import { Popover } from '../ui/Popover';
import { Tooltip } from '../ui/Tooltip';

const ITEM =
  'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-hover disabled:opacity-50';

/** Signed-in user's menu in the top toolbar: phone number, the platform sections and sign out. */
export function AccountMenu({ phone, storage }: { phone: string; storage: RemoteStorage }) {
  const app = useApp();
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const logout = async () => {
    setLeaving(true);
    app.flush();
    await storage.idle();
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    router.replace('/');
    router.refresh();
  };

  return (
    <>
      <Tooltip label="Account">
        <button
          ref={setAnchor}
          type="button"
          aria-label="Account"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="ml-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-fg transition hover:brightness-110"
        >
          <Icon name="user" size={15} strokeWidth={2} />
        </button>
      </Tooltip>
      {open ? (
        <Popover anchor={anchor} onClose={() => setOpen(false)}>
          <div className="flex w-56 flex-col gap-0.5">
            <div className="px-2 pb-2 pt-1">
              <div className="text-[11px] uppercase tracking-wide text-muted">Signed in as</div>
              <div className="mt-0.5 font-mono text-[13px]" dir="ltr">
                {formatIranianMobile(phone)}
              </div>
            </div>
            <div className="border-t border-line pt-1">
              <Link href="/home" className={ITEM}>
                <Icon name="home" size={15} />
                Home
              </Link>
              <Link href="/backtest" className={ITEM}>
                <Icon name="replay" size={15} />
                Backtest
              </Link>
              <Link href="/battle" className={ITEM}>
                <Icon name="swords" size={15} />
                Battles
              </Link>
              <button type="button" className={ITEM} disabled={leaving} onClick={logout}>
                <Icon name="logout" size={15} />
                {leaving ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </Popover>
      ) : null}
    </>
  );
}
