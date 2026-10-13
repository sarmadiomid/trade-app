import type { StorageAdapter } from '@/lib/core';

/**
 * Prefixes every key with a namespace, except the keys listed as shared, so one chart can keep
 * its own records (e.g. a backtest session's drawings and timeframe) while still using the
 * user's themes and settings.
 */
export class NamespacedStorage implements StorageAdapter {
  readonly id: string;

  constructor(
    private readonly inner: StorageAdapter,
    private readonly prefix: string,
    private readonly shared: readonly string[] = [],
  ) {
    this.id = `${inner.id}:${prefix}`;
  }

  private key(k: string): string {
    return this.shared.includes(k) ? k : `${this.prefix}${k}`;
  }

  get(key: string): Promise<unknown> {
    return this.inner.get(this.key(key));
  }

  set(key: string, value: unknown): Promise<void> {
    return this.inner.set(this.key(key), value);
  }

  remove(key: string): Promise<void> {
    return this.inner.remove(this.key(key));
  }

  async keys(prefix = ''): Promise<string[]> {
    const own = await this.inner.keys(`${this.prefix}${prefix}`);
    const shared = this.shared.filter((k) => k.startsWith(prefix));
    return [...own.map((k) => k.slice(this.prefix.length)), ...shared];
  }
}
