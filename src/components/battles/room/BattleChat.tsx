'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { entitlements, isPlanLimitMessage, openPlanPrompt, requiresPlan } from '@/lib/app';
import { faNum } from '@/lib/locale/jalali';
import { usePlan } from '../../billing/usePlan';
import type { ChatMessage } from '@/lib/battles';
import { api } from '../../platform/api';
import { Icon } from '../../ui/Icon';
import { clockFa, faChat, faMessage } from '../format';

const LIMIT = 300;

function hm(at: number): string {
  const d = new Date(at);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return clockFa(`${h}:${m}`);
}

/** The battle's text chat (system messages announce joins, starts, pauses and the result). */
export function BattleChat({
  battleId,
  messages,
  meId,
  canPost,
  onSent,
}: {
  readonly battleId: string;
  readonly messages: readonly ChatMessage[];
  readonly meId: string;
  readonly canPost: boolean;
  readonly onSent: () => void;
}) {
  const chatAllowed = entitlements(usePlan()).battleChat;
  const allowed = canPost && chatAllowed;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1]?.id;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/battles/${battleId}/chat`, { method: 'POST', body: { text: body } });
      setText('');
      onSent();
    } catch (err) {
      const message = err instanceof Error ? faMessage(err.message) : faMessage('Could not send');
      if (!isPlanLimitMessage(message)) setError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3"
        data-testid="chat-list"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-hover text-fg/80">
              <Icon name="chat" size={18} />
            </span>
            <p className="mt-3 text-[13px] font-semibold">هنوز پیامی نیست</p>
            {canPost && !chatAllowed ? (
              <button
                type="button"
                onClick={() => openPlanPrompt(requiresPlan('گفتگوی اتاق', 'mid'))}
                className="mt-1 max-w-[16rem] text-[12px] leading-5 text-fg/75 hover:text-fg"
              >
                {requiresPlan('گفتگوی اتاق', 'mid')}
              </button>
            ) : (
              <p className="mt-1 max-w-[16rem] text-[12px] leading-5 text-fg/75">
                {allowed
                  ? 'برای معامله‌گرهای همین نبرد بنویس. پیام‌ها فقط داخل این نبرد می‌مانند.'
                  : 'پیام‌های نبرد اینجا نشان داده می‌شود.'}
              </p>
            )}
          </div>
        ) : null}
        {messages.map((m) =>
          m.system ? (
            <p
              key={m.id}
              className="mx-auto max-w-[95%] rounded-full bg-hover/80 px-2.5 py-1 text-center text-[11.5px] leading-5 text-fg/80"
            >
              {faChat(m.text)}
            </p>
          ) : (
            <div
              key={m.id}
              className={`flex w-full ${m.userId === meId ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[88%] min-w-0">
                <div
                  className={`mb-0.5 flex items-baseline gap-2 text-[11px] ${
                    m.userId === meId ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span
                    dir="auto"
                    className={`truncate font-semibold ${m.userId === meId ? 'text-accent' : 'text-fg'}`}
                  >
                    {m.userId === meId ? 'تو' : m.name}
                  </span>
                  <time
                    dateTime={new Date(m.at).toISOString()}
                    className="shrink-0 tabular-nums text-fg/70"
                  >
                    {hm(m.at)}
                  </time>
                </div>
                <p
                  dir="auto"
                  className={`rounded-xl px-2.5 py-1.5 text-[12.5px] leading-5 wrap-break-word ${
                    m.userId === meId
                      ? 'bg-accent/15 text-fg ring-1 ring-inset ring-accent/35'
                      : 'bg-chart text-fg ring-1 ring-inset ring-line'
                  }`}
                >
                  {m.text}
                </p>
              </div>
            </div>
          ),
        )}
      </div>
      {error ? (
        <p role="alert" className="px-3 pt-2 text-[12px] leading-5 text-down">
          {error}
        </p>
      ) : null}
      {allowed ? (
        <form onSubmit={send} className="border-t border-line p-2">
          {text.length >= 240 ? (
            <p className="mb-1 px-1 text-end text-[11px] tabular-nums text-fg/75">
              {faNum(LIMIT - text.length)} نویسه مانده
            </p>
          ) : null}
          <div className="flex items-center gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={LIMIT}
              placeholder="پیام به معامله‌گرها"
              aria-label="متن پیام"
              data-testid="chat-input"
              autoComplete="off"
              onKeyDown={(e) => e.stopPropagation()}
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-chart px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              aria-label="ارسال"
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-accent text-accent-fg transition-colors duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="send" size={16} />
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
