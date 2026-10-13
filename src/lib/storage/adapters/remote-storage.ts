import type { StorageAdapter } from '@/lib/core';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type PendingOp = { readonly kind: 'set'; readonly value: unknown } | { readonly kind: 'remove' };

/** Browsers refuse `keepalive` bodies above 64 KiB. */
const KEEPALIVE_LIMIT = 60_000;

export class RemoteStorageError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Server-side persistence behind an HTTP endpoint (GET all records, PUT/DELETE one key).
 * Every record is fetched once by `RemoteStorage.load`, so reads are served from memory.
 * Writes go to the server; rapid writes to one key collapse into the latest value and
 * requests for a key never overtake each other.
 */
export class RemoteStorage implements StorageAdapter {
  readonly id = 'remote';
  private readonly pending = new Map<string, PendingOp>();
  private readonly inflight = new Map<string, Promise<void>>();

  private constructor(
    private readonly endpoint: string,
    private readonly fetchFn: FetchLike,
    private readonly records: Map<string, unknown>,
    private readonly onError: (error: RemoteStorageError) => void,
  ) {}

  static async load(
    endpoint: string,
    opts: { fetch?: FetchLike; onError?: (error: RemoteStorageError) => void } = {},
  ): Promise<RemoteStorage> {
    const fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
    const res = await fetchFn(endpoint, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) throw new RemoteStorageError(`Failed to load records (${res.status})`, res.status);
    const body = (await res.json()) as { records?: Record<string, unknown> };
    return new RemoteStorage(
      endpoint,
      fetchFn,
      new Map(Object.entries(body.records ?? {})),
      opts.onError ?? (() => {}),
    );
  }

  async get(key: string): Promise<unknown> {
    const v = this.records.get(key);
    return v === undefined ? undefined : structuredClone(v);
  }

  set(key: string, value: unknown): Promise<void> {
    const copy = structuredClone(value);
    this.records.set(key, copy);
    return this.schedule(key, { kind: 'set', value: copy });
  }

  remove(key: string): Promise<void> {
    this.records.delete(key);
    return this.schedule(key, { kind: 'remove' });
  }

  async keys(prefix = ''): Promise<string[]> {
    return [...this.records.keys()].filter((k) => k.startsWith(prefix));
  }

  /** Resolves once every queued write has reached the server. */
  async idle(): Promise<void> {
    while (this.inflight.size) await Promise.all(this.inflight.values());
  }

  private schedule(key: string, op: PendingOp): Promise<void> {
    this.pending.set(key, op);
    let running = this.inflight.get(key);
    if (!running) {
      running = this.drain(key);
      this.inflight.set(key, running);
    }
    return running;
  }

  private async drain(key: string): Promise<void> {
    try {
      for (let op = this.pending.get(key); op; op = this.pending.get(key)) {
        this.pending.delete(key);
        try {
          await this.send(key, op);
        } catch (e) {
          this.onError(e instanceof RemoteStorageError ? e : new RemoteStorageError(String(e), 0));
        }
      }
    } finally {
      this.inflight.delete(key);
    }
  }

  private async send(key: string, op: PendingOp): Promise<void> {
    const res =
      op.kind === 'set'
        ? await this.write('PUT', this.endpoint, JSON.stringify({ key, value: op.value }))
        : await this.write('DELETE', `${this.endpoint}?key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new RemoteStorageError(`Failed to save ${key} (${res.status})`, res.status);
  }

  private write(method: string, url: string, body?: string): Promise<Response> {
    return this.fetchFn(url, {
      method,
      credentials: 'same-origin',
      keepalive: (body?.length ?? 0) < KEEPALIVE_LIMIT,
      ...(body === undefined ? {} : { body, headers: { 'Content-Type': 'application/json' } }),
    });
  }
}
