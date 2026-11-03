'use client';

import { useState } from 'react';
import { IconLink } from './GuideIcons';

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] text-[#9cc4ff] transition-[background-color,border-color,color] duration-200 hover:border-white/25 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70"
      aria-label={copied ? 'لینک کپی شد' : 'کپی لینک مطلب'}
      title={copied ? 'کپی شد' : 'کپی لینک'}
    >
      <IconLink className="h-4 w-4" />
      <span className="sr-only" aria-live="polite">
        {copied ? 'لینک کپی شد' : ''}
      </span>
    </button>
  );
}
