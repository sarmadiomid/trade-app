'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '@/lib/battles';
import { api } from '../../platform/api';
import { Icon } from '../../ui/Icon';
import { faChat, faMessage } from '../format';

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
      setError(err instanceof Error ? faMessage(err.message) : faMessage('Could not send'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3"
        data-testid="chat-list"
      >
        {messages.length === 0 ? (
          <p className="pt-6 text-center text-[12.5px] text-muted">هنوز پیامی نیست.</p>
        ) : null}
        {messages.map((m) =>
          m.system ? (
            <p key={m.id} className="text-center text-[11.5px] italic text-muted">
              {faChat(m.text)}
            </p>
          ) : (
            <div key={m.id} className="text-[12.5px] leading-5">
              <span className={`font-semibold ${m.userId === meId ? 'text-accent' : 'text-fg'}`}>
                {m.name}
              </span>{' '}
              <span className="break-words text-fg/90">{m.text}</span>
            </div>
          ),
        )}
      </div>
      {canPost ? (
        <form onSubmit={send} className="flex items-center gap-1.5 border-t border-line p-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="پیام به نبرد"
            aria-label="متن پیام"
            data-testid="chat-input"
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-chart px-2.5 text-[12.5px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            aria-label="ارسال"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-fg disabled:opacity-40"
          >
            <Icon name="send" size={14} />
          </button>
        </form>
      ) : null}
      {error ? <p className="px-3 pb-2 text-[11.5px] text-down">{error}</p> : null}
    </div>
  );
}
