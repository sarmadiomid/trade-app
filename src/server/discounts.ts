import 'server-only';
import { ObjectId } from 'mongodb';
import {
  discountRejectionMessage,
  normalizeDiscountCode,
  parseDiscountCatalog,
  quoteDiscount,
  type DiscountDefinition,
  type DiscountQuote,
  type DiscountRejection,
  type DiscountRule,
} from '@/lib/app/billing/discount';
import { subscriptionAmount, type BillingCycle, type PaidPlanId } from '@/components/billing/plans';
import { collections, type DiscountCodeDoc, type DiscountRedemptionDoc } from './db';
import { DISCOUNT_CATALOG } from './discount-catalog';

export type DiscountResult = { ok: true; quote: DiscountQuote } | { ok: false; error: string };

const globalForDiscount = globalThis as {
  __discountSync?: { key: string; pending: Promise<void> };
};

/** Upserts the catalog into Mongo. An empty catalog leaves stored codes untouched. */
export function syncDiscountCatalog(): Promise<void> {
  const key = `${JSON.stringify(DISCOUNT_CATALOG)}\n${process.env.DISCOUNT_CODES ?? ''}`;
  const current = globalForDiscount.__discountSync;
  if (current?.key === key) return current.pending;
  const pending = writeCatalog().catch((error: unknown) => {
    if (globalForDiscount.__discountSync?.pending === pending)
      delete globalForDiscount.__discountSync;
    throw error;
  });
  globalForDiscount.__discountSync = { key, pending };
  return pending;
}

/** Prices a code without consuming a use. */
export async function quoteDiscountCode(input: {
  readonly userId: ObjectId;
  readonly code: string;
  readonly planId: PaidPlanId;
  readonly cycle: BillingCycle;
  readonly now?: number;
}): Promise<DiscountResult> {
  await syncDiscountCatalog();
  const now = input.now ?? Date.now();
  const loaded = await loadRule(input.code, input.userId);
  if (!loaded.ok) return { ok: false, error: discountRejectionMessage(loaded.reason) };
  const quoted = quoteDiscount({
    code: input.code,
    rule: loaded.rule,
    subtotal: subscriptionAmount(input.planId, input.cycle),
    planId: input.planId,
    cycle: input.cycle,
    now,
  });
  if (!quoted.ok) return { ok: false, error: discountRejectionMessage(quoted.reason) };
  return quoted;
}

/** Claims one use at checkout start; release on cancel/fail, commit on pay. */
export async function reserveDiscountCode(input: {
  readonly userId: ObjectId;
  readonly code: string;
  readonly planId: PaidPlanId;
  readonly cycle: BillingCycle;
  readonly now?: number;
}): Promise<DiscountResult> {
  const quoted = await quoteDiscountCode(input);
  if (!quoted.ok) return quoted;
  const { discountCodes } = await discountCollections();
  const code = quoted.quote.code;
  const claimed = await discountCodes.findOneAndUpdate(
    {
      _id: code,
      active: true,
      $or: [
        { maxUses: null },
        { maxUses: { $exists: false } },
        { $expr: { $lt: ['$used', '$maxUses'] } },
      ],
    },
    { $inc: { used: 1 } },
  );
  if (!claimed) {
    const again = await quoteDiscountCode(input);
    return again.ok ? { ok: false, error: discountRejectionMessage('exhausted') } : again;
  }
  return quoted;
}

export async function releaseDiscountReserve(code: string): Promise<void> {
  const normalized = normalizeDiscountCode(code);
  if (normalized) await releaseUse(normalized);
}

/** Writes the redemption row after payment (capacity already reserved). */
export async function commitDiscountRedemption(input: {
  readonly userId: ObjectId;
  readonly code: string;
  readonly planId: PaidPlanId;
  readonly cycle: BillingCycle;
  readonly now?: number;
}): Promise<DiscountResult> {
  await syncDiscountCatalog();
  const now = input.now ?? Date.now();
  const code = normalizeDiscountCode(input.code);
  if (!code) return { ok: false, error: discountRejectionMessage('invalid') };
  const loaded = await loadRule(input.code, input.userId);
  if (!loaded.ok || !loaded.rule) {
    return { ok: false, error: discountRejectionMessage(loaded.ok ? 'invalid' : loaded.reason) };
  }
  const subtotal = subscriptionAmount(input.planId, input.cycle);
  const ruleForQuote: DiscountRule = {
    ...loaded.rule,
    used: Math.max(0, loaded.rule.used - 1),
  };
  const priced = quoteDiscount({
    code: input.code,
    rule: ruleForQuote,
    subtotal,
    planId: input.planId,
    cycle: input.cycle,
    now,
  });
  if (!priced.ok) return { ok: false, error: discountRejectionMessage(priced.reason) };

  const { discountRedemptions } = await discountCollections();
  const perUser = loaded.rule.perUser;
  try {
    if (perUser === null) {
      await discountRedemptions.insertOne(
        redemption(priced.quote, input, now, new ObjectId().toHexString()),
      );
    } else {
      const uses = await discountRedemptions.countDocuments({ code, userId: input.userId });
      if (uses >= perUser) {
        await releaseUse(code);
        return { ok: false, error: discountRejectionMessage('used') };
      }
      await discountRedemptions.insertOne(
        redemption(priced.quote, input, now, `${code}:${input.userId.toHexString()}:${uses + 1}`),
      );
    }
  } catch (error) {
    await releaseUse(code);
    if (isDuplicateKey(error)) return { ok: false, error: discountRejectionMessage('used') };
    throw error;
  }
  return priced;
}

/** Reserve + commit in one step (e.g. free checkout). */
export async function redeemDiscountCode(input: {
  readonly userId: ObjectId;
  readonly code: string;
  readonly planId: PaidPlanId;
  readonly cycle: BillingCycle;
  readonly now?: number;
}): Promise<DiscountResult> {
  const reserved = await reserveDiscountCode(input);
  if (!reserved.ok) return reserved;
  const committed = await commitDiscountRedemption(input);
  if (!committed.ok) return committed;
  return reserved;
}

async function loadRule(
  raw: string,
  userId: ObjectId,
): Promise<{ ok: true; rule: DiscountRule | null } | { ok: false; reason: DiscountRejection }> {
  if (!raw.trim()) return { ok: false, reason: 'empty' };
  const code = normalizeDiscountCode(raw);
  if (!code) return { ok: false, reason: 'invalid' };
  const { discountCodes, discountRedemptions } = await discountCollections();
  const doc = await discountCodes.findOne({ _id: code });
  if (!doc) return { ok: true, rule: null };
  const perUser = doc.perUser ?? null;
  const userUses =
    perUser === null ? 0 : await discountRedemptions.countDocuments({ code, userId });
  return { ok: true, rule: ruleFrom(doc, userUses) };
}

function ruleFrom(doc: DiscountCodeDoc, userUses: number): DiscountRule {
  return {
    kind: doc.kind,
    value: doc.value,
    plans: doc.plans ?? [],
    cycles: doc.cycles ?? [],
    active: doc.active !== false,
    expiresAt: doc.expiresAt ? doc.expiresAt.getTime() : null,
    maxUses: doc.maxUses ?? null,
    used: doc.used ?? 0,
    perUser: doc.perUser ?? null,
    userUses,
    label: doc.label ?? '',
  };
}

function redemption(
  quote: DiscountQuote,
  input: { readonly userId: ObjectId; readonly planId: PaidPlanId; readonly cycle: BillingCycle },
  now: number,
  id: string,
): DiscountRedemptionDoc {
  return {
    _id: id,
    code: quote.code,
    userId: input.userId,
    planId: input.planId,
    cycle: input.cycle,
    subtotal: quote.subtotal,
    discount: quote.discount,
    total: quote.total,
    createdAt: new Date(now),
  };
}

async function releaseUse(code: string): Promise<void> {
  const { discountCodes } = await discountCollections();
  await discountCodes.updateOne({ _id: code, used: { $gt: 0 } }, { $inc: { used: -1 } });
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

async function discountCollections() {
  const { db } = await collections();
  return {
    discountCodes: db.collection<DiscountCodeDoc>('discount_codes'),
    discountRedemptions: db.collection<DiscountRedemptionDoc>('discount_redemptions'),
  };
}

async function writeCatalog(): Promise<void> {
  const codes = loadCatalog();
  if (codes.length === 0) return;
  const { discountCodes } = await discountCollections();
  const now = new Date();
  await discountCodes.bulkWrite(
    codes.map((code) => ({
      updateOne: {
        filter: { _id: code.code },
        update: {
          $set: {
            kind: code.kind,
            value: code.value,
            plans: [...code.plans],
            cycles: [...code.cycles],
            active: code.active,
            expiresAt: code.expiresAt === null ? null : new Date(code.expiresAt),
            maxUses: code.maxUses,
            perUser: code.perUser,
            label: code.label,
            updatedAt: now,
          },
          $setOnInsert: { used: 0, createdAt: now },
        },
        upsert: true,
      },
    })),
  );
}

function loadCatalog(): DiscountDefinition[] {
  const builtIn = parseDiscountCatalog(DISCOUNT_CATALOG);
  const fromEnv = parseDiscountCatalog(process.env.DISCOUNT_CODES);
  if (builtIn.error) console.error(`[discount] ${builtIn.error}`);
  if (fromEnv.error) console.error(`[discount] ${fromEnv.error}`);
  const merged = new Map<string, DiscountDefinition>();
  for (const code of builtIn.codes) merged.set(code.code, code);
  for (const code of fromEnv.codes) merged.set(code.code, code);
  return [...merged.values()];
}
