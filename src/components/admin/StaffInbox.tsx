'use client';

import { useEffect, useState } from 'react';
import { faNum, formatJalaliDateTime } from '@/lib/locale/jalali';
import {
  subjectById,
  supportErrorText,
  SUPPORT_STATUS_LABEL,
  type SupportMessage,
  type SupportStatus,
} from '@/lib/support/catalog';
import { ApiError, api } from '@/components/platform/api';
import { Notice, PageHead, Panel, fieldClass } from './ui';

interface StaffTicket {
  readonly id: string;
  readonly number: number;
  readonly subject: string;
  readonly title: string;
  readonly symbol: string;
  readonly status: SupportStatus;
  readonly updatedAt: number;
  readonly preview: string;
  readonly userName: string;
  readonly phone: string;
}

interface Thread {
  readonly ticket: StaffTicket;
  readonly messages: readonly SupportMessage[];
}

const FILTERS: ReadonlyArray<{ id: SupportStatus | 'all'; label: string }> = [
  { id: 'open', label: 'باز' },
  { id: 'answered', label: 'پاسخ‌داده‌شده' },
  { id: 'closed', label: 'بسته' },
  { id: 'all', label: 'همه' },
];

export function StaffInbox({ initialId }: { readonly initialId: string | null }) {
  const [status, setStatus] = useState<SupportStatus | 'all'>('open');
  const [tickets, setTickets] = useState<StaffTicket[]>([]);
  const [active, setActive] = useState<string | null>(initialId);
  const [thread, setThread] = useState<Thread | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = async (next = status) => {
    const data = await api<{ tickets: StaffTicket[] }>(`/api/admin/support?status=${next}`);
    setTickets(data.tickets);
    return data.tickets;
  };

  useEffect(() => {
    let live = true;
    void api<{ tickets: StaffTicket[] }>('/api/admin/support?status=open')
      .then((data) => {
        if (!live) return;
        setTickets(data.tickets);
        const first = data.tickets[0];
        if (initialId) setActive(initialId);
        else if (first) setActive(first.id);
      })
      .catch((e: unknown) => {
        if (live) setError(messageOf(e));
      });
    return () => {
      live = false;
    };
  }, [initialId]);

  useEffect(() => {
    if (!active) return;
    let live = true;
    void api<Thread>(`/api/admin/support/${active}`)
      .then((data) => {
        if (live) setThread(data);
      })
      .catch((e: unknown) => {
        if (live) setError(messageOf(e));
      });
    return () => {
      live = false;
    };
  }, [active]);

  const reply = async () => {
    if (!active) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/support/${active}/reply`, { method: 'POST', body: { body } });
      setBody('');
      const data = await api<Thread>(`/api/admin/support/${active}`);
      setThread(data);
      await loadList();
    } catch (e) {
      setError(e instanceof ApiError ? supportErrorText(e.message) : 'پاسخ ارسال نشد');
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await api(`/api/admin/support/${active}/close`, { method: 'POST', body: {} });
      await loadList();
      const data = await api<Thread>(`/api/admin/support/${active}`);
      setThread(data);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHead
        kicker="پشتیبانی"
        title="صندوق درخواست‌ها"
        text="درخواست نماد دلخواه، پرداخت، حساب و مشکل فنی اینجاست. پاسخ شما برای کاربر به‌عنوان پیام پشتیبانی می‌آید."
      />
      {error ? (
        <div className="mb-3">
          <Notice tone="bad">{error}</Notice>
        </div>
      ) : null}
      <div className="grid min-h-[560px] items-stretch gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex gap-1 border-b border-[var(--a-line)] p-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setStatus(item.id);
                  void loadList(item.id).catch((e: unknown) => setError(messageOf(e)));
                }}
                className={`h-8 flex-1 rounded-lg text-[12px] ${status === item.id ? 'bg-white/10 text-white' : 'text-[var(--a-muted)]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {tickets.length === 0 ? (
              <li className="px-4 py-8 text-[13px] text-[var(--a-muted)]">درخواستی نیست.</li>
            ) : null}
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => setActive(ticket.id)}
                  className={`w-full border-b border-[var(--a-line)] px-4 py-3 text-right ${active === ticket.id ? 'bg-white/[0.04]' : ''}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      #{faNum(ticket.number)} {ticket.title || subjectById(ticket.subject)?.label}
                    </span>
                    <span className="text-[11px] text-[var(--a-muted)]">
                      {SUPPORT_STATUS_LABEL[ticket.status]}
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] text-[var(--a-muted)]">
                    {ticket.userName}
                    {ticket.symbol ? ` · ${ticket.symbol}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="flex min-h-[560px] flex-col p-5">
          {thread && thread.ticket.id === active ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--a-line)] pb-3">
                <div>
                  <h3 className="text-[16px] font-semibold">
                    #{faNum(thread.ticket.number)}{' '}
                    {thread.ticket.title || subjectById(thread.ticket.subject)?.label}
                  </h3>
                  <p className="mt-1 text-[12.5px] text-[var(--a-muted)]">
                    {thread.ticket.userName}
                    <bdi dir="ltr" className="ms-2 font-mono">
                      {thread.ticket.phone}
                    </bdi>
                    {thread.ticket.symbol ? ` · ${thread.ticket.symbol}` : ''}
                  </p>
                </div>
                {thread.ticket.status !== 'closed' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void close()}
                    className="h-9 rounded-lg border border-white/10 px-3 text-[12.5px]"
                  >
                    بستن درخواست
                  </button>
                ) : null}
              </div>
              <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
                {thread.messages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-[90%] rounded-2xl px-3 py-2 ${message.role === 'support' ? 'ms-auto bg-[#3b78ff]/15' : 'bg-white/[0.04]'}`}
                  >
                    <p className="text-[11px] text-[var(--a-muted)]">
                      {message.name} · {formatJalaliDateTime(message.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-6">
                      {message.body}
                    </p>
                  </article>
                ))}
              </div>
              {thread.ticket.status !== 'closed' ? (
                <div className="mt-4 flex gap-2">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                    placeholder="پاسخ پشتیبانی"
                    className={`${fieldClass} h-auto py-2`}
                  />
                  <button
                    type="button"
                    disabled={busy || body.trim().length < 2}
                    onClick={() => void reply()}
                    className="h-11 shrink-0 self-end rounded-xl bg-[var(--a-accent)] px-4 text-[13.5px] font-semibold text-white disabled:opacity-40"
                  >
                    ارسال
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="m-auto text-[13.5px] text-[var(--a-muted)]">یک درخواست را انتخاب کنید.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'ارتباط برقرار نشد';
}
