import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement('a', { href, ...rest }, children),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'bt0yimqt81' }),
  usePathname: () => '/home/stats/bt0yimqt81',
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
}));

vi.mock('next/dynamic', () => ({
  default: () =>
    function AnalyticsMock(props: { readonly id: string; readonly embedded?: boolean }) {
      return createElement('div', {
        'data-testid': 'analytics',
        'data-session': props.id,
        'data-embedded': props.embedded ? '1' : '0',
      });
    },
}));

import { SessionAnalytics } from '@/components/home/SessionAnalytics';

describe('SessionAnalytics', () => {
  it('renders that session inside the home shell and not the all-sessions overview', () => {
    const html = renderToStaticMarkup(
      createElement(SessionAnalytics, {
        user: { id: 'u1', name: 'تست', phone: '09120000000' },
        sessionId: 'from-prop',
      }),
    );

    expect(html).toContain('data-testid="session-analytics"');
    expect(html).toContain('data-session="bt0yimqt81"');
    expect(html).toContain('data-embedded="1"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('آمار');
    expect(html).not.toContain('جلسه‌های اخیر');
    expect(html).not.toContain('خلاصهٔ تمرین');
    expect(html).toContain('href="/home/stats/bt0yimqt81"');
  });
});
