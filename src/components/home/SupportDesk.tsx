'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react';
import { faDigits, formatJalaliDate } from '@/lib/locale/jalali';
import {
  checkSupportFile,
  parseNewTicket,
  parseSupportBody,
  pingSupportInbox,
  subjectById,
  SUPPORT_BODY_MAX,
  SUPPORT_EMAIL,
  SUPPORT_FILE_ACCEPT,
  SUPPORT_FILE_MAX_COUNT,
  SUPPORT_STATUS_LABEL,
  SUPPORT_SUBJECTS,
  supportErrorText,
  ticketHeading,
  type SupportMessage,
  type SupportStatus,
  type SupportSubjectId,
  type SupportTicket,
} from '@/lib/support/catalog';
import { ApiError, api, type Me } from '../platform/api';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import { HomeShell, ShellMenuButton, ShellTools } from './HomeShell';

const TEHRAN_MS = 3.5 * 60 * 60 * 1000;
const DAY = 86_400_000;

const FILTERS = [
  { id: 'all', label: 'همه' },
  { id: 'open', label: 'انتظار' },
  { id: 'answered', label: 'پاسخ' },
  { id: 'closed', label: 'بسته' },
] as const;

type Filter = (typeof FILTERS)[number]['id'];

const FIELD =
  'w-full rounded-xl border border-[var(--h-line)] bg-[var(--h-field)] px-3 text-[14px] text-[var(--h-text)] outline-none transition placeholder:text-[var(--h-muted)] focus:border-[var(--h-accent)]';

function tehranDay(ts: number): number {
  return Math.floor((ts + TEHRAN_MS) / DAY);
}

function clock(ts: number): string {
  const d = new Date(ts + TEHRAN_MS);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return faDigits(`${hh}:${mm}`);
}

function dayLabel(ts: number, now = Date.now()): string {
  const day = tehranDay(ts);
  const today = tehranDay(now);
  if (day === today) return 'امروز';
  if (day + 1 === today) return 'دیروز';
  return formatJalaliDate(ts + TEHRAN_MS);
}

function listWhen(ts: number, now = Date.now()): string {
  const day = tehranDay(ts);
  const today = tehranDay(now);
  if (day === today) return clock(ts);
  if (day + 1 === today) return 'دیروز';
  return formatJalaliDate(ts + TEHRAN_MS);
}

function statusClass(status: SupportStatus): string {
  if (status === 'open') return 'support-status-open';
  if (status === 'answered') return 'support-status-answered';
  return 'support-status-closed';
}

function failureText(error: unknown): string {
  if (error instanceof ApiError) return supportErrorText(error.message);
  return supportErrorText('Could not reach the server');
}

function upsertTicket(
  list: readonly SupportTicket[] | null,
  ticket: SupportTicket,
): SupportTicket[] {
  const prev = list ?? [];
  const next = prev.some((item) => item.id === ticket.id)
    ? prev.map((item) => (item.id === ticket.id ? ticket : item))
    : [ticket, ...prev];
  return [...next].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** `/home/support`: ticket inbox and the conversation with Candelo support. */
export function SupportDesk({ user }: { readonly user: Me }) {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('ticket');
  const [tickets, setTickets] = useState<readonly SupportTicket[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [thread, setThread] = useState<{
    ticket: SupportTicket;
    messages: readonly SupportMessage[];
  } | null>(null);
  const [threadError, setThreadError] = useState<{ id: string; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState<{ id: string; text: string } | null>(null);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [live, setLive] = useState('');

  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const composer = useRef<HTMLTextAreaElement>(null);
  const seenSupport = useRef(new Set<string>());
  const announcedFor = useRef<string | null>(null);
  const unreadSeen = useRef<number | null>(null);
  const draft = selectedId ? (drafts[selectedId] ?? '') : '';
  const files = selectedId ? (pendingFiles[selectedId] ?? []) : [];
  const confirmClose = confirmFor === selectedId;

  const select = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (id) next.set('ticket', id);
      else next.delete('ticket');
      const search = next.toString();
      router.replace(search ? `/home/support?${search}` : '/home/support', { scroll: false });
    },
    [params, router],
  );

  const refreshList = useCallback(() => {
    void api<{ tickets: SupportTicket[]; unread: number }>('/api/support/tickets').then(
      (data) => {
        setTickets(data.tickets);
        setListError(null);
        if (unreadSeen.current !== null && unreadSeen.current !== data.unread) pingSupportInbox();
        unreadSeen.current = data.unread;
      },
      (error: unknown) => setListError(failureText(error)),
    );
  }, []);

  useEffect(() => {
    refreshList();
    const timer = window.setInterval(() => {
      if (!document.hidden) refreshList();
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [refreshList]);

  useEffect(() => {
    const token = { current: true };
    if (!selectedId) return;
    const load = (silent: boolean) => {
      void api<{ ticket: SupportTicket; messages: SupportMessage[]; markedRead: boolean }>(
        `/api/support/tickets/${selectedId}`,
      )
        .then((data) => {
          if (!token.current) return;
          if (data.markedRead) pingSupportInbox();
          setThread((cur) => {
            if (
              silent &&
              cur &&
              cur.ticket.id === data.ticket.id &&
              cur.ticket.updatedAt === data.ticket.updatedAt &&
              cur.messages.length === data.messages.length &&
              cur.messages.every((message, index) => message.id === data.messages[index]?.id)
            ) {
              return cur;
            }
            return data;
          });
          if (announcedFor.current === data.ticket.id) {
            const fresh = data.messages.find(
              (message) => message.role === 'support' && !seenSupport.current.has(message.id),
            );
            if (fresh) setLive(`پاسخ جدید از پشتیبانی. ${fresh.body.slice(0, 140)}`);
          } else {
            announcedFor.current = data.ticket.id;
          }
          for (const message of data.messages) seenSupport.current.add(message.id);
          setThreadError(null);
          setTickets((prev) => upsertTicket(prev, data.ticket));
        })
        .catch((error: unknown) => {
          if (!token.current || silent) return;
          setThread(null);
          setThreadError({ id: selectedId, text: failureText(error) });
        });
    };
    stick.current = true;
    load(false);
    const timer = window.setInterval(() => {
      if (!document.hidden) load(true);
    }, 8_000);
    return () => {
      token.current = false;
      window.clearInterval(timer);
    };
  }, [selectedId]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !stick.current) return;
    el.scrollTop = el.scrollHeight;
  }, [thread?.messages, selectedId]);

  useEffect(() => {
    if (!selectedId || !window.matchMedia('(min-width: 1024px)').matches) return;
    composer.current?.focus();
  }, [selectedId]);

  const visible = (tickets ?? []).filter((ticket) => {
    if (filter !== 'all' && ticket.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const subject = subjectById(ticket.subject)?.label ?? '';
    return `${ticketHeading(ticket)} ${subject} ${ticket.symbol} ${ticket.preview} ${ticket.number}`
      .toLowerCase()
      .includes(q);
  });

  const counts = {
    all: tickets?.length ?? 0,
    open: tickets?.filter((ticket) => ticket.status === 'open').length ?? 0,
    answered: tickets?.filter((ticket) => ticket.status === 'answered').length ?? 0,
    closed: tickets?.filter((ticket) => ticket.status === 'closed').length ?? 0,
  };

  const active = thread && thread.ticket.id === selectedId ? thread : null;
  const canReply = active?.messages.some((message) => message.role === 'support') ?? false;
  const shownThreadError = threadError?.id === selectedId ? threadError.text : null;
  const threadLoading = Boolean(selectedId) && !active && !shownThreadError;
  const shownComposeError = composeError?.id === selectedId ? composeError.text : null;

  const send = async () => {
    if (!selectedId || sending || !canReply) return;
    const trimmed = draft.trim();
    const parsed = trimmed === '' ? { ok: true as const, text: '' } : parseSupportBody(draft);
    if (!parsed.ok) {
      setComposeError({ id: selectedId, text: supportErrorText(parsed.error) });
      return;
    }
    if (!parsed.text && files.length === 0) {
      setComposeError({ id: selectedId, text: supportErrorText('Message too short') });
      return;
    }
    setSending(true);
    setComposeError(null);
    try {
      const form = new FormData();
      form.set('body', parsed.text);
      for (const file of files) form.append('file', file);
      const data = await api<{ ticket: SupportTicket; message: SupportMessage }>(
        `/api/support/tickets/${selectedId}/messages`,
        { method: 'POST', form },
      );
      setThread((cur) =>
        cur && cur.ticket.id === selectedId
          ? {
              ticket: data.ticket,
              messages: cur.messages.some((message) => message.id === data.message.id)
                ? cur.messages
                : [...cur.messages, data.message],
            }
          : { ticket: data.ticket, messages: [data.message] },
      );
      setTickets((prev) => upsertTicket(prev, data.ticket));
      setDrafts((prev) => ({ ...prev, [selectedId]: '' }));
      setPendingFiles((prev) => ({ ...prev, [selectedId]: [] }));
      stick.current = true;
    } catch (error) {
      setComposeError({ id: selectedId, text: failureText(error) });
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (!selectedId || closing) return;
    setClosing(true);
    setComposeError(null);
    try {
      const data = await api<{ ticket: SupportTicket }>(
        `/api/support/tickets/${selectedId}/close`,
        { method: 'POST', body: {} },
      );
      setThread((cur) =>
        cur && cur.ticket.id === selectedId ? { ...cur, ticket: data.ticket } : cur,
      );
      setTickets((prev) => upsertTicket(prev, data.ticket));
      setConfirmFor(null);
    } catch (error) {
      setComposeError({ id: selectedId, text: failureText(error) });
    } finally {
      setClosing(false);
    }
  };

  const onCreated = (ticket: SupportTicket, message: SupportMessage) => {
    setTickets((prev) => upsertTicket(prev, ticket));
    setThread({ ticket, messages: [message] });
    setCreating(false);
    stick.current = true;
    pingSupportInbox();
    select(ticket.id);
  };

  return (
    <HomeShell user={user} notices={0} noticeMenu={null}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex min-w-0 items-center gap-2">
            <ShellMenuButton />
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-bold leading-none sm:text-[28px]">
                پشتیبانی
              </h1>
              <p className="mt-1 hidden text-[12.5px] text-[var(--h-muted)] sm:block">
                درخواست بنویسید و پاسخ را در همین گفتگو بگیرید.
              </p>
            </div>
          </div>
          <ShellTools />
        </header>

        <div className="mt-4 flex min-h-0 flex-1 border-t border-[var(--h-line)]">
          <aside
            className={`${selectedId ? 'hidden lg:flex' : 'flex'} min-h-0 w-full shrink-0 flex-col border-[var(--h-line)] bg-[var(--h-side)] lg:w-[340px] lg:border-e`}
          >
            <div className="flex items-center gap-2 px-3 pt-3">
              <h2 className="text-[13px] font-semibold">درخواست‌ها</h2>
              <button
                type="button"
                data-testid="support-new"
                onClick={() => setCreating(true)}
                className="ms-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--h-accent)] px-3 text-[13px] font-semibold text-white transition hover:brightness-110"
              >
                <Icon name="plus" size={14} />
                جدید
              </button>
            </div>
            <div className="px-3 pt-3">
              <label className="relative block">
                <span className="sr-only">جستجو در درخواست‌ها</span>
                <Icon
                  name="search"
                  size={14}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--h-muted)]"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="جستجو"
                  className="h-9 w-full rounded-lg border border-[var(--h-line)] bg-[var(--h-field)] ps-9 pe-3 text-[13px] outline-none transition placeholder:text-[var(--h-muted)] focus:border-[var(--h-accent)]"
                />
              </label>
              <div className="mt-2 flex gap-1" role="tablist" aria-label="وضعیت درخواست‌ها">
                {FILTERS.map((item) => {
                  const on = filter === item.id;
                  const count = counts[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setFilter(item.id)}
                      className={`h-7 rounded-full px-2.5 text-[11.5px] font-semibold transition ${
                        on
                          ? 'bg-[var(--h-text)] text-[var(--h-bg)]'
                          : 'bg-[var(--h-chip)] text-[var(--h-muted)] hover:text-[var(--h-text)]'
                      }`}
                    >
                      {item.label}
                      {count > 0 ? (
                        <span className="ms-1 tabular-nums opacity-70">{faDigits(count)}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2"
              data-testid="support-list"
            >
              {tickets === null && !listError ? <ListSkeleton /> : null}
              {listError && tickets === null ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-[13px] leading-6 text-[var(--h-muted)]">{listError}</p>
                  <button
                    type="button"
                    onClick={() => void refreshList()}
                    className="mt-3 text-[13px] font-semibold text-[var(--h-accent)]"
                  >
                    تلاش دوباره
                  </button>
                </div>
              ) : null}
              {tickets && tickets.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] text-[var(--h-accent)]">
                    <Icon name="chat" size={22} />
                  </span>
                  <p className="mt-4 text-[14px] font-semibold">هنوز درخواستی ندارید</p>
                  <p className="mt-1 text-[12.5px] leading-6 text-[var(--h-muted)]">
                    سؤال، مشکل یا درخواست نماد را از اینجا بفرستید. پاسخ در همین صفحه می‌آید.
                  </p>
                </div>
              ) : null}
              {tickets && tickets.length > 0 && visible.length === 0 ? (
                <p className="px-3 py-8 text-center text-[13px] text-[var(--h-muted)]">
                  درخواستی با این فیلتر پیدا نشد.
                </p>
              ) : null}
              <ul className="flex flex-col gap-1">
                {visible.map((ticket) => {
                  const on = ticket.id === selectedId;
                  const heading = ticketHeading(ticket);
                  return (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        id={`support-ticket-${ticket.id}`}
                        aria-current={on ? 'true' : undefined}
                        onClick={() => select(ticket.id)}
                        className={`flex w-full flex-col gap-1 rounded-xl border-s-2 px-3 py-2.5 text-start transition ${
                          on
                            ? 'border-[var(--h-accent)] bg-[var(--h-soft)]'
                            : 'border-transparent hover:bg-[var(--h-chip)]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                            {heading}
                          </span>
                          {ticket.unread > 0 ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--h-accent)]" />
                          ) : null}
                          <span className="shrink-0 text-[11px] text-[var(--h-muted)]">
                            {listWhen(ticket.updatedAt)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${statusClass(ticket.status)}`}
                          >
                            {SUPPORT_STATUS_LABEL[ticket.status]}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--h-muted)]">
                            {ticket.symbol ? `${ticket.symbol} · ` : ''}
                            {ticket.preview}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="border-t border-[var(--h-line)] px-4 py-3 text-[11.5px] leading-5 text-[var(--h-muted)]">
              پاسخ‌ها همین‌جا می‌آید. ایمیل پشتیبانی <MailLink />
            </p>
          </aside>

          <section
            className={`${selectedId ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-1 flex-col`}
            data-testid="support-thread"
          >
            {!selectedId ? (
              <EmptyThread onCreate={() => setCreating(true)} />
            ) : shownThreadError && !active ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="text-[14px] text-[var(--h-muted)]">{shownThreadError}</p>
                <button
                  type="button"
                  onClick={() => select(null)}
                  className="mt-4 text-[13px] font-semibold text-[var(--h-accent)] lg:hidden"
                >
                  بازگشت به درخواست‌ها
                </button>
              </div>
            ) : (
              <>
                <ThreadHeader
                  ticket={active?.ticket ?? tickets?.find((item) => item.id === selectedId) ?? null}
                  confirmClose={confirmClose}
                  closing={closing}
                  onBack={() => select(null)}
                  onAskClose={() => {
                    if (selectedId) setConfirmFor(selectedId);
                  }}
                  onCancelClose={() => setConfirmFor(null)}
                  onClose={() => void close()}
                />
                <div
                  ref={scroller}
                  role="log"
                  aria-label="گفتگوی پشتیبانی"
                  onScroll={() => {
                    const el = scroller.current;
                    if (!el) return;
                    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
                  }}
                  className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
                >
                  {threadLoading && !active ? (
                    <p className="text-center text-[13px] text-[var(--h-muted)]">
                      در حال بارگذاری گفتگو…
                    </p>
                  ) : null}
                  {active ? (
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                      {active.messages.map((message, index) => {
                        const prev = active.messages[index - 1];
                        const showDay =
                          !prev || tehranDay(prev.createdAt) !== tehranDay(message.createdAt);
                        return (
                          <div key={message.id} className="flex flex-col gap-3">
                            {showDay ? <DayRule label={dayLabel(message.createdAt)} /> : null}
                            <Bubble message={message} />
                          </div>
                        );
                      })}
                      <ThreadNote ticket={active.ticket} canReply={canReply} />
                    </div>
                  ) : null}
                </div>
                <p className="sr-only" aria-live="polite">
                  {live}
                </p>
                {active ? (
                  <Composer
                    inputRef={composer}
                    value={draft}
                    files={files}
                    sending={sending}
                    error={shownComposeError}
                    locked={!canReply}
                    closed={active.ticket.status === 'closed'}
                    onChange={(value) => {
                      if (!selectedId) return;
                      setDrafts((prev) => ({ ...prev, [selectedId]: value }));
                      setComposeError(null);
                    }}
                    onFiles={(next, error) => {
                      if (!selectedId) return;
                      setPendingFiles((prev) => ({ ...prev, [selectedId]: next }));
                      setComposeError(error ? { id: selectedId, text: error } : null);
                    }}
                    onSend={() => void send()}
                  />
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>

      {creating ? (
        <NewTicketDialog onClose={() => setCreating(false)} onCreated={onCreated} />
      ) : null}
    </HomeShell>
  );
}

function MailLink() {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      dir="ltr"
      className="font-medium text-[var(--h-accent)] underline-offset-2 hover:underline"
    >
      {SUPPORT_EMAIL}
    </a>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-1">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-[68px] animate-pulse rounded-xl bg-[var(--h-chip)]" />
      ))}
    </div>
  );
}

function EmptyThread({ onCreate }: { readonly onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] text-[var(--h-accent)]">
        <Icon name="chat" size={28} />
      </span>
      <h2 className="mt-5 text-[22px] font-extrabold">پشتیبانی کندلو</h2>
      <p className="mt-2 max-w-sm text-[14px] leading-7 text-[var(--h-muted)]">
        یک گفتگو را از فهرست انتخاب کنید، یا درخواست تازه‌ای بسازید. پاسخ تیم پشتیبانی در همین صفحه
        نمایش داده می‌شود.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--h-accent)] px-4 text-[13.5px] font-semibold text-white"
      >
        <Icon name="plus" size={15} />
        درخواست جدید
      </button>
      <p className="mt-4 text-[12.5px] text-[var(--h-muted)]">
        ایمیل: <MailLink />
      </p>
    </div>
  );
}

function DayRule({ label }: { readonly label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-[var(--h-line)]" />
      <span className="text-[11px] font-medium text-[var(--h-muted)]">{label}</span>
      <span className="h-px flex-1 bg-[var(--h-line)]" />
    </div>
  );
}

function Bubble({ message }: { readonly message: SupportMessage }) {
  const mine = message.role === 'user';
  return (
    <div className={`flex max-w-[min(100%,34rem)] flex-col ${mine ? 'self-start' : 'self-end'}`}>
      <span
        className={`mb-1 flex items-center gap-1.5 px-1 text-[11px] ${
          mine ? 'text-[var(--h-muted)]' : 'font-medium text-[var(--h-accent)]'
        }`}
      >
        {mine ? null : <Icon name="shield" size={12} />}
        {mine ? 'شما' : message.name}
        <span className="font-normal text-[var(--h-muted)]">{clock(message.createdAt)}</span>
      </span>
      {message.body ? (
        <div
          dir="auto"
          className={`whitespace-pre-wrap wrap-break-word rounded-2xl px-3.5 py-2.5 text-[14px] leading-7 ${
            mine
              ? 'rounded-es-md bg-[var(--h-accent)] text-white'
              : 'rounded-ee-md border border-[var(--h-line)] bg-[var(--h-card)] text-[var(--h-text)]'
          }`}
        >
          {message.body}
        </div>
      ) : null}
      {(message.attachments ?? []).length > 0 ? (
        <AttachmentList items={message.attachments} />
      ) : null}
    </div>
  );
}

function ThreadNote({
  ticket,
  canReply,
}: {
  readonly ticket: SupportTicket;
  readonly canReply: boolean;
}) {
  if (!canReply) {
    return (
      <p className="mx-auto max-w-md rounded-2xl border border-dashed border-[var(--h-line)] bg-[var(--h-chip)] px-4 py-3 text-center text-[12.5px] leading-6 text-[var(--h-muted)]">
        منتظر پاسخ پشتیبانی بمانید. بعد از جواب می‌توانید پیام بفرستید.
      </p>
    );
  }
  if (ticket.status === 'closed') {
    return (
      <p className="mx-auto max-w-md rounded-2xl border border-dashed border-[var(--h-line)] px-4 py-3 text-center text-[12.5px] leading-6 text-[var(--h-muted)]">
        این گفتگو بسته است. پیام تازه آن را دوباره باز می‌کند.
      </p>
    );
  }
  return null;
}

function ThreadHeader({
  ticket,
  confirmClose,
  closing,
  onBack,
  onAskClose,
  onCancelClose,
  onClose,
}: {
  readonly ticket: SupportTicket | null;
  readonly confirmClose: boolean;
  readonly closing: boolean;
  readonly onBack: () => void;
  readonly onAskClose: () => void;
  readonly onCancelClose: () => void;
  readonly onClose: () => void;
}) {
  const heading = ticket ? ticketHeading(ticket) : 'گفتگو';
  const subject = ticket ? subjectById(ticket.subject)?.label : null;
  return (
    <div className="flex items-start gap-3 border-b border-[var(--h-line)] px-4 py-3 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="mt-0.5 inline-flex h-8 items-center gap-1 rounded-lg pe-2 text-[13px] font-medium text-[var(--h-muted)] hover:bg-[var(--h-chip)] hover:text-[var(--h-text)] lg:hidden"
      >
        <Icon name="chevronRight" size={16} />
        درخواست‌ها
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-[15px] font-bold">{heading}</h2>
          {ticket ? (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${statusClass(ticket.status)}`}
            >
              {SUPPORT_STATUS_LABEL[ticket.status]}
            </span>
          ) : null}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--h-muted)]">
          {ticket ? (
            <span dir="ltr" className="font-mono text-[11px]">
              #{faDigits(ticket.number)}
            </span>
          ) : null}
          {subject && subject !== heading ? <span>{subject}</span> : null}
          {ticket?.symbol ? (
            <span
              dir="auto"
              className="rounded-md bg-[var(--h-chip)] px-1.5 py-0.5 font-medium text-[var(--h-text)]"
            >
              {ticket.symbol}
            </span>
          ) : null}
        </p>
      </div>
      {ticket && ticket.status !== 'closed' ? (
        confirmClose ? (
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <span className="text-[12px] text-[var(--h-muted)]">بسته شود؟</span>
            <button
              type="button"
              disabled={closing}
              onClick={onClose}
              className="h-8 rounded-lg bg-[var(--h-text)] px-2.5 text-[12px] font-semibold text-[var(--h-bg)] disabled:opacity-50"
            >
              {closing ? '…' : 'بله'}
            </button>
            <button
              type="button"
              onClick={onCancelClose}
              className="h-8 rounded-lg px-2.5 text-[12px] font-semibold text-[var(--h-muted)] hover:bg-[var(--h-chip)]"
            >
              خیر
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAskClose}
            className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)]"
          >
            <Icon name="check" size={14} />
            بستن
          </button>
        )
      ) : null}
    </div>
  );
}

function Composer({
  inputRef,
  value,
  files,
  sending,
  error,
  locked,
  closed,
  onChange,
  onFiles,
  onSend,
}: {
  readonly inputRef: RefObject<HTMLTextAreaElement | null>;
  readonly value: string;
  readonly files: readonly File[];
  readonly sending: boolean;
  readonly error: string | null;
  readonly locked: boolean;
  readonly closed: boolean;
  readonly onChange: (value: string) => void;
  readonly onFiles: (files: File[], error: string | null) => void;
  readonly onSend: () => void;
}) {
  const trimmed = value.trim();
  const ready =
    !locked && !sending && (trimmed.length >= 2 || (trimmed.length === 0 && files.length > 0));
  return (
    <div className="border-t border-[var(--h-line)] px-4 py-3 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        {error ? (
          <p role="alert" className="mb-2 text-[12.5px] text-[#ff6b81]">
            {error}
          </p>
        ) : null}
        <FileChips
          files={files}
          onRemove={(index) =>
            onFiles(
              files.filter((_, i) => i !== index),
              null,
            )
          }
        />
        <div
          className={`flex items-end gap-2 rounded-2xl border border-[var(--h-line)] bg-[var(--h-field)] p-2 transition focus-within:border-[var(--h-accent)] ${
            locked ? 'opacity-60' : ''
          }`}
        >
          <AttachButton
            disabled={locked || sending}
            onPick={(list) => {
              const added = mergeFiles(files, list);
              onFiles(added.files, added.error);
            }}
          />
          <label className="sr-only" htmlFor="support-composer">
            پیام
          </label>
          <textarea
            ref={inputRef}
            id="support-composer"
            data-testid="support-composer"
            rows={2}
            maxLength={SUPPORT_BODY_MAX}
            value={value}
            disabled={locked}
            placeholder={
              locked
                ? 'پس از پاسخ پشتیبانی می‌توانید بنویسید'
                : closed
                  ? 'این گفتگو بسته است. پیام تازه آن را دوباره باز می‌کند.'
                  : 'پیام خود را بنویسید…'
            }
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
              if (window.matchMedia('(pointer: coarse)').matches) return;
              event.preventDefault();
              if (ready) onSend();
            }}
            className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-7 outline-none placeholder:text-[var(--h-muted)] disabled:cursor-not-allowed"
          />
          <button
            type="button"
            data-testid="support-send"
            aria-label="ارسال پیام"
            disabled={!ready}
            onClick={onSend}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--h-accent)] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[var(--h-chip)] disabled:text-[var(--h-muted)]"
          >
            <Icon name="send" size={16} />
          </button>
        </div>
        <p className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-[var(--h-muted)]">
          <span>
            {locked ? (
              'منتظر پاسخ پشتیبانی'
            ) : (
              <>
                <span className="sm:hidden">دکمه ارسال را بزنید</span>
                <span className="hidden sm:inline">Enter ارسال می‌کند · Shift+Enter خط جدید</span>
              </>
            )}
          </span>
          <span className="shrink-0 tabular-nums">
            {faDigits(value.length)} / {faDigits(SUPPORT_BODY_MAX)}
          </span>
        </p>
      </div>
    </div>
  );
}

function NewTicketDialog({
  onClose,
  onCreated,
}: {
  readonly onClose: () => void;
  readonly onCreated: (ticket: SupportTicket, message: SupportMessage) => void;
}) {
  const [subject, setSubject] = useState<SupportSubjectId | null>(null);
  const [title, setTitle] = useState('');
  const [symbol, setSymbol] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = parseNewTicket({ subject, title, symbol, body });
    if (!parsed.ok) {
      setError(supportErrorText(parsed.error));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('subject', parsed.value.subject);
      form.set('title', parsed.value.title);
      form.set('symbol', parsed.value.symbol);
      form.set('body', parsed.value.body);
      for (const file of files) form.append('file', file);
      const data = await api<{ ticket: SupportTicket; message: SupportMessage }>(
        '/api/support/tickets',
        { method: 'POST', form },
      );
      onCreated(data.ticket, data.message);
    } catch (err) {
      setError(failureText(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="درخواست جدید"
      onClose={onClose}
      width={560}
      initialFocus="[data-support-subject='custom-symbol']"
      className="[--dlg-bg:var(--h-card)] [--dlg-fg:var(--h-text)] [--dlg-line:var(--h-line)]"
      header={
        <div className="flex items-center justify-between border-b border-[var(--h-line)] ps-5 pe-3 py-3">
          <div>
            <h2 className="text-[16px] font-bold">درخواست جدید</h2>
            <p className="mt-0.5 text-[12px] text-[var(--h-muted)]">پاسخ در همین گفتگو می‌آید</p>
          </div>
          <button
            type="button"
            aria-label="بستن"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)]"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      }
      footer={
        <>
          {error ? (
            <p role="alert" className="min-w-0 flex-1 text-[12.5px] leading-5 text-[#ff6b81]">
              {error}
            </p>
          ) : (
            <p className="min-w-0 flex-1 text-[12px] text-[var(--h-muted)]">
              <MailLink />
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 text-[13.5px] font-semibold text-[var(--h-muted)] transition hover:text-[var(--h-text)]"
          >
            انصراف
          </button>
          <button
            type="submit"
            form="support-new-ticket"
            disabled={busy}
            className="h-10 rounded-full bg-[var(--h-accent)] px-5 text-[13.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'در حال ثبت…' : 'ثبت درخواست'}
          </button>
        </>
      }
    >
      <form id="support-new-ticket" onSubmit={(event) => void submit(event)} className="px-5 py-4">
        <p className="mb-2 text-[13px] font-medium" id="support-subject-label">
          موضوع
        </p>
        <div aria-labelledby="support-subject-label" className="grid gap-2 sm:grid-cols-2">
          {SUPPORT_SUBJECTS.map((item) => {
            const on = subject === item.id;
            const featured = item.id === 'custom-symbol';
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                data-support-subject={item.id}
                onClick={() => {
                  setSubject(item.id);
                  setError(null);
                }}
                className={`flex h-11 items-center gap-2.5 rounded-xl border px-3 text-start transition ${
                  featured ? 'sm:col-span-2' : ''
                } ${
                  on
                    ? 'border-[var(--h-accent)] bg-[color-mix(in_srgb,var(--h-accent)_12%,transparent)]'
                    : 'border-[var(--h-line)] bg-[var(--h-field)] hover:border-[color-mix(in_srgb,var(--h-text)_18%,var(--h-line))]'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    on
                      ? 'bg-[var(--h-accent)] text-white'
                      : 'bg-[var(--h-chip)] text-[var(--h-muted)]'
                  }`}
                >
                  <Icon name={item.icon as IconName} size={15} />
                </span>
                <span className="shrink-0 text-[13.5px] font-semibold">{item.label}</span>
                {featured ? (
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--h-muted)]">
                    {item.hint}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {subject === 'custom-symbol' ? (
          <Field
            id="support-symbol"
            label="نام نماد"
            value={symbol}
            placeholder="مثلاً EURUSD یا فولاد"
            dir="auto"
            maxLength={48}
            onChange={setSymbol}
          />
        ) : null}
        <Field
          id="support-title"
          label="عنوان"
          value={title}
          placeholder="خلاصهٔ کوتاه"
          maxLength={80}
          required
          onChange={setTitle}
        />
        <label
          htmlFor="support-body"
          className="mt-4 mb-1.5 block text-[13px] text-[var(--h-muted)]"
        >
          شرح درخواست
        </label>
        <textarea
          id="support-body"
          required
          rows={5}
          maxLength={SUPPORT_BODY_MAX}
          value={body}
          placeholder="چه چیزی لازم دارید و چه اتفاقی افتاده؟"
          onChange={(event) => {
            setBody(event.target.value);
            setError(null);
          }}
          className={`${FIELD} min-h-32 py-2.5 leading-7`}
        />
        <div className="mt-3">
          <FileChips
            files={files}
            onRemove={(index) => setFiles(files.filter((_, i) => i !== index))}
          />
          <AttachButton
            label="افزودن عکس یا فایل"
            disabled={busy}
            onPick={(list) => {
              const added = mergeFiles(files, list);
              setFiles(added.files);
              setError(added.error);
            }}
          />
          <p className="mt-1.5 text-[11.5px] leading-5 text-[var(--h-muted)]">
            تصویر، PDF، متن، زیپ، ورد یا اکسل. حداکثر {faDigits(SUPPORT_FILE_MAX_COUNT)} فایل، هر
            کدام ۵ مگابایت.
          </p>
        </div>
      </form>
    </Dialog>
  );
}

function mergeFiles(
  current: readonly File[],
  incoming: FileList | null,
): { files: File[]; error: string | null } {
  if (!incoming || incoming.length === 0) return { files: [...current], error: null };
  const next = [...current];
  for (const file of incoming) {
    if (next.length >= SUPPORT_FILE_MAX_COUNT) {
      return { files: next, error: supportErrorText('Too many files') };
    }
    const checked = checkSupportFile({ name: file.name, type: file.type, size: file.size });
    if (!checked.ok) return { files: next, error: supportErrorText(checked.error) };
    next.push(file);
  }
  return { files: next, error: null };
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${faDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${faDigits(Math.max(1, Math.round(bytes / 1024)))} کیلوبایت`;
  return `${faDigits((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
}

function AttachButton({
  disabled,
  label,
  onPick,
}: {
  readonly disabled: boolean;
  readonly label?: string;
  readonly onPick: (list: FileList | null) => void;
}) {
  return (
    <label
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl text-[13px] text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)] ${
        label ? 'border border-[var(--h-line)] px-3' : 'w-10'
      } ${disabled ? 'pointer-events-none opacity-40' : 'cursor-pointer'}`}
    >
      {label ? null : <span className="sr-only">پیوست عکس یا فایل</span>}
      <Icon name="upload" size={16} />
      {label ? <span>{label}</span> : null}
      <input
        type="file"
        accept={SUPPORT_FILE_ACCEPT}
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          onPick(event.target.files);
          event.target.value = '';
        }}
      />
    </label>
  );
}

function FileChips({
  files,
  onRemove,
}: {
  readonly files: readonly File[];
  readonly onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5">
      {files.map((file, index) => (
        <li
          key={`${file.name}-${file.size}-${index}`}
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--h-line)] bg-[var(--h-chip)] py-1 ps-2 pe-1 text-[12px]"
        >
          <Icon name={file.type.startsWith('image/') ? 'camera' : 'download'} size={13} />
          <span className="max-w-40 truncate">{file.name}</span>
          <span className="text-[var(--h-muted)]">{fileSize(file.size)}</span>
          <button
            type="button"
            aria-label={`حذف ${file.name}`}
            onClick={() => onRemove(index)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--h-muted)] hover:bg-[var(--h-soft)] hover:text-[var(--h-text)]"
          >
            <Icon name="close" size={12} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function AttachmentList({ items }: { readonly items: SupportMessage['attachments'] }) {
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {items.map((item) =>
        item.image ? (
          <a
            key={item.id}
            href={`/api/support/files/${item.id}`}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-xl border border-[var(--h-line)]"
          >
            {/* The file route checks the session cookie; next/image cannot send it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/support/files/${item.id}`}
              alt={item.name}
              className="max-h-60 max-w-full bg-[var(--h-field)] object-contain"
            />
          </a>
        ) : (
          <a
            key={item.id}
            href={`/api/support/files/${item.id}`}
            className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] px-3 py-2 text-[13px]"
          >
            <Icon name="download" size={15} className="shrink-0 text-[var(--h-accent)]" />
            <span className="min-w-0 truncate">{item.name}</span>
            <span className="shrink-0 text-[11px] text-[var(--h-muted)]">
              {fileSize(item.size)}
            </span>
          </a>
        ),
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  placeholder,
  dir,
  maxLength,
  required = false,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly dir?: 'auto' | 'ltr';
  readonly maxLength: number;
  readonly required?: boolean;
  readonly onChange: (value: string) => void;
}) {
  return (
    <>
      <label htmlFor={id} className="mt-4 mb-1.5 block text-[13px] text-[var(--h-muted)]">
        {label}
      </label>
      <input
        id={id}
        value={value}
        dir={dir}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD} h-11`}
      />
    </>
  );
}
