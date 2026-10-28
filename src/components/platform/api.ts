'use client';

import { isPlanLimitMessage, openPlanPrompt } from '@/lib/app';

/** Error from the platform's JSON API, with the HTTP status. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Same-origin JSON request; non-2xx answers throw ApiError with the server's message. */
export async function api<T>(
  url: string,
  init: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      ...(init.form
        ? { body: init.form }
        : init.body !== undefined
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.body) }
          : {}),
    });
  } catch {
    throw new ApiError('Could not reach the server', 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401 && typeof window !== 'undefined') {
    const login = new URL('/login', window.location.origin);
    login.searchParams.set('next', window.location.pathname);
    window.location.replace(login.href);
  }
  if (!res.ok) {
    const message = data.error ?? `Request failed (${res.status})`;
    if (isPlanLimitMessage(message)) openPlanPrompt(message);
    throw new ApiError(message, res.status);
  }
  return data;
}

export interface Me {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
}
