import type { StorageAdapter } from '@/lib/core';
import {
  summarize,
  type BacktestSession,
  type LoggedAction,
  type SessionSummary,
} from './model';
import { parseSession } from './schema';

/**
 * Persistence port of the backtest module. The UI and controller only talk to this interface;
 * swap the implementation (REST API, a database) in the composition root.
 */
export interface BacktestRepository {
  list(): Promise<SessionSummary[]>;
  load(id: string): Promise<BacktestSession | null>;
  save(session: BacktestSession): Promise<void>;
  /**
   * Asks the server to store one trade before the chart shows it. Absent on local
   * repositories (tests); the browser repository waits for the database.
   */
  confirmAction?(id: string, action: LoggedAction): Promise<void>;
  remove(id: string): Promise<void>;
  /** Stores an image (data URL) and returns its id. */
  saveScreenshot(id: string, dataUrl: string): Promise<void>;
  loadScreenshot(id: string): Promise<string | null>;
  removeScreenshot(id: string): Promise<void>;
}

/** Persisted envelope (same shape as the app's other records). */
interface Envelope {
  readonly kind: 'backtestSession';
  readonly schemaVersion: number;
  readonly data: unknown;
}

export const SESSION_SCHEMA_VERSION = 1;

/** Migrations by source version (add `1: (data) => …` when bumping to 2). */
const MIGRATIONS: Readonly<Record<number, (data: unknown) => unknown>> = {};

const KEY = {
  index: 'backtest:index',
  session: (id: string) => `backtest:session:${id}`,
  shot: (id: string) => `backtest:shot:${id}`,
};

export function readSessionEnvelope(raw: unknown): BacktestSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const env = raw as Partial<Envelope>;
  if (env.kind !== 'backtestSession' || typeof env.schemaVersion !== 'number') return null;
  let data = env.data;
  for (let v = env.schemaVersion; v < SESSION_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return null;
    data = step(data);
  }
  return parseSession(data);
}

/** BacktestRepository over any key/value StorageAdapter (IndexedDB in the browser). */
export class StorageBacktestRepository implements BacktestRepository {
  constructor(private readonly storage: StorageAdapter) {}

  async list(): Promise<SessionSummary[]> {
    const ids = await this.ids();
    const out: SessionSummary[] = [];
    for (const id of ids) {
      const s = await this.load(id);
      if (s) out.push(summarize(s));
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async load(id: string): Promise<BacktestSession | null> {
    try {
      return readSessionEnvelope(await this.storage.get(KEY.session(id)));
    } catch {
      return null;
    }
  }

  async save(session: BacktestSession): Promise<void> {
    const env: Envelope = {
      kind: 'backtestSession',
      schemaVersion: SESSION_SCHEMA_VERSION,
      data: session,
    };
    await this.storage.set(KEY.session(session.id), env);
    const ids = await this.ids();
    if (!ids.includes(session.id)) await this.storage.set(KEY.index, [...ids, session.id]);
  }

  async remove(id: string): Promise<void> {
    const s = await this.load(id);
    for (const entry of Object.values(s?.journal ?? {}))
      for (const shot of entry.screenshots) await this.removeScreenshot(shot);
    await this.storage.remove(KEY.session(id));
    const ids = await this.ids();
    await this.storage.set(
      KEY.index,
      ids.filter((x) => x !== id),
    );
  }

  saveScreenshot(id: string, dataUrl: string): Promise<void> {
    return this.storage.set(KEY.shot(id), dataUrl);
  }

  async loadScreenshot(id: string): Promise<string | null> {
    const v = await this.storage.get(KEY.shot(id));
    return typeof v === 'string' ? v : null;
  }

  removeScreenshot(id: string): Promise<void> {
    return this.storage.remove(KEY.shot(id));
  }

  private async ids(): Promise<string[]> {
    const v = await this.storage.get(KEY.index);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  }
}
