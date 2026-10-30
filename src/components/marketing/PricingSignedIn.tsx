'use client';

import { useEffect, useState } from 'react';
import { LandingPricing } from './LandingPricing';

/** Hydrates signed-in state for marketing pricing CTAs without blocking SSR. */
export function PricingSignedIn() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { signedIn?: boolean } | null) => {
        if (!cancelled && data?.signedIn) setSignedIn(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <LandingPricing signedIn={signedIn} />;
}
