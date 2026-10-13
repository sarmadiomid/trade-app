'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  formatIranianMobile,
  normalizeIranianMobile,
  toAsciiDigits,
} from '@/auth/phone';
import { BRAND_FA, Logo } from './Logo';

type Step = 'phone' | 'code';

const faDigits = (s: string | number) =>
  String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);

async function post<T>(url: string, body: unknown): Promise<{ ok: boolean; data: T }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: (await res.json().catch(() => ({}))) as T };
  } catch {
    return { ok: false, data: { error: 'اتصال به سرور برقرار نشد.' } as T };
  }
}

function Spinner() {
  return <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}

function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))]?.focus();

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setFrom = (index: number, raw: string) => {
    const digits = toAsciiDigits(raw).replace(/\D/g, '');
    if (!digits) return;
    const chars = value.padEnd(OTP_LENGTH, ' ').split('');
    for (let k = 0; k < digits.length && index + k < OTP_LENGTH; k++) chars[index + k] = digits[k]!;
    const next = chars.join('').replace(/\s+$/, '');
    onChange(next.replace(/ /g, ''));
    focus(index + digits.length);
  };

  return (
    <div className={`flex justify-center gap-2.5 sm:gap-3 ${invalid ? 'mk-shake' : ''}`} dir="ltr">
      {Array.from({ length: OTP_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={value[i] ?? ''}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`رقم ${i + 1} کد تایید`}
          maxLength={OTP_LENGTH}
          onChange={(e) => setFrom(i, e.target.value.slice(value[i] ? 1 : 0) || e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            setFrom(0, e.clipboardData.getData('text'));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (value[i]) onChange(value.slice(0, i) + value.slice(i + 1));
              else if (i > 0) {
                onChange(value.slice(0, i - 1) + value.slice(i));
                focus(i - 1);
              }
            } else if (e.key === 'ArrowLeft') focus(i - 1);
            else if (e.key === 'ArrowRight') focus(i + 1);
          }}
          onFocus={(e) => e.currentTarget.select()}
          className={`h-16 w-12 rounded-2xl border bg-[rgba(3,10,28,0.7)] text-center font-mono text-2xl font-bold text-white outline-none transition sm:h-[68px] sm:w-14 ${
            invalid
              ? 'border-[#ef5b7a]'
              : value[i]
                ? 'border-[var(--mk-blue)] shadow-[0_0_0_4px_rgba(47,123,255,0.15)]'
                : 'border-[var(--mk-line)] focus:border-[var(--mk-blue-2)] focus:shadow-[0_0_0_4px_rgba(47,123,255,0.18)]'
          }`}
        />
      ))}
    </div>
  );
}

export function LoginView({ next }: { next: string }) {
  const [step, setStep] = useState<Step>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const lastSubmitted = useRef('');

  useEffect(() => {
    if (step !== 'code') return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [step]);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const requestCode = async (target: string) => {
    setBusy(true);
    setError(null);
    const { ok, data } = await post<{ error?: string; resendIn?: number; retryIn?: number; devCode?: string }>(
      '/api/auth/otp/request',
      { phone: target },
    );
    setBusy(false);
    if (!ok) {
      setError(data.error ?? 'خطایی رخ داد.');
      if (data.retryIn && step === 'code') setResendAt(Date.now() + data.retryIn * 1000);
      return false;
    }
    setDevCode(data.devCode ?? null);
    setResendAt(Date.now() + (data.resendIn ?? OTP_RESEND_SECONDS) * 1000);
    return true;
  };

  const submitPhone = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeIranianMobile(phoneInput);
    if (!normalized) {
      setError('شماره موبایل معتبر نیست. نمونه: ۰۹۱۲۱۲۳۴۵۶۷');
      return;
    }
    if (await requestCode(normalized)) {
      setPhone(normalized);
      setCode('');
      lastSubmitted.current = '';
      setStep('code');
    }
  };

  const verify = async (value: string) => {
    if (value.length !== OTP_LENGTH || busy) return;
    lastSubmitted.current = value;
    setBusy(true);
    setError(null);
    const { ok, data } = await post<{ error?: string }>('/api/auth/otp/verify', { phone, code: value });
    if (ok) {
      window.location.assign(next);
      return;
    }
    setBusy(false);
    setError(data.error ?? 'خطایی رخ داد.');
    setInvalid(true);
    window.setTimeout(() => setInvalid(false), 650);
  };

  const onCodeChange = (v: string) => {
    setCode(v);
    setError(null);
    if (v.length === OTP_LENGTH && v !== lastSubmitted.current) void verify(v);
  };

  return (
    <div className="flex min-h-full">
      <div className="relative flex w-full flex-col px-6 py-8 sm:px-10 lg:w-[52%] lg:px-16 xl:px-24">
        <div className="mk-glow pointer-events-none absolute inset-0 opacity-50 lg:hidden" />
        <div className="relative flex items-center justify-between">
          <Link href="/" aria-label={BRAND_FA}>
            <Logo />
          </Link>
          <Link href="/" className="text-sm text-[var(--mk-muted)] transition hover:text-white">
            بازگشت به صفحه اصلی
          </Link>
        </div>

        <div className="relative mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12">
          {step === 'phone' ? (
            <form onSubmit={submitPhone} noValidate className="mk-fade-up">
              <h1 className="text-3xl font-black tracking-tight">ورود یا ثبت‌نام</h1>
              <p className="mt-3 text-[15px] leading-7 text-[var(--mk-muted)]">
                شماره موبایل خود را وارد کنید. اگر حساب کاربری ندارید، به‌صورت خودکار ساخته می‌شود.
              </p>
              <label htmlFor="phone" className="mt-9 block text-sm font-semibold">
                شماره موبایل
              </label>
              <div
                className={`mt-2.5 flex h-14 items-center overflow-hidden rounded-2xl border bg-[rgba(3,10,28,0.7)] transition focus-within:shadow-[0_0_0_4px_rgba(47,123,255,0.18)] ${
                  error ? 'border-[#ef5b7a]' : 'border-[var(--mk-line)] focus-within:border-[var(--mk-blue-2)]'
                }`}
                dir="ltr"
              >
                <span className="flex h-full items-center border-r border-[var(--mk-line)] px-4 font-mono text-sm text-[var(--mk-muted)]">
                  +98
                </span>
                <input
                  id="phone"
                  autoFocus
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setError(null);
                  }}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0912 123 4567"
                  maxLength={16}
                  className="h-full min-w-0 flex-1 bg-transparent px-4 font-mono text-lg tracking-wider text-white outline-none placeholder:text-[#4a5a85]"
                />
              </div>
              {error ? (
                <p role="alert" className="mt-3 text-sm text-[#ff8aa2]">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy || !phoneInput.trim()}
                className="mk-btn-primary mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white disabled:pointer-events-none disabled:opacity-50"
              >
                {busy ? <Spinner /> : 'دریافت کد تایید'}
              </button>
              <p className="mt-6 text-center text-xs leading-6 text-[var(--mk-muted)]">
                با ورود به {BRAND_FA}، کد تایید یک‌بار مصرف به شماره شما پیامک می‌شود.
              </p>
            </form>
          ) : (
            <form
              className="mk-fade-up"
              onSubmit={(e) => {
                e.preventDefault();
                void verify(code);
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setError(null);
                }}
                className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--mk-muted)] transition hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                ویرایش شماره
              </button>
              <h1 className="text-3xl font-black tracking-tight">کد تایید را وارد کنید</h1>
              <p className="mt-3 text-[15px] leading-7 text-[var(--mk-muted)]">
                کد {faDigits(OTP_LENGTH)} رقمی به شماره{' '}
                <span className="font-mono font-bold text-white" dir="ltr">
                  {formatIranianMobile(phone)}
                </span>{' '}
                پیامک شد.
              </p>
              <div className="mt-9">
                <OtpInput value={code} onChange={onCodeChange} disabled={busy} invalid={invalid} />
              </div>
              {devCode ? (
                <p className="mt-4 text-center text-xs text-[var(--mk-muted)]">
                  حالت توسعه — کد: <span className="font-mono font-bold text-[var(--mk-cyan)]">{devCode}</span>
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="mt-4 text-center text-sm text-[#ff8aa2]">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy || code.length !== OTP_LENGTH}
                className="mk-btn-primary mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white disabled:pointer-events-none disabled:opacity-50"
              >
                {busy ? <Spinner /> : 'تایید و ورود'}
              </button>
              <div className="mt-6 text-center text-sm">
                {resendIn > 0 ? (
                  <span className="text-[var(--mk-muted)]">
                    ارسال مجدد کد تا{' '}
                    <span className="font-mono text-white">
                      {faDigits(`${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, '0')}`)}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (await requestCode(phone)) {
                        setCode('');
                        lastSubmitted.current = '';
                      }
                    }}
                    className="font-semibold text-[var(--mk-blue-2)] transition hover:text-white"
                  >
                    ارسال مجدد کد
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      <aside className="relative hidden flex-1 overflow-hidden border-r border-[var(--mk-line)] bg-[linear-gradient(160deg,#0d2a80,#061440_45%,#030a1c)] lg:block">
        <div className="mk-grid-bg pointer-events-none absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-[var(--mk-blue)] opacity-30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-[var(--mk-cyan)] opacity-10 blur-3xl" />
        <div className="relative flex h-full flex-col justify-center px-14 xl:px-20">
          <div className="mk-card mk-ring mk-float rounded-3xl p-6" dir="ltr">
            <div className="flex items-center justify-between text-xs text-[#7d93c9]">
              <span className="font-bold text-white">ETHUSDT · 4H</span>
              <span className="flex items-center gap-1.5">
                <span className="mk-pulse-dot h-1.5 w-1.5 rounded-full bg-[var(--mk-cyan)]" />
                LIVE
              </span>
            </div>
            <svg viewBox="0 0 400 170" className="mt-4 h-auto w-full" aria-hidden="true">
              {Array.from({ length: 28 }, (_, i) => {
                const base = 120 - i * 2.6 + Math.sin(i * 1.3) * 16;
                const up = Math.sin(i * 2.1) > -0.3;
                const h = 10 + Math.abs(Math.cos(i * 1.7)) * 18;
                const x = 10 + i * 14;
                return (
                  <g key={i}>
                    <line x1={x} x2={x} y1={base - h - 7} y2={base + 7} stroke={up ? '#4a9dff' : '#ef5b7a'} />
                    <rect x={x - 4} y={base - h} width="8" height={h} rx="1" fill={up ? '#4a9dff' : '#ef5b7a'} />
                  </g>
                );
              })}
              <path className="mk-draw" d="M10 150 L390 40" stroke="#38d3ff" strokeWidth="2" fill="none" />
              <path d="M10 112 L390 2" stroke="#38d3ff" strokeOpacity=".4" strokeDasharray="5 5" fill="none" />
            </svg>
          </div>
          <h2 className="mt-12 text-3xl font-black leading-[1.4]">
            همه بازارهای مالی،
            <br />
            <span className="mk-gradient-text">روی یک نمودار حرفه‌ای</span>
          </h2>
          <ul className="mt-8 space-y-4 text-[15px] text-[#c6d8ff]">
            {[
              'داده لحظه‌ای کریپتو، فارکس، سهام، بورس ایران و طلا',
              'بیش از ۱۰۰ اندیکاتور و ۱۸ ابزار ترسیم حرفه‌ای',
              'بک‌تست استراتژی با ری‌پلی کندل به کندل بازار',
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(56,211,255,0.15)] text-[var(--mk-cyan)]">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.2 4.2L19 7" />
                  </svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
