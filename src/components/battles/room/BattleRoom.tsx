'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AppHeader } from '../../platform/AppHeader';
import type { Me } from '../../platform/api';
import { useThemeCssVars } from '../../hooks/useThemeCssVars';
import { Icon } from '../../ui/Icon';
import { Arena } from './Arena';
import { Lobby } from './Lobby';
import { Results } from './Results';
import { useBattle } from './useBattle';

/**
 * `/battle/[id]`: one battle through its life: lobby (Standby) → countdown → live trading
 * (with pauses) → results. Traders who joined trade; everyone else sees the lobby / join screen.
 */
export default function BattleRoom({ id, user }: { readonly id: string; readonly user: Me }) {
  useThemeCssVars();
  const params = useSearchParams();
  const { view, viewRef, error, refetch, run, now } = useBattle(id);
  // Once the trader has been on the chart, the battle ending keeps them there (results on top).
  const [traded, setTraded] = useState(false);
  const running =
    view !== null &&
    (view.status === 'countdown' || view.status === 'live' || view.status === 'paused');
  if (running && view.me && !traded) setTraded(true);

  if (!view) {
    if (error && (error.status === 404 || error.status === 400)) {
      return (
        <Shell user={user}>
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <Icon name="swords" size={32} />
            <h1 className="text-lg font-semibold">Battle not found</h1>
            <p className="text-[13px] text-muted">It may have been closed, or the link is wrong.</p>
            <Link href="/battle" className="text-accent hover:underline">
              Back to Battles
            </Link>
          </div>
        </Shell>
      );
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-chart">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }

  if (view.me && (running || (view.status === 'completed' && traded))) {
    return (
      <Arena view={view} viewRef={viewRef} meId={user.id} now={now} refetch={refetch} run={run} />
    );
  }
  if (view.status === 'completed') {
    return (
      <Shell user={user}>
        <Results view={view} meId={user.id} />
      </Shell>
    );
  }
  if (view.status === 'cancelled') {
    return (
      <Shell user={user}>
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <Icon name="close" size={30} />
          <h1 className="text-lg font-semibold">This battle was closed</h1>
          <p className="text-[13px] text-muted">{view.endReason ?? 'The host closed the lobby.'}</p>
          <Link href="/battle" className="text-accent hover:underline">
            Back to Battles
          </Link>
        </div>
      </Shell>
    );
  }
  return (
    <Shell user={user}>
      <Lobby
        view={view}
        meId={user.id}
        now={now}
        run={run}
        refetch={() => void refetch()}
        initialCode={params.get('code') ?? ''}
      />
    </Shell>
  );
}

function Shell({ user, children }: { readonly user: Me; readonly children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto bg-chart text-fg">
      <AppHeader user={user} />
      {children}
    </div>
  );
}
