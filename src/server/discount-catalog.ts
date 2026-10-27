import type { DiscountSeed } from '@/lib/app/billing/discount';

/**
 * Discount codes shipped with the app. A code in the DISCOUNT_CODES env (JSON array)
 * with the same name replaces the one here. Usage counts live in Mongo and are kept
 * across syncs. Set `active: false` to retire a code.
 *
 * Example:
 * { code: 'WELCOME20', kind: 'percent', value: 20, perUser: 1, label: 'تخفیف خوش‌آمد' }
 */
export const DISCOUNT_CATALOG: readonly DiscountSeed[] = [];
