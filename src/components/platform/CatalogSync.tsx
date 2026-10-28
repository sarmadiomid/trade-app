'use client';

import { useEffect } from 'react';
import { ensureCustomCatalog } from '@/lib/data';

/** Publishes admin symbols into the practice picker and the replay chart. */
export function CatalogSync() {
  useEffect(() => {
    void ensureCustomCatalog();
  }, []);
  return null;
}
