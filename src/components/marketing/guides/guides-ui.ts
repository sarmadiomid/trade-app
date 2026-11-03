import type { Guide, GuideKind } from '@/lib/seo/guides';
import { faNum, formatJalaliDate } from '@/lib/locale/jalali';

export const GUIDE_WRAP = 'mx-auto w-full max-w-[1120px] px-5 lg:px-8';
export const GUIDE_PROSE_WRAP = 'mx-auto w-full max-w-3xl px-5 lg:px-8';

export const GUIDE_CARD =
  'group flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080c17] transition-[border-color,transform,box-shadow] duration-300 motion-safe:hover:-translate-y-0.5 hover:border-white/[0.18] hover:shadow-[0_24px_60px_-36px_rgba(47,123,255,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70';

export const GUIDE_BTN_PRIMARY =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2f7bff] px-5 text-[13px] font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.14)_inset,0_12px_32px_-12px_rgba(47,123,255,0.9)] transition-[background-color,transform] duration-200 hover:bg-[#4388ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70 motion-safe:active:scale-[0.98]';

export const GUIDE_BTN_GHOST =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-5 text-[13px] font-semibold text-[#dbe4f8] transition-[background-color,border-color] duration-200 hover:border-white/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70';

export function kindLabel(kind: GuideKind): string {
  return kind === 'case-study' ? 'مطالعه موردی' : 'راهنما';
}

export function guideDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return formatJalaliDate(Date.UTC(y, m - 1, d));
}

export function minutesLabel(minutes: number): string {
  return `${faNum(minutes)} دقیقه`;
}

/** Stable cover tint so cards feel varied without images. */
export function coverTone(guide: Guide): string {
  if (guide.kind === 'case-study') {
    return 'from-[#1a1420] via-[#2a1f14] to-[#0a1020]';
  }
  const tones = [
    'from-[#0a1630] via-[#0d2048] to-[#07101f]',
    'from-[#071824] via-[#0a2a3a] to-[#060e18]',
    'from-[#0c1430] via-[#152048] to-[#080c18]',
    'from-[#0a1830] via-[#12305a] to-[#060d1a]',
  ] as const;
  let hash = 0;
  for (let i = 0; i < guide.slug.length; i++) hash = (hash + guide.slug.charCodeAt(i) * (i + 1)) % tones.length;
  return tones[hash]!;
}
