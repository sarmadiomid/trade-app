'use client';

import dynamic from 'next/dynamic';
import type { Me } from '../platform/api';

const loading = () => <div className="h-full w-full bg-chart" />;
const hubLoading = () => <div className="home-shell h-full w-full" />;

/** Client-only boundaries: battle pages use the canvas chart and browser storage. */
const Hub = dynamic(() => import('./BattlesHub'), { ssr: false, loading: hubLoading });
const Room = dynamic(() => import('./room/BattleRoom'), { ssr: false, loading });

export function BattlesHubClient({ user }: { readonly user: Me }) {
  return <Hub user={user} />;
}

export function BattleRoomClient({ id, user }: { readonly id: string; readonly user: Me }) {
  return <Room id={id} user={user} />;
}
