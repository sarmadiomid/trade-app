import Link from 'next/link';
import type { Guide } from '@/lib/seo/guides';
import { guidePath } from '@/lib/seo/guides';
import {
  GUIDE_CARD,
  coverTone,
  guideDateLabel,
  kindLabel,
  minutesLabel,
} from './guides-ui';
import { IconCalendar, IconCandles, IconCase, IconClock } from './GuideIcons';

export function GuideCard({ guide, priority = false }: { guide: Guide; priority?: boolean }) {
  const isCase = guide.kind === 'case-study';

  return (
    <Link
      href={guidePath(guide.slug)}
      className={GUIDE_CARD}
      aria-label={`${guide.title} — ${minutesLabel(guide.minutes)} مطالعه`}
    >
      <div
        className={`relative h-[132px] overflow-hidden border-b border-white/[0.06] bg-gradient-to-br ${coverTone(guide)}`}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 70% 30%, #000 20%, transparent 75%)',
          }}
        />
        <div
          className={`absolute -start-8 -top-10 h-40 w-40 rounded-full blur-3xl ${
            isCase ? 'bg-[#f5c451]/20' : 'bg-[#2f7bff]/35'
          }`}
        />
        <div
          className={`absolute -bottom-12 -end-6 h-36 w-36 rounded-full blur-3xl ${
            isCase ? 'bg-[#ef5b7a]/15' : 'bg-[#38d3ff]/20'
          }`}
        />
        <span
          className={`absolute bottom-4 start-4 flex h-11 w-11 items-center justify-center rounded-xl border ${
            isCase
              ? 'border-[#f5c451]/25 bg-[#f5c451]/10 text-[#f5c451]'
              : 'border-[#5aa2ff]/30 bg-[#2f7bff]/15 text-[#9cc4ff]'
          }`}
        >
          {isCase ? <IconCase className="h-5 w-5" /> : <IconCandles className="h-5 w-5" />}
        </span>
        {priority ? <span className="sr-only">مطلب شاخص</span> : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold ${
              isCase
                ? 'border-[#f5c451]/25 bg-[#f5c451]/10 text-[#f5c451]'
                : 'border-[#5aa2ff]/25 bg-[#2f7bff]/10 text-[#9cc4ff]'
            }`}
          >
            {kindLabel(guide.kind)}
          </span>
          <span className="inline-flex items-center gap-1 text-[#7d8bac]">
            <IconClock className="h-3.5 w-3.5" />
            {minutesLabel(guide.minutes)}
          </span>
        </div>

        <h2 className="text-[17px] font-bold leading-8 text-balance text-white transition-colors group-hover:text-[#cfe0ff]">
          {guide.title}
        </h2>

        <p className="line-clamp-3 flex-1 text-[13.5px] leading-7 text-[#8b98b8]">{guide.description}</p>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[12px] text-[#7d8bac]">
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <IconCalendar className="h-3.5 w-3.5 shrink-0" />
            <time dateTime={guide.updated}>{guideDateLabel(guide.updated)}</time>
          </span>
          <span className="truncate" translate="no">
            تیم Candelo
          </span>
        </div>
      </div>
    </Link>
  );
}
