'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  closePlanPrompt,
  openPlanPrompt,
  openWelcomePlanPrompt,
  planPrompt,
  planPromptKind,
  setPlanDeniedHandler,
  subscribePlanPrompt,
  welcomePlanQueued,
} from '@/lib/app';
import { SUBSCRIPTION_SETTINGS_HREF, checkoutPath } from './plans';
import { usePlan } from './usePlan';
import { Icon } from '../ui/Icon';

/** Plan cards on Settings → Subscription. */
export const PLAN_SETTINGS_HREF = SUBSCRIPTION_SETTINGS_HREF;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/* -------------------------------------------------------------------------- */
/*  Plan data (mirrors the pricing page)                                       */
/* -------------------------------------------------------------------------- */

type PlanId = 'free' | 'mid' | 'pro';

interface PlanFeature {
  text: string;
  /** Renders an ∞ mark instead of a check. */
  unlimited?: boolean;
}

interface PlanInfo {
  id: PlanId;
  name: string;
  /** null → free plan */
  price: string | null;
  tagline: string;
  features: PlanFeature[];
}

const PLANS: PlanInfo[] = [
  {
    id: 'free',
    name: 'مبتدی',
    price: null,
    tagline: 'تمرین را از همین‌جا شروع کنید',
    features: [
      { text: '۲ جلسه بک‌تست' },
      { text: 'فقط نماد طلا' },
      { text: '۱ بار شرکت در نبرد' },
      { text: 'دفتر معاملات' },
    ],
  },
  {
    id: 'mid',
    name: 'متوسط',
    price: '۱۹۹,۰۰۰',
    tagline: 'تمرین را دقیق‌تر و منظم‌تر کنید',
    features: [
      { text: '۱۵ جلسه بک‌تست' },
      { text: 'فلزات، فارکس و کریپتو' },
      { text: 'جلسه پراپ و آمار کامل' },
      { text: 'نبرد رتبه‌ای' },
      { text: 'ابزار ترسیم' },
    ],
  },
  {
    id: 'pro',
    name: 'حرفه‌ای',
    price: '۳۹۹,۰۰۰',
    tagline: 'هرچه برای تمرین جدی لازم است',
    features: [
      { text: 'جلسه بک‌تست نامحدود', unlimited: true },
      { text: 'فلزات، فارکس، کریپتو، شاخص‌ها و انواع نمودار', unlimited: true },
      { text: 'آمار و شبیه‌ساز ریسک به ریوارد', unlimited: true },
      { text: 'نبرد نامحدود', unlimited: true },
    ],
  },
];

const PAID_PLANS = PLANS.filter((p) => p.price !== null);
const RECOMMENDED: PlanId = 'pro';

/* -------------------------------------------------------------------------- */
/*  Small inline icons (no dependency on Icon names)                           */
/* -------------------------------------------------------------------------- */

function CheckMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfinityMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseMark() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sync + modal                                                               */
/* -------------------------------------------------------------------------- */

function usePlanPrompt(): string | null {
  return useSyncExternalStore(subscribePlanPrompt, planPrompt, () => null);
}

/** Loads the plan and opens this modal whenever an action hits a plan limit. */
export function PlanSync() {
  usePlan();
  useEffect(() => {
    setPlanDeniedHandler(openPlanPrompt);
    return () => setPlanDeniedHandler(null);
  }, []);
  // Once per new account: the login screen queues this, and closing the modal clears it.
  useLayoutEffect(() => {
    if (welcomePlanQueued()) openWelcomePlanPrompt();
  }, []);
  return <PlanUpgradeModal />;
}

/** Shown whenever an action hits a plan limit. The link opens plan selection in settings. */
function PlanUpgradeModal() {
  const message = usePlanPrompt();
  const welcome = message !== null && planPromptKind() === 'welcome';
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<PlanId>(RECOMMENDED);
  const [selectionFor, setSelectionFor] = useState<string | null>(message);
  // Every time the modal opens, start from the recommended plan.
  if (message !== selectionFor) {
    setSelectionFor(message);
    if (message) setSelected(RECOMMENDED);
  }

  // Lock page scroll while open, and give focus back to whatever opened the modal.
  useEffect(() => {
    if (!message) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [message]);

  // Focus trap + Escape.
  useEffect(() => {
    if (!message) return;
    const root = ref.current;
    const items = () =>
      [...(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
        (node) => !node.hasAttribute('disabled'),
      );
    items().at(-1)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closePlanPrompt();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const atStart = document.activeElement === first;
      const atEnd = document.activeElement === last;
      if (e.shiftKey && atStart) {
        e.preventDefault();
        e.stopImmediatePropagation();
        last.focus();
      } else if (!e.shiftKey && atEnd) {
        e.preventDefault();
        e.stopImmediatePropagation();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [message]);

  if (!message || typeof document === 'undefined') return null;

  const selectedPlan =
    PAID_PLANS.find((p) => p.id === selected) ?? PAID_PLANS[PAID_PLANS.length - 1]!;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex animate-fade items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closePlanPrompt();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-upgrade-title"
        aria-describedby="plan-upgrade-message"
        className="relative max-h-[94dvh] w-full max-w-[920px] animate-pop overflow-y-auto overflow-x-hidden rounded-t-3xl border border-line bg-panel text-fg shadow-[0_32px_120px_rgba(0,0,0,0.9)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl"
      >
        {/* ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[28rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent"
        />

        {/* close */}
        <button
          type="button"
          onClick={closePlanPrompt}
          aria-label="بستن"
          className="absolute end-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel/60 text-muted transition hover:border-accent/50 hover:text-fg"
        >
          <CloseMark />
        </button>

        <div className="relative p-5 sm:p-6">
          {/* header */}
          <header className="flex flex-col sm:flex-row sm:items-start sm:gap-4 sm:pe-12">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl bg-accent/20 blur-xl"
              />
              <Icon name="crown" size={22} />
            </div>
            <div className="mt-4 sm:mt-0">
              <h2 id="plan-upgrade-title" className="text-[18px] font-bold tracking-tight">
                {welcome ? 'طرح خود را انتخاب کنید' : 'این قابلیت برای طرح بالاتر است'}
              </h2>
              <p id="plan-upgrade-message" className="mt-2 text-[13.5px] leading-7 text-muted">
                {message}
              </p>
            </div>
          </header>

          {/* plans */}
          <div
            role="radiogroup"
            aria-label="انتخاب طرح"
            className="mt-7 grid gap-3 md:grid-cols-3 md:items-stretch"
          >
            {PLANS.map((plan) => {
              const isFree = plan.price === null;
              const isSelected = !isFree && selected === plan.id;
              const isRecommended = plan.id === RECOMMENDED;

              const body = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-[15px] font-bold ${isFree ? 'text-muted' : 'text-fg'}`}>
                      {plan.name}
                    </h3>
                    {!isFree && (
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                          isSelected
                            ? 'border-accent bg-accent text-accent-fg'
                            : 'border-line text-transparent'
                        }`}
                      >
                        <CheckMark />
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-baseline gap-1.5">
                    {isFree ? (
                      <span className="text-[26px] font-black leading-none text-muted">رایگان</span>
                    ) : (
                      <>
                        <span className="text-[26px] font-black leading-none tracking-tight tabular-nums">
                          {plan.price}
                        </span>
                        <span className="text-[12px] font-semibold text-muted">تومان</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] text-muted">{isFree ? 'برای شروع' : 'ماهانه'}</p>

                  <p className="mt-3 text-[12px] leading-5 text-muted">{plan.tagline}</p>

                  <div className="my-3 h-px bg-line" />

                  <ul className="flex flex-col gap-2">
                    {plan.features.map((f) => (
                      <li key={f.text} className="flex items-start gap-2.5 text-[12.5px] leading-5">
                        <span
                          aria-hidden="true"
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            f.unlimited
                              ? 'bg-accent/20 text-accent'
                              : isFree
                                ? 'bg-white/5 text-muted'
                                : 'bg-accent/10 text-accent'
                          }`}
                        >
                          {f.unlimited ? <InfinityMark /> : <CheckMark />}
                        </span>
                        <span className={isFree ? 'text-muted' : 'text-fg'}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                </>
              );

              // The free plan is shown for comparison only (desktop), it can't be picked here.
              if (isFree) {
                return (
                  <div
                    key={plan.id}
                    className="hidden rounded-2xl border border-line/70 bg-black/10 p-4 opacity-80 md:block"
                  >
                    {body}
                  </div>
                );
              }

              return (
                <label key={plan.id} className="group relative block cursor-pointer">
                  <input
                    type="radio"
                    name="plan-upgrade-choice"
                    value={plan.id}
                    checked={isSelected}
                    onChange={() => setSelected(plan.id)}
                    className="peer sr-only"
                  />
                  {isRecommended && (
                    <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-0.5 text-[11px] font-bold text-accent-fg shadow-[0_6px_20px_rgba(0,0,0,0.5)]">
                      پیشنهادی
                    </span>
                  )}
                  <div
                    className={`h-full rounded-2xl border p-4 transition duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-panel ${
                      isSelected
                        ? 'border-accent bg-accent/[0.07] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_18px_50px_-12px] shadow-accent/30'
                        : 'border-line bg-black/20 hover:border-accent/40 hover:bg-white/[0.02]'
                    }`}
                  >
                    {body}
                  </div>
                </label>
              );
            })}
          </div>

          {/* actions */}
          <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center text-[12px] leading-6 text-muted sm:max-w-[320px] sm:text-start">
              جزئیات مبلغ و دکمه پرداخت در صفحه تسویه حساب است.
            </p>
            <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={closePlanPrompt}
                className="h-11 px-5 text-[14px] font-semibold text-muted transition hover:text-fg"
              >
                {welcome ? 'ادامه با طرح رایگان' : 'بعداً'}
              </button>
              <Link
                href={checkoutPath(selectedPlan.id === 'pro' ? 'pro' : 'mid', 'month')}
                onClick={closePlanPrompt}
                data-testid="plan-upgrade-cta"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-7 text-[14px] font-bold text-accent-fg shadow-[0_10px_30px_-8px] shadow-accent/60 transition hover:brightness-110 active:scale-[0.98]"
              >
                ادامه خرید طرح {selectedPlan.name}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
