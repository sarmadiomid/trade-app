'use client';

import { useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react';
import { formatIranianMobile } from '@/auth/phone';
import { faNum } from '@/lib/locale/jalali';
import { BrandName } from '../marketing/Logo';
import { ApiError, api, type Me } from '../platform/api';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import { HomeShell, ShellMenuButton, ShellTools } from './HomeShell';
import { SubscriptionPane } from './SubscriptionPane';

/** Same rule as `setDisplayName` on the battle profile. */
const NAME_RE = /^[\p{L}\p{N} _.\-]{3,20}$/u;
const HANDLE_RE = /^[\p{L}\p{N}._-]{3,20}$/u;

const ZONES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'Asia/Tehran', label: 'تهران' },
  { id: 'UTC', label: 'UTC' },
  { id: 'Asia/Dubai', label: 'دبی' },
  { id: 'Europe/Istanbul', label: 'استانبول' },
  { id: 'Europe/London', label: 'لندن' },
  { id: 'Europe/Berlin', label: 'برلین' },
  { id: 'America/New_York', label: 'نیویورک' },
  { id: 'America/Chicago', label: 'شیکاگو' },
  { id: 'America/Los_Angeles', label: 'لس‌آنجلس' },
  { id: 'Asia/Tokyo', label: 'توکیو' },
  { id: 'Asia/Singapore', label: 'سنگاپور' },
  { id: 'Australia/Sydney', label: 'سیدنی' },
];

const DEVICE_MAX = 2;
const MONITOR_PATH = 'M4 5h16v11H4zM8 20h8M12 16v4';

const TABS: ReadonlyArray<{ id: string; label: string; icon?: IconName; path?: string }> = [
  { id: 'account', label: 'حساب', icon: 'user' },
  { id: 'subscription', label: 'اشتراک', icon: 'crown' },
  { id: 'devices', label: 'دستگاه‌ها', path: MONITOR_PATH },
  { id: 'deleted', label: 'جلسه‌های حذف‌شده', icon: 'trash' },
];

const PANES: Record<string, { title: string; body: string }> = {
  deleted: {
    title: 'جلسه‌های حذف‌شده',
    body: 'جلسه‌هایی که پاک کرده‌اید به‌زودی از این فهرست قابل بازگردانی هستند.',
  },
};

const FIELD =
  'h-11 w-full rounded-lg border border-[var(--h-line)] bg-[var(--h-field)] px-3 text-[14px] text-[var(--h-text)] outline-none transition placeholder:text-[var(--h-muted)] focus:border-[var(--h-accent)]';

type Tone = 'ok' | 'err';

const tzKey = (id: string) => `chartix-tz:${id}`;
const handleKey = (id: string) => `chartix-username:${id}`;
const avatarKey = (id: string) => `chartix-avatar:${id}`;
const betaKey = (id: string) => `chartix-beta:${id}`;

function defaultHandle(name: string, phone: string): string {
  const slug = name.trim().replace(/\s+/g, '');
  if (HANDLE_RE.test(slug)) return slug;
  return `user${phone.replace(/\D/g, '').slice(-8)}`.slice(0, 20);
}

function profileError(message: string): string {
  if (message === 'Invalid name' || message.includes('3')) {
    return 'نام نمایشی باید ۳ تا ۲۰ نویسه باشد؛ حرف، عدد، فاصله، _ . یا - مجاز است.';
  }
  if (message === 'Unauthorized') return 'نشست شما تمام شده. دوباره وارد شوید.';
  return 'ذخیره انجام نشد. دوباره تلاش کنید.';
}

const prefListeners = new Set<() => void>();

function subscribePrefs(onStoreChange: () => void) {
  prefListeners.add(onStoreChange);
  return () => prefListeners.delete(onStoreChange);
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    prefListeners.forEach((listener) => listener());
    return true;
  } catch {
    return false;
  }
}

function readZone(raw: string | null): string {
  return ZONES.some((z) => z.id === raw) ? (raw as string) : 'Asia/Tehran';
}

async function squareAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('bad image'));
      el.src = url;
    });
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('bad image');
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function clearLocalPractice(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve();
      return;
    }
    const req = indexedDB.deleteDatabase('tradingchart');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
  try {
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('tc:')) drop.push(key);
    }
    drop.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage disabled */
  }
}

/** `/home/settings`: account page in the home shell, laid out like the reference, in Persian. */
export function AccountSettings({ user }: { readonly user: Me }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState('account');
  const savedTz = useSyncExternalStore(
    subscribePrefs,
    () => readZone(readLocal(tzKey(user.id))),
    () => 'Asia/Tehran',
  );
  const savedUsername = useSyncExternalStore(
    subscribePrefs,
    () => {
      const handle = readLocal(handleKey(user.id));
      return handle && HANDLE_RE.test(handle) ? handle : defaultHandle(user.name, user.phone);
    },
    () => defaultHandle(user.name, user.phone),
  );
  const avatar = useSyncExternalStore(
    subscribePrefs,
    () => readLocal(avatarKey(user.id)),
    () => null,
  );
  const beta = useSyncExternalStore(
    subscribePrefs,
    () => readLocal(betaKey(user.id)) === '1',
    () => false,
  );
  const [timezone, setTimezone] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user.name);
  const [username, setUsername] = useState<string | null>(null);
  const zone = timezone ?? savedTz;
  const handleValue = username ?? savedUsername;
  const [tzMsg, setTzMsg] = useState<{ tone: Tone; text: string } | null>(null);
  const [profileMsg, setProfileMsg] = useState<{ tone: Tone; text: string } | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const [savingTz, setSavingTz] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetWord, setResetWord] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState<string | null>(null);

  const cleanName = displayName.replace(/\s+/g, ' ').trim();
  const profileDirty = cleanName !== user.name || handleValue.trim() !== savedUsername;

  const saveTimezone = (e: FormEvent) => {
    e.preventDefault();
    setSavingTz(true);
    const ok = store(tzKey(user.id), zone);
    if (ok) setTimezone(null);
    setTzMsg(
      ok
        ? { tone: 'ok', text: 'منطقه زمانی ذخیره شد.' }
        : { tone: 'err', text: 'ذخیره در این مرورگر ممکن نیست.' },
    );
    setSavingTz(false);
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const name = displayName.replace(/\s+/g, ' ').trim();
    const handle = handleValue.trim();
    if (!NAME_RE.test(name)) {
      setProfileMsg({
        tone: 'err',
        text: 'نام نمایشی باید ۳ تا ۲۰ نویسه باشد؛ حرف، عدد، فاصله، _ . یا - مجاز است.',
      });
      return;
    }
    if (!HANDLE_RE.test(handle)) {
      setProfileMsg({
        tone: 'err',
        text: 'نام کاربری باید ۳ تا ۲۰ نویسه باشد؛ حرف، عدد، _ . یا - و بدون فاصله.',
      });
      return;
    }
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      if (name !== user.name) {
        await api('/api/battles/profile', { method: 'PATCH', body: { name } });
      }
      if (!store(handleKey(user.id), handle)) {
        setProfileMsg({
          tone: 'err',
          text:
            name !== user.name
              ? 'نام ذخیره شد، ولی نام کاربری در این مرورگر نماند.'
              : 'نام کاربری در این مرورگر ذخیره نشد.',
        });
      } else {
        setUsername(null);
        setDisplayName(name);
        setProfileMsg({ tone: 'ok', text: 'تغییرات ذخیره شد.' });
      }
      router.refresh();
    } catch (err) {
      setProfileMsg({
        tone: 'err',
        text:
          err instanceof ApiError
            ? profileError(err.message)
            : 'ذخیره انجام نشد. دوباره تلاش کنید.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const onAvatar = async (file: File | undefined) => {
    if (!file) return;
    setAvatarMsg(null);
    if (!file.type.startsWith('image/')) {
      setAvatarMsg('یک فایل تصویری انتخاب کنید.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAvatarMsg('حجم تصویر باید کمتر از ۸ مگابایت باشد.');
      return;
    }
    try {
      const data = await squareAvatar(file);
      if (!store(avatarKey(user.id), data)) {
        setAvatarMsg('ذخیره تصویر در این مرورگر ممکن نیست.');
        return;
      }
    } catch {
      setAvatarMsg('این تصویر خوانده نشد.');
    }
  };

  const logout = async () => {
    setLeaving(true);
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    router.replace('/');
    router.refresh();
  };

  const confirmReset = async () => {
    setResetting(true);
    setResetError(null);
    try {
      await api('/api/account/reset', { method: 'POST', body: { confirm: 'reset' } });
      await clearLocalPractice();
      setResetOpen(false);
      setResetWord('');
      setResetDone('حساب بازنشانی شد. ورود، شماره و نام شما سر جایش است.');
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'بازنشانی انجام نشد.';
      setResetError(
        message === 'Unauthorized'
          ? 'نشست شما تمام شده. دوباره وارد شوید.'
          : message === 'Forbidden' || message === 'Server error'
            ? 'بازنشانی انجام نشد.'
            : message,
      );
    } finally {
      setResetting(false);
    }
  };

  const pane = PANES[tab];

  return (
    <HomeShell user={user} notices={0} noticeMenu={null}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-8 sm:pt-5">
          <div className="flex min-w-0 items-center gap-2">
            <ShellMenuButton />
            <h1 className="truncate text-[20px] font-bold leading-none sm:text-[26px]">تنظیمات حساب</h1>
            <span dir="ltr" className="truncate text-[13px] text-[var(--h-muted)] sm:text-[14px]">
              {formatIranianMobile(user.phone)}
            </span>
          </div>
          <ShellTools />
        </header>

        <div
          role="tablist"
          aria-label="بخش‌های تنظیمات"
          className="mt-4 flex gap-1 overflow-x-auto px-4 sm:px-8"
        >
          {TABS.map((item) => {
            const on = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(item.id)}
                className={`inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-[13.5px] font-medium transition ${
                  on
                    ? 'border-[var(--h-text)] text-[var(--h-text)]'
                    : 'border-transparent text-[var(--h-muted)] hover:text-[var(--h-text)]'
                }`}
              >
                {item.path ? (
                  <Icon path={item.path} size={15} />
                ) : (
                  <Icon name={item.icon ?? 'user'} size={15} />
                )}
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-16 pt-2 sm:px-8">
          {tab === 'account' ? (
            <div className="max-w-[560px]">
              <form onSubmit={saveTimezone} className="border-b border-[var(--h-line)] py-8">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                  منطقه زمانی حساب
                  <button
                    type="button"
                    title="زمان کندل‌ها، دفتر و گزارش‌ها با این منطقه نشان داده می‌شود."
                    aria-label="درباره منطقه زمانی"
                    className="text-[var(--h-muted)]"
                  >
                    <Icon name="info" size={15} />
                  </button>
                </h2>
                <p className="mt-1 text-[13.5px] leading-7 text-[var(--h-muted)]">
                  این منطقه زمانی در همه بخش‌های <BrandName /> به کار می‌رود.
                </p>
                <label
                  htmlFor="account-tz"
                  className="mt-5 mb-1.5 block text-[13px] text-[var(--h-muted)]"
                >
                  منطقه زمانی
                </label>
                <div className="relative">
                  <select
                    id="account-tz"
                    value={zone}
                    onChange={(e) => {
                      setTimezone(e.target.value);
                      setTzMsg(null);
                    }}
                    className={`${FIELD} appearance-none pe-10`}
                  >
                    {ZONES.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="chevronDown"
                    size={16}
                    className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[var(--h-muted)]"
                  />
                </div>
                <div className="mt-4">
                  <SaveButton disabled={savingTz || zone === savedTz}>ذخیره تغییرات</SaveButton>
                </div>
                {tzMsg ? <Note tone={tzMsg.tone}>{tzMsg.text}</Note> : null}
              </form>

              <form
                onSubmit={(e) => void saveProfile(e)}
                className="border-b border-[var(--h-line)] py-8"
              >
                <h2 className="text-[15px] font-semibold">پروفایل شما</h2>
                <p className="mt-1 text-[13.5px] leading-7 text-[var(--h-muted)]">
                  نحوه نمایش شما در <BrandName /> را از اینجا عوض کنید.
                </p>
                <div className="relative mx-auto mt-6 h-[92px] w-[92px]">
                  <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-[var(--h-line)] bg-white text-[#1c2434]">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Icon name="user" size={42} strokeWidth={1.4} />
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label="تغییر تصویر پروفایل"
                    onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-0.5 -end-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#3b78ff] text-white shadow-lg"
                  >
                    <Icon name="camera" size={15} />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      void onAvatar(file);
                    }}
                  />
                </div>
                {avatarMsg ? (
                  <p className="mt-3 text-center text-[13px] text-[#ff8b9a]">{avatarMsg}</p>
                ) : null}

                <Field
                  id="display-name"
                  label="نام نمایشی"
                  value={displayName}
                  autoComplete="nickname"
                  onChange={(v) => {
                    setDisplayName(v);
                    setProfileMsg(null);
                  }}
                />
                <Field
                  id="username"
                  label="نام کاربری"
                  value={handleValue}
                  autoComplete="username"
                  dir="ltr"
                  onChange={(v) => {
                    setUsername(v);
                    setProfileMsg(null);
                  }}
                />
                {handleValue.trim() === savedUsername ? (
                  <p className="mt-2 text-[12.5px] text-[var(--h-muted)]">
                    در حال استفاده از نام کاربری فعلی هستید.
                  </p>
                ) : null}
                <div className="mt-4">
                  <SaveButton disabled={!profileDirty || savingProfile}>ذخیره تغییرات</SaveButton>
                </div>
                {profileMsg ? <Note tone={profileMsg.tone}>{profileMsg.text}</Note> : null}
              </form>

              <section className="border-b border-[var(--h-line)] py-8">
                <h2 className="text-[15px] font-semibold">شماره موبایل</h2>
                <p className="mt-1 text-[13.5px] leading-7 text-[var(--h-muted)]">
                  شماره‌ای که با آن وارد می‌شوید و اعلان‌های حساب را دریافت می‌کنید.
                </p>
                <label
                  htmlFor="account-phone"
                  className="mt-5 mb-1.5 block text-[13px] text-[var(--h-muted)]"
                >
                  شماره موبایل
                </label>
                <input
                  id="account-phone"
                  value={formatIranianMobile(user.phone)}
                  readOnly
                  dir="ltr"
                  className={`${FIELD} text-start`}
                />
                <div className="mt-4">
                  <OutlineButton icon="edit" onClick={() => setPhoneOpen(true)}>
                    تغییر شماره
                  </OutlineButton>
                </div>
              </section>

              <div className="py-8">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={beta}
                    aria-label="امکانات آزمایشی"
                    onClick={() => {
                      store(betaKey(user.id), beta ? '0' : '1');
                    }}
                    className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition disabled:opacity-50 ${
                      beta ? 'bg-[var(--h-accent)]' : 'bg-[var(--h-soft)]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                        beta ? 'start-4' : 'start-0.5'
                      }`}
                    />
                  </button>
                  <div>
                    <p className="text-[14px] font-medium">امکانات آزمایشی</p>
                    <p className="mt-1 text-[13px] leading-6 text-[var(--h-muted)]">
                      زودتر به قابلیت‌هایی برسید که هنوز در حال تکمیل‌اند. هر وقت بخواهید می‌توانید
                      خاموشش کنید.
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <OutlineButton icon="logout" disabled={leaving} onClick={() => void logout()}>
                    {leaving ? 'در حال خروج…' : 'خروج'}
                  </OutlineButton>
                </div>
                {resetDone ? <Note tone="ok">{resetDone}</Note> : null}
              </div>

              <section className="rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] p-5">
                <h2 className="text-[15px] font-semibold">بازنشانی حساب</h2>
                <p className="mt-2 text-[13px] leading-7 text-[var(--h-muted)]">
                  این کار داده‌های تمرینی این حساب را برای همیشه پاک می‌کند: جلسه‌ها و
                  یادداشت‌هایشان، دفتر معاملات، معامله‌ها، نمودارها، طراحی‌ها و تنظیمات ذخیره‌شده
                  روی این دستگاه و روی سرور. آمار و امتیاز نبرد هم به حالت اول برمی‌گردد. اگر در
                  نبردی باشید، اول باید از آن خارج شوید. ورود، شماره موبایل و نام نمایشی سر جایش
                  می‌ماند. این کار برگشت ندارد و مهلت انصراف ندارد.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setResetError(null);
                    setResetWord('');
                    setResetOpen(true);
                  }}
                  className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#f5c400] px-3.5 text-[13px] font-bold text-[#1a1400] transition hover:bg-[#ffd84a]"
                >
                  بازنشانی حساب
                </button>
              </section>
            </div>
          ) : tab === 'subscription' ? (
            <SubscriptionPane />
          ) : tab === 'devices' ? (
            <DevicesPane />
          ) : pane ? (
            <section className="max-w-[560px] py-8">
              <h2 className="text-[15px] font-semibold">{pane.title}</h2>
              <p className="mt-2 text-[13.5px] leading-7 text-[var(--h-muted)]">{pane.body}</p>
            </section>
          ) : null}
        </div>
      </div>

      {phoneOpen ? (
        <Modal title="تغییر شماره" onClose={() => setPhoneOpen(false)}>
          <p className="mt-2 text-[13.5px] leading-7 text-[var(--h-muted)]">
            تغییر شماره با کد یک‌بارمصرف انجام می‌شود. این امکان هنوز از صفحه تنظیمات فعال نشده است.
          </p>
          <div className="mt-4">
            <OutlineButton onClick={() => setPhoneOpen(false)}>باشه</OutlineButton>
          </div>
        </Modal>
      ) : null}

      {resetOpen ? (
        <Modal
          title="حساب بازنشانی شود؟"
          onClose={() => {
            if (!resetting) setResetOpen(false);
          }}
        >
          <p className="mt-2 text-[13.5px] leading-7 text-[var(--h-muted)]">
            برای تأیید، واژه «بازنشانی» را بنویسید. جلسه‌ها، نمودارها و آمار نبرد پاک می‌شوند.
          </p>
          <input
            value={resetWord}
            onChange={(e) => setResetWord(e.target.value)}
            autoFocus
            dir="rtl"
            className={`${FIELD} mt-4 text-right placeholder:text-right`}
            placeholder="بازنشانی"
            aria-label="تأیید بازنشانی"
          />
          {resetError ? <Note tone="err">{resetError}</Note> : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={resetting || resetWord.trim() !== 'بازنشانی'}
              onClick={() => void confirmReset()}
              className="inline-flex h-9 items-center rounded-lg bg-[#f5c400] px-3.5 text-[13px] font-bold text-[#1a1400] transition hover:bg-[#ffd84a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {resetting ? 'در حال بازنشانی…' : 'بازنشانی حساب'}
            </button>
            <OutlineButton disabled={resetting} onClick={() => setResetOpen(false)}>
              انصراف
            </OutlineButton>
          </div>
        </Modal>
      ) : null}
    </HomeShell>
  );
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua)
    ? 'ویندوز'
    : /Mac/.test(ua)
      ? 'مک'
      : /Android/.test(ua)
        ? 'اندروید'
        : /iPhone|iPad/.test(ua)
          ? 'آی‌اواس'
          : /Linux/.test(ua)
            ? 'لینوکس'
            : 'این دستگاه';
  const browser = /Edg\//.test(ua)
    ? 'مایکروسافت اج'
    : /Chrome\//.test(ua)
      ? 'گوگل کروم'
      : /Firefox\//.test(ua)
        ? 'فایرفاکس'
        : /Safari\//.test(ua)
          ? 'سافاری'
          : 'مرورگر';
  return `${os} - ${browser}`;
}

/** Current browser as the one active device. The cap is two. */
function DevicesPane() {
  const name = useSyncExternalStore(
    () => () => {},
    deviceLabel,
    () => 'این مرورگر',
  );
  const used = 1;
  const free = DEVICE_MAX - used;
  return (
    <section className="max-w-[560px] py-8">
      <h2 className="text-[16px] font-semibold">
        دستگاه‌های فعال{' '}
        <span className="font-medium text-[var(--h-muted)]">
          {faNum(used)}/{faNum(DEVICE_MAX)}
        </span>
      </h2>
      <p className="mt-1 text-[13.5px] leading-7 text-[var(--h-muted)]">
        <BrandName /> را حداکثر روی {faNum(DEVICE_MAX)} دستگاه می‌توانید فعال کنید.{' '}
        {faNum(free)} جایگاه خالی دارید.
      </p>
      <article className="mt-5 w-full max-w-[280px] rounded-xl border border-[var(--h-line)] p-4">
        <div className="flex items-start gap-3">
          <Icon path={MONITOR_PATH} size={18} className="mt-0.5 shrink-0 text-[var(--h-muted)]" />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">{name}</p>
            <p className="mt-0.5 text-[12.5px] text-[var(--h-muted)]">آخرین اجرا امروز</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#3dcea0]/70 px-2.5 py-1 text-[12.5px] font-medium text-[#3dcea0]">
              <Icon name="check" size={13} />
              این دستگاه
            </span>
          </div>
        </div>
      </article>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
  dir,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly autoComplete?: string;
  readonly dir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-1.5 block text-[13px] text-[var(--h-muted)]">
        {label}
      </label>
      <input
        id={id}
        value={value}
        dir={dir}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} ${dir === 'ltr' ? 'text-start' : ''}`}
      />
    </div>
  );
}

function SaveButton({
  disabled,
  children,
}: {
  readonly disabled: boolean;
  readonly children: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition ${
        disabled
          ? 'cursor-not-allowed bg-[var(--h-chip)] text-[var(--h-muted)]'
          : 'bg-[var(--h-soft)] text-[var(--h-text)] hover:bg-[var(--h-accent)] hover:text-white'
      }`}
    >
      <Icon name="save" size={14} />
      {children}
    </button>
  );
}

function OutlineButton({
  children,
  icon,
  onClick,
  disabled,
  type = 'button',
}: {
  readonly children: string;
  readonly icon?: IconName;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--h-line)] bg-[var(--h-chip)] px-3.5 text-[13px] font-medium text-[var(--h-text)] transition hover:bg-[var(--h-soft)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}

function Note({ tone, children }: { readonly tone: Tone; readonly children: ReactNode }) {
  return (
    <p className={`mt-3 text-[13px] ${tone === 'ok' ? 'text-[#3dcea0]' : 'text-[#ff8b9a]'}`}>
      {children}
    </p>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="w-full max-w-md rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="settings-dialog-title" className="text-[16px] font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
