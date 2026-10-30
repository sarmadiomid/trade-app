'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { faDigits, faNum, formatJalaliDateTime } from '@/lib/locale/jalali';
import {
  subjectById,
  supportErrorText,
  SUPPORT_STATUS_LABEL,
  type SupportAttachment,
  type SupportMessage,
  type SupportStatus,
} from '@/lib/support/catalog';
import { ApiError, api } from '@/components/platform/api';
import { Notice, PageHead, Panel, Skeleton, Spinner, fieldClass } from './ui';

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

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

/** Starter texts for the composer. Edit freely to match your support tone. */
const QUICK_REPLIES: ReadonlyArray<{ label: string; text: string }> = [
  {
    label: 'در حال بررسی',
    text: 'ممنون از پیام شما. درخواستتان در حال بررسی است و نتیجه را همین‌جا اطلاع می‌دهیم.',
  },
  {
    label: 'درخواست جزئیات',
    text: 'برای پیگیری بهتر، لطفاً جزئیات بیشتری (تصویر صفحه یا مراحل رخ‌دادن مشکل) بفرستید.',
  },
  {
    label: 'مشکل برطرف شد',
    text: 'مشکل برطرف شد. اگر دوباره آن را دیدید، همین‌جا بنویسید.',
  },
];

const STATUS_STYLE: Record<string, string> = {
  open: 'border-[#f5b544]/30 bg-[#f5b544]/10 text-[#f7c46a]',
  answered: 'border-[#3ecf8e]/30 bg-[#3ecf8e]/10 text-[#8ef0cf]',
  closed: 'border-white/10 bg-white/[0.04] text-[var(--a-muted)]',
};

const POLL_MS = 30_000;

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b78ff]/60';
const FOCUS_RING_INSET = `${FOCUS_RING} focus-visible:ring-inset`;

const BTN_PRIMARY = `inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--a-accent)] px-5 text-[13.5px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(59,120,255,0.8)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:active:scale-100 ${FOCUS_RING}`;
const BTN_GHOST = `inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[12.5px] font-medium text-[#c9d3ea] transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING}`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'ارتباط برقرار نشد';
}

function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function ticketTitle(ticket: StaffTicket): string {
  return ticket.title || subjectById(ticket.subject)?.label || '';
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${faDigits(bytes)} B`;
  if (bytes < 1024 * 1024) return `${faDigits(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${faDigits((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

function AttachmentList({ items }: { readonly items: readonly SupportAttachment[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {items.map((item) => {
        const href = `/api/admin/support/files/${item.id}`;
        return item.image ? (
          <a
            key={item.id}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-xl border border-white/10 bg-black/20"
          >
            {/* The file route checks the admin session cookie; next/image cannot send it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={href}
              alt={item.name}
              className="max-h-60 max-w-full object-contain"
            />
          </a>
        ) : (
          <a
            key={item.id}
            href={href}
            className="inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-[#c9d3ea] transition hover:bg-white/[0.07]"
          >
            <Icon name="download" className="h-3.5 w-3.5 shrink-0 text-[#9db9ff]" />
            <span className="min-w-0 truncate">{item.name}</span>
            <span className="shrink-0 text-[11px] text-[var(--a-muted)]">
              {fileSize(item.size)}
            </span>
          </a>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconName =
  | 'search'
  | 'close'
  | 'refresh'
  | 'copy'
  | 'check'
  | 'send'
  | 'inbox'
  | 'lock'
  | 'alert'
  | 'back'
  | 'download';

const ICONS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  send: <path d="M21 3 10 14M21 3l-7 18-4-8-8-4z" />,
  inbox: (
    <>
      <path d="M4 13 6.5 5h11L20 13" />
      <path d="M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5h-4.5a2.5 2.5 0 0 1-5 0z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 3 19.5h18z" />
      <path d="M12 10v4.5M12 17.2h.01" />
    </>
  ),
  // Points toward the start side in RTL (visually right).
  back: <path d="m9.5 6 6 6-6 6" />,
  download: (
    <>
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 19h14" />
    </>
  ),
};

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Small shared UI                                                     */
/* ------------------------------------------------------------------ */

function Avatar({ name, size = 'md' }: { readonly name: string; readonly size?: 'md' | 'lg' }) {
  const initial = Array.from(name.trim())[0] ?? '؟';
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#3b78ff]/30 to-[#9b7bff]/25 font-semibold text-[#cfdcff] ring-1 ring-white/10 ${
        size === 'lg' ? 'h-11 w-11 text-[15px]' : 'h-9 w-9 text-[13px]'
      }`}
    >
      {initial}
    </span>
  );
}

function StatusPill({ status }: { readonly status: SupportStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        STATUS_STYLE[status] ?? STATUS_STYLE.closed
      }`}
    >
      {SUPPORT_STATUS_LABEL[status]}
    </span>
  );
}

function Chip({ children }: { readonly children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11.5px] text-[#b9c6e4]">
      {children}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly text?: string | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.05] text-[var(--a-muted)] ring-1 ring-white/10">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[14px] font-medium">{title}</p>
      {text ? (
        <p className="mt-1 max-w-xs text-[12.5px] leading-6 text-[var(--a-muted)]">{text}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inbox                                                               */
/* ------------------------------------------------------------------ */

export function StaffInbox({ initialId }: { readonly initialId: string | null }) {
  const [status, setStatus] = useState<SupportStatus | 'all'>('open');
  const [tickets, setTickets] = useState<StaffTicket[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [listNonce, setListNonce] = useState(0);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<string | null>(initialId);
  const [thread, setThread] = useState<Thread | null>(null);
  const [threadError, setThreadError] = useState('');
  const [threadNonce, setThreadNonce] = useState(0);
  // One draft per ticket, so a half-written reply can never leak into another ticket.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'reply' | 'close' | ''>('');
  const [error, setError] = useState('');
  const [replyError, setReplyError] = useState('');
  const [sentFlash, setSentFlash] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>(initialId ? 'thread' : 'list');
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const scrollMark = useRef<{ id: string; count: number } | null>(null);
  const autoSelect = useRef(initialId === null);
  const statusRef = useRef(status);
  const activeRef = useRef(active);

  // A deep link (?id=…) selects that ticket as soon as the prop changes.
  const [seenInitialId, setSeenInitialId] = useState(initialId);
  if (seenInitialId !== initialId) {
    setSeenInitialId(initialId);
    if (initialId) {
      setActive(initialId);
      setMobileView('thread');
    }
  }

  const listKey = `${status}:${listNonce}`;
  const [seenListKey, setSeenListKey] = useState(listKey);
  if (seenListKey !== listKey) {
    setSeenListKey(listKey);
    setListLoading(true);
    setListError('');
  }

  const threadKey = `${active ?? ''}:${threadNonce}`;
  const [seenThreadKey, setSeenThreadKey] = useState(threadKey);
  if (seenThreadKey !== threadKey) {
    setSeenThreadKey(threadKey);
    if (active) setThreadError('');
  }

  const body = active ? (drafts[active] ?? '') : '';
  const setBody = (value: string) => {
    if (!active) return;
    setDrafts((current) => ({ ...current, [active]: value }));
  };

  /* ---------- Data loading ---------- */

  // A deep link wins over the automatic "open the newest ticket" choice.
  useEffect(() => {
    if (initialId) autoSelect.current = false;
  }, [initialId]);

  // List for the current filter. The first load also opens the newest ticket.
  useEffect(() => {
    let live = true;
    void api<{ tickets: StaffTicket[] }>(`/api/admin/support?status=${status}`)
      .then((data) => {
        if (!live) return;
        setTickets(data.tickets);
        if (autoSelect.current) {
          autoSelect.current = false;
          const first = data.tickets[0];
          if (first) setActive((current) => current ?? first.id);
        }
      })
      .catch((e: unknown) => {
        if (live) setListError(messageOf(e));
      })
      .finally(() => {
        if (live) setListLoading(false);
      });
    return () => {
      live = false;
    };
  }, [status, listNonce]);

  // Thread for the active ticket.
  useEffect(() => {
    if (!active) return;
    let live = true;
    void api<Thread>(`/api/admin/support/${active}`)
      .then((data) => {
        if (live) setThread(data);
      })
      .catch((e: unknown) => {
        if (live) setThreadError(messageOf(e));
      });
    return () => {
      live = false;
    };
  }, [active, threadNonce]);

  // Reload the list and the open thread without any loading UI.
  const refresh = async (silent: boolean) => {
    const requestedStatus = statusRef.current;
    const requestedActive = activeRef.current;
    if (!silent) {
      setRefreshing(true);
      setError('');
    }
    try {
      const [list, fresh] = await Promise.all([
        api<{ tickets: StaffTicket[] }>(`/api/admin/support?status=${requestedStatus}`),
        requestedActive
          ? api<Thread>(`/api/admin/support/${requestedActive}`)
          : Promise.resolve(null),
      ]);
      if (statusRef.current === requestedStatus) setTickets(list.tickets);
      if (fresh && activeRef.current === requestedActive) setThread(fresh);
    } catch (e) {
      if (!silent) setError(messageOf(e));
    } finally {
      if (!silent) setRefreshing(false);
    }
  };
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
    statusRef.current = status;
    activeRef.current = active;
  });

  // New tickets and customer replies arrive without a manual reload.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void refreshRef.current(true);
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    if (!thread || thread.ticket.id !== active) return;
    const el = messagesRef.current;
    if (!el) return;
    const previous = scrollMark.current;
    const count = thread.messages.length;
    if (!previous || previous.id !== thread.ticket.id) {
      el.scrollTop = el.scrollHeight;
    } else if (count > previous.count) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
    scrollMark.current = { id: thread.ticket.id, count };
  }, [thread, active]);

  /* ---------- Actions ---------- */

  const select = (id: string) => {
    setActive(id);
    setMobileView('thread');
    setConfirmClose(false);
    setReplyError('');
    setSentFlash(false);
  };

  const canSend = busy === '' && body.trim().length >= 2;

  const reply = async () => {
    if (!active || !canSend) return;
    const ticketId = active;
    const text = body.trim();
    setBusy('reply');
    setReplyError('');
    try {
      await api(`/api/admin/support/${ticketId}/reply`, { method: 'POST', body: { body: text } });
      setDrafts((current) => {
        const next = { ...current };
        delete next[ticketId];
        return next;
      });
      setSentFlash(true);
      window.setTimeout(() => setSentFlash(false), 3000);
      await refresh(true);
    } catch (e) {
      setReplyError(e instanceof ApiError ? supportErrorText(e.message) : 'پاسخ ارسال نشد');
    } finally {
      setBusy('');
    }
  };

  const close = async () => {
    if (!active) return;
    setBusy('close');
    setError('');
    try {
      await api(`/api/admin/support/${active}/close`, { method: 'POST', body: {} });
      setConfirmClose(false);
      await refresh(true);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy('');
    }
  };

  const insertQuickReply = (text: string) => {
    setBody(body.trim() ? `${body.replace(/\s+$/, '')}\n${text}` : text);
    textareaRef.current?.focus();
  };

  const onComposerKey = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void reply();
    }
  };

  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; the number stays selectable */
    }
  };

  /* ---------- Derived ---------- */

  const visible = useMemo(() => {
    const needle = toLatinDigits(search.trim().replace(/^#/, '').toLowerCase());
    if (!needle) return tickets;
    return tickets.filter((ticket) =>
      toLatinDigits(
        `${ticket.number} ${ticketTitle(ticket)} ${ticket.userName} ${ticket.phone} ${ticket.symbol} ${ticket.preview}`,
      )
        .toLowerCase()
        .includes(needle),
    );
  }, [tickets, search]);

  const current = thread && thread.ticket.id === active ? thread : null;

  return (
    <div>
      <PageHead
        kicker="پشتیبانی"
        title="صندوق درخواست‌ها"
        text="درخواست نماد دلخواه، پرداخت، حساب و مشکل فنی اینجاست. پاسخ شما برای کاربر به‌عنوان پیام پشتیبانی می‌آید."
      />

      {error ? (
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Notice tone="bad">{error}</Notice>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="بستن پیام"
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--a-muted)] transition hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="grid items-stretch gap-4 lg:h-[calc(100dvh-16rem)] lg:min-h-[560px] lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ---------- Ticket list ---------- */}
        <Panel
          className={`flex min-h-0 flex-col overflow-hidden ${
            mobileView === 'thread' ? 'max-lg:hidden' : ''
          }`}
        >
          <div className="space-y-2.5 border-b border-[var(--a-line)] p-3">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Icon
                  name="search"
                  className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-muted)]"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="شماره، کاربر یا موبایل"
                  aria-label="جستجو در درخواست‌ها"
                  className={`${fieldClass} !h-10 !ps-9 !pe-9 text-[13px]`}
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="پاک کردن جستجو"
                    className={`absolute end-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--a-muted)] transition hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
                  >
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void refresh(false)}
                disabled={refreshing}
                aria-label="به‌روزرسانی فهرست"
                title="به‌روزرسانی"
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-[#c9d3ea] transition hover:bg-white/[0.07] disabled:opacity-60 ${FOCUS_RING}`}
              >
                {refreshing ? <Spinner className="h-4 w-4" /> : <Icon name="refresh" />}
              </button>
            </div>
            <div
              role="tablist"
              aria-label="فیلتر وضعیت"
              className="flex gap-1 rounded-xl bg-white/[0.04] p-1"
            >
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={status === item.id}
                  onClick={() => setStatus(item.id)}
                  className={`h-8 flex-1 rounded-lg px-1 text-[12px] font-medium transition ${FOCUS_RING} ${
                    status === item.id
                      ? 'bg-white/10 text-white'
                      : 'text-[var(--a-muted)] hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {!listLoading && !listError ? (
            <div className="border-b border-[var(--a-line)] px-4 py-2 text-[11.5px] text-[var(--a-muted)]">
              <span className="tabular-nums">{faNum(visible.length)}</span> درخواست
              {search && tickets.length !== visible.length ? ` از ${faNum(tickets.length)}` : ''}
            </div>
          ) : null}

          <nav
            aria-label="فهرست درخواست‌ها"
            className="min-h-0 flex-1 overflow-y-auto max-lg:max-h-[70dvh]"
          >
            {listLoading ? (
              <ul aria-busy="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <li key={i} className="flex gap-3 border-b border-[var(--a-line)] px-4 py-3.5">
                    <Skeleton className="h-9 w-9 shrink-0 !rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : listError ? (
              <div className="space-y-3 px-4 py-10 text-center">
                <p className="text-[13px] text-[#ffb3bf]">{listError}</p>
                <button
                  type="button"
                  onClick={() => setListNonce((n) => n + 1)}
                  className={BTN_GHOST}
                >
                  تلاش دوباره
                </button>
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={search ? 'search' : 'inbox'}
                title={search ? 'نتیجه‌ای پیدا نشد' : 'درخواستی نیست.'}
                text={
                  search
                    ? 'شماره، نام یا موبایل را کامل‌تر یا کوتاه‌تر امتحان کنید.'
                    : status === 'open'
                      ? 'همهٔ درخواست‌ها پاسخ داده شده‌اند.'
                      : undefined
                }
              />
            ) : (
              <ul>
                {visible.map((ticket) => {
                  const isActive = active === ticket.id;
                  const hasDraft = Boolean(drafts[ticket.id]?.trim());
                  return (
                    <li key={ticket.id} className="relative">
                      {isActive ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 start-0 w-0.5 bg-[#3b78ff]"
                        />
                      ) : null}
                      <button
                        type="button"
                        aria-current={isActive ? 'true' : undefined}
                        onClick={() => select(ticket.id)}
                        className={`flex w-full items-start gap-3 border-b border-[var(--a-line)] px-4 py-3 text-start transition hover:bg-white/[0.03] ${FOCUS_RING_INSET} ${
                          isActive ? 'bg-[#3b78ff]/[0.08]' : ''
                        } ${ticket.status === 'closed' ? 'opacity-75' : ''}`}
                      >
                        <Avatar name={ticket.userName} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                              {ticket.status === 'open' ? (
                                <span
                                  aria-hidden="true"
                                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f5b544]"
                                />
                              ) : null}
                              <span className="truncate text-[13.5px] font-medium">
                                #{faNum(ticket.number)} {ticketTitle(ticket)}
                              </span>
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-[var(--a-muted)]">
                              {formatJalaliDateTime(ticket.updatedAt, false)}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-[var(--a-muted)]">
                            {ticket.userName}
                            {ticket.symbol ? (
                              <>
                                {' · '}
                                <bdi>{ticket.symbol}</bdi>
                              </>
                            ) : null}
                          </span>
                          {ticket.preview ? (
                            <span className="mt-1 block truncate text-[12px] text-[#8b95ab]">
                              {ticket.preview}
                            </span>
                          ) : null}
                          <span className="mt-1.5 flex items-center gap-2">
                            <StatusPill status={ticket.status} />
                            {hasDraft ? (
                              <span className="text-[11px] text-[#f7c46a]">پیش‌نویس</span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </Panel>

        {/* ---------- Thread ---------- */}
        <Panel
          className={`flex min-h-[480px] min-w-0 flex-col p-5 lg:min-h-0 ${
            mobileView === 'list' ? 'max-lg:hidden' : ''
          }`}
        >
          {!active ? (
            <div className="m-auto">
              <EmptyState
                icon="inbox"
                title="یک درخواست را انتخاب کنید."
                text="گفتگو و پاسخ پشتیبانی اینجا نمایش داده می‌شود."
              />
            </div>
          ) : current ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--a-line)] pb-4">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    aria-label="بازگشت به فهرست"
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-[#c9d3ea] transition hover:bg-white/[0.07] lg:hidden ${FOCUS_RING}`}
                  >
                    <Icon name="back" />
                  </button>
                  <Avatar name={current.ticket.userName} size="lg" />
                  <div className="min-w-0">
                    <h3 className="truncate text-[16px] font-semibold">
                      #{faNum(current.ticket.number)} {ticketTitle(current.ticket)}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12.5px] text-[var(--a-muted)]">
                      <span>{current.ticket.userName}</span>
                      <button
                        type="button"
                        onClick={() => void copyPhone(current.ticket.phone)}
                        title="کپی شماره"
                        className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition hover:bg-white/[0.06] hover:text-white ${FOCUS_RING}`}
                      >
                        <bdi dir="ltr" className="font-mono">
                          {current.ticket.phone}
                        </bdi>
                        <Icon
                          name={copied ? 'check' : 'copy'}
                          className={`h-3.5 w-3.5 ${copied ? 'text-[#8ef0cf]' : ''}`}
                        />
                        <span className="sr-only">{copied ? 'کپی شد' : 'کپی شماره'}</span>
                      </button>
                      {current.ticket.symbol ? (
                        <Chip>
                          <bdi>{current.ticket.symbol}</bdi>
                        </Chip>
                      ) : null}
                      {current.ticket.title && subjectById(current.ticket.subject)?.label ? (
                        <Chip>{subjectById(current.ticket.subject)?.label}</Chip>
                      ) : null}
                      <StatusPill status={current.ticket.status} />
                    </div>
                  </div>
                </div>

                {current.ticket.status !== 'closed' ? (
                  confirmClose ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] text-[var(--a-muted)]">بسته شود؟</span>
                      <button
                        type="button"
                        disabled={busy !== ''}
                        onClick={() => void close()}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#e5484d] px-3 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        {busy === 'close' ? <Spinner className="h-3.5 w-3.5" /> : null}
                        بله، ببند
                      </button>
                      <button
                        type="button"
                        disabled={busy !== ''}
                        onClick={() => setConfirmClose(false)}
                        className={BTN_GHOST}
                      >
                        انصراف
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy !== ''}
                      onClick={() => setConfirmClose(true)}
                      className={BTN_GHOST}
                    >
                      <Icon name="lock" className="h-3.5 w-3.5" />
                      بستن درخواست
                    </button>
                  )
                ) : null}
              </div>

              <div
                ref={messagesRef}
                className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pe-1 max-lg:max-h-[60dvh]"
              >
                {current.messages.map((message, index) => {
                  const day = formatJalaliDateTime(message.createdAt, false);
                  const previous = current.messages[index - 1];
                  const showDay =
                    !previous || formatJalaliDateTime(previous.createdAt, false) !== day;
                  const fromSupport = message.role === 'support';
                  return (
                    <div key={message.id}>
                      {showDay ? (
                        <div className="my-3 flex items-center gap-3 text-[11.5px] text-[var(--a-muted)]">
                          <span aria-hidden="true" className="h-px flex-1 bg-[var(--a-line)]" />
                          <span className="tabular-nums">{day}</span>
                          <span aria-hidden="true" className="h-px flex-1 bg-[var(--a-line)]" />
                        </div>
                      ) : null}
                      <article
                        className={`max-w-[90%] rounded-2xl border px-3.5 py-2.5 sm:max-w-[80%] ${
                          fromSupport
                            ? 'ms-auto rounded-se-md border-[#3b78ff]/25 bg-[#3b78ff]/15'
                            : 'rounded-ss-md border-white/[0.06] bg-white/[0.04]'
                        }`}
                      >
                        <p className="text-[11px] text-[var(--a-muted)]">
                          <span className={fromSupport ? 'text-[#9db9ff]' : ''}>
                            {message.name}
                          </span>
                          {' · '}
                          {formatJalaliDateTime(message.createdAt)}
                        </p>
                        {message.body ? (
                          <p className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-6">
                            {message.body}
                          </p>
                        ) : null}
                        <AttachmentList items={message.attachments ?? []} />
                      </article>
                    </div>
                  );
                })}
              </div>

              {current.ticket.status !== 'closed' ? (
                <div className="mt-4 border-t border-[var(--a-line)] pt-4">
                  <div className="mb-2.5 flex flex-wrap gap-1.5" aria-label="پاسخ‌های آماده">
                    {QUICK_REPLIES.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        title={item.text}
                        onClick={() => insertQuickReply(item.text)}
                        className={`rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] text-[#b9c6e4] transition hover:border-[#3b78ff]/40 hover:bg-[#3b78ff]/10 hover:text-white ${FOCUS_RING}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {replyError ? (
                    <div className="mb-2.5">
                      <Notice tone="bad">{replyError}</Notice>
                    </div>
                  ) : null}
                  <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={onComposerKey}
                    rows={3}
                    placeholder="پاسخ پشتیبانی"
                    aria-label="پاسخ پشتیبانی"
                    className={`${fieldClass} h-auto resize-none py-2.5 leading-6`}
                  />
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span className="hidden text-[11.5px] text-[var(--a-muted)] sm:inline">
                      Ctrl + Enter برای ارسال
                    </span>
                    <div className="flex flex-1 items-center justify-end gap-3">
                      {sentFlash ? (
                        <span
                          role="status"
                          className="inline-flex items-center gap-1.5 text-[12.5px] text-[#8ef0cf]"
                        >
                          <Icon name="check" className="h-3.5 w-3.5" />
                          پاسخ ارسال شد
                        </span>
                      ) : null}
                      <button
                        type="button"
                        disabled={!canSend}
                        onClick={() => void reply()}
                        className={BTN_PRIMARY}
                      >
                        {busy === 'reply' ? <Spinner /> : <Icon name="send" />}
                        {busy === 'reply' ? 'در حال ارسال…' : 'ارسال'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[12.5px] text-[var(--a-muted)]">
                  <Icon name="lock" className="h-4 w-4 shrink-0" />
                  این درخواست بسته شده است.
                </div>
              )}
            </>
          ) : threadError ? (
            <div className="m-auto text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#ff6b81]/12 text-[#ff97a7] ring-1 ring-[#ff6b81]/25">
                <Icon name="alert" className="h-5 w-5" />
              </span>
              <p className="mt-4 text-[14px] font-medium">گفتگو خوانده نشد</p>
              <p className="mt-1 max-w-xs text-[12.5px] leading-6 text-[var(--a-muted)]">
                {threadError}
              </p>
              <button
                type="button"
                onClick={() => setThreadNonce((n) => n + 1)}
                className={`${BTN_GHOST} mt-4`}
              >
                تلاش دوباره
              </button>
            </div>
          ) : (
            <div aria-busy="true" className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-3 border-b border-[var(--a-line)] pb-4">
                <Skeleton className="h-11 w-11 !rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64 max-w-full" />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <Skeleton className="h-16 w-3/5 !rounded-2xl" />
                <Skeleton className="ms-auto h-20 w-2/3 !rounded-2xl" />
                <Skeleton className="h-12 w-1/2 !rounded-2xl" />
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
