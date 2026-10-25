import { isPlanLimitMessage, openPlanPrompt } from '@/lib/app/billing';
import type {
  BacktestRepository,
  BacktestSession,
  LoggedAction,
  SessionSummary,
} from '@/lib/backtest';

const SESSIONS = '/api/backtest/sessions';

async function call<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('ارتباط با سرور برقرار نشد');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401 && typeof window !== 'undefined') {
    const login = new URL('/login', window.location.origin);
    login.searchParams.set('next', window.location.pathname);
    window.location.replace(login.href);
  }
  if (!res.ok) {
    const message = data.error ?? 'ذخیره روی سرور ناموفق بود';
    if (isPlanLimitMessage(message)) openPlanPrompt(message);
    throw new Error(message);
  }
  return data;
}

/**
 * Backtest sessions, screenshots and trade actions on the server. Nothing is written to
 * the browser's storage. `confirmAction` resolves only after the database has the trade.
 */
export class RemoteBacktestRepository implements BacktestRepository {
  private readonly tails = new Map<string, Promise<void>>();

  async list(): Promise<SessionSummary[]> {
    const body = await call<{ sessions?: SessionSummary[] }>(SESSIONS);
    return body.sessions ?? [];
  }

  async load(id: string): Promise<BacktestSession | null> {
    try {
      const body = await call<{ session: BacktestSession }>(
        `${SESSIONS}/${encodeURIComponent(id)}`,
      );
      return body.session;
    } catch (e) {
      if (e instanceof Error && e.message === 'جلسه پیدا نشد') return null;
      throw e;
    }
  }

  save(session: BacktestSession): Promise<void> {
    return this.queue(session.id, async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await call(`${SESSIONS}/${encodeURIComponent(session.id)}`, 'PUT', { session });
          return;
        } catch (e) {
          if (attempt < 2 && e instanceof Error && /هم‌زمان/.test(e.message)) continue;
          throw e;
        }
      }
    });
  }

  confirmAction(id: string, action: LoggedAction): Promise<void> {
    return this.queue(id, () =>
      call(`${SESSIONS}/${encodeURIComponent(id)}/actions`, 'POST', {
        t: action.t,
        action: action.a,
      }),
    );
  }

  remove(id: string): Promise<void> {
    return call(`${SESSIONS}/${encodeURIComponent(id)}`, 'DELETE');
  }

  saveScreenshot(id: string, dataUrl: string): Promise<void> {
    return call(`/api/backtest/shots/${encodeURIComponent(id)}`, 'PUT', { dataUrl });
  }

  async loadScreenshot(id: string): Promise<string | null> {
    try {
      const body = await call<{ dataUrl?: string }>(
        `/api/backtest/shots/${encodeURIComponent(id)}`,
      );
      return body.dataUrl ?? null;
    } catch {
      return null;
    }
  }

  removeScreenshot(id: string): Promise<void> {
    return call(`/api/backtest/shots/${encodeURIComponent(id)}`, 'DELETE');
  }

  /** One write per session at a time, so a trade and a cursor save cannot pass each other. */
  private queue(id: string, job: () => Promise<void>): Promise<void> {
    const prev = this.tails.get(id) ?? Promise.resolve();
    const run = prev.then(job, job);
    this.tails.set(
      id,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }
}
