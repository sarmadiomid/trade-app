import 'server-only';
import type { ObjectId } from 'mongodb';
import type { AccountState } from '@/lib/backtest';
import { recordsFromAccount } from '@/lib/backtest/session/positions';
import { collections, type PositionEventDoc } from '../db';

export type PositionScope = PositionEventDoc['scope'];

/** Replaces the stored opens and closes of one account with the simulation's record. */
export async function replacePositionEvents(
  userId: ObjectId,
  scope: PositionScope,
  scopeId: string,
  symbol: string,
  account: AccountState,
): Promise<void> {
  const records = recordsFromAccount(account);
  const { positionEvents } = await collections();
  const ids = records.map(
    (r, i) =>
      `${scope}:${scopeId}:${userId.toHexString()}:${r.kind}:${r.positionId}:${r.marketTime}:${i}`,
  );
  if (ids.length === 0) {
    await positionEvents.deleteMany({ userId, scope, scopeId });
    return;
  }
  await positionEvents.bulkWrite(
    records.map((r, i) => ({
      updateOne: {
        filter: { _id: ids[i]! },
        update: {
          $setOnInsert: {
            userId,
            scope,
            scopeId,
            symbol,
            kind: r.kind,
            positionId: r.positionId,
            marketTime: r.marketTime,
            price: r.price,
            volume: r.volume,
            side: r.side,
            reason: r.reason,
            pnl: r.pnl,
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    })),
  );
  await positionEvents.deleteMany({ userId, scope, scopeId, _id: { $nin: ids } });
}

export async function deletePositionEvents(
  userId: ObjectId,
  scope: PositionScope,
  scopeId: string,
): Promise<void> {
  const { positionEvents } = await collections();
  await positionEvents.deleteMany({ userId, scope, scopeId });
}

export async function deleteScopeEvents(scope: PositionScope, scopeId: string): Promise<void> {
  const { positionEvents } = await collections();
  await positionEvents.deleteMany({ scope, scopeId });
}
