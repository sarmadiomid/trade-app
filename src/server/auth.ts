import 'server-only';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { ObjectId } from 'mongodb';
import { OTP_LENGTH, OTP_RESEND_SECONDS } from '@/auth/phone';
import { normalizePlan, type PlanId } from '@/lib/app/billing/entitlements';
import { collections, type UserDoc } from './db';
import { defaultDisplayName } from './migrations';
import { sendOtpSms } from './sms';

export const SESSION_COOKIE = 'tc_session';
/** A login is valid for 48 hours, then the cookie and the database row both expire. */
export const SESSION_TTL_MS = 48 * 60 * 60 * 1000;

const OTP_TTL_MS = 2 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_WINDOW_MS = 60 * 60_000;
const OTP_MAX_PER_WINDOW = 5;
/** Cap SMS spend across distinct phones from one client IP. */
const OTP_IP_MAX_PER_WINDOW = 20;
const WEAK_AUTH_SECRETS = new Set([
  'dev-only-insecure-auth-secret',
  'change-me-to-a-long-random-string',
  'ci-build-placeholder',
  'dev-only-change-me',
]);

export interface SessionUser {
  readonly id: string;
  readonly phone: string;
  /** Public name (leaderboards, battles). */
  readonly name: string;
  readonly plan: PlanId;
}

const nameOf = (u: Pick<UserDoc, 'phone' | 'displayName'>) =>
  u.displayName ?? defaultDisplayName(u.phone);

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16 && !WEAK_AUTH_SECRETS.has(s)) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be a unique secret (not a documented placeholder)');
  }
  return 'dev-only-insecure-auth-secret';
}

const hashCode = (phone: string, code: string) =>
  createHmac('sha256', secret()).update(`${phone}:${code}`).digest('hex');

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export type RequestOtpResult =
  | { ok: true; resendIn: number; devCode?: string }
  | { ok: false; error: string; status: number; retryIn?: number };

export async function requestOtp(
  phone: string,
  clientKey = 'unknown',
): Promise<RequestOtpResult> {
  const { otps } = await collections();
  const now = new Date();
  const ipId = `ip:${clientKey.slice(0, 128)}`;
  const [prev, ipPrev] = await Promise.all([
    otps.findOne({ _id: phone }),
    otps.findOne({ _id: ipId }),
  ]);
  if (prev) {
    const sinceSent = now.getTime() - prev.sentAt.getTime();
    if (sinceSent < OTP_RESEND_SECONDS * 1000) {
      const retryIn = Math.ceil((OTP_RESEND_SECONDS * 1000 - sinceSent) / 1000);
      return { ok: false, status: 429, error: 'لطفاً کمی صبر کنید.', retryIn };
    }
  }
  const inWindow = prev && now.getTime() - prev.windowStart.getTime() < OTP_WINDOW_MS;
  if (inWindow && prev.sendCount >= OTP_MAX_PER_WINDOW) {
    return {
      ok: false,
      status: 429,
      error: 'تعداد درخواست‌ها بیش از حد مجاز است. یک ساعت دیگر تلاش کنید.',
    };
  }
  const ipInWindow = ipPrev && now.getTime() - ipPrev.windowStart.getTime() < OTP_WINDOW_MS;
  if (ipInWindow && ipPrev.sendCount >= OTP_IP_MAX_PER_WINDOW) {
    return {
      ok: false,
      status: 429,
      error: 'تعداد درخواست‌ها بیش از حد مجاز است. یک ساعت دیگر تلاش کنید.',
    };
  }
  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
  await otps.updateOne(
    { _id: phone },
    {
      $set: {
        codeHash: hashCode(phone, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        attempts: 0,
        sentAt: now,
        windowStart: inWindow ? prev.windowStart : now,
        sendCount: inWindow ? prev.sendCount + 1 : 1,
      },
    },
    { upsert: true },
  );
  await otps.updateOne(
    { _id: ipId },
    {
      $set: {
        codeHash: '',
        expiresAt: new Date(now.getTime() + OTP_WINDOW_MS),
        attempts: 0,
        sentAt: now,
        windowStart: ipInWindow ? ipPrev.windowStart : now,
        sendCount: ipInWindow ? ipPrev.sendCount + 1 : 1,
      },
    },
    { upsert: true },
  );
  const sms = await sendOtpSms(phone, code);
  if (!sms.ok) {
    await otps.updateOne({ _id: phone }, { $set: { sentAt: new Date(0) } });
    await otps.updateOne({ _id: ipId, sendCount: { $gt: 0 } }, { $inc: { sendCount: -1 } });
    return { ok: false, status: 502, error: 'ارسال پیامک ناموفق بود. دوباره تلاش کنید.' };
  }
  return {
    ok: true,
    resendIn: OTP_RESEND_SECONDS,
    ...(sms.devCode ? { devCode: sms.devCode } : {}),
  };
}

export type VerifyOtpResult =
  | { ok: true; token: string; user: SessionUser; isNew: boolean }
  | { ok: false; error: string; status: number };

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const { otps, users, sessions } = await collections();
  const now = new Date();
  const otp = await otps.findOneAndUpdate(
    { _id: phone, expiresAt: { $gt: now }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  );
  if (!otp) return { ok: false, status: 400, error: 'کد منقضی شده است. کد جدید دریافت کنید.' };
  const expected = Buffer.from(otp.codeHash, 'hex');
  const actual = Buffer.from(hashCode(phone, code), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    const left = OTP_MAX_ATTEMPTS - otp.attempts;
    return {
      ok: false,
      status: 400,
      error:
        left > 0
          ? `کد وارد شده صحیح نیست. ${left} تلاش باقی مانده.`
          : 'کد باطل شد. کد جدید دریافت کنید.',
    };
  }
  await otps.updateOne({ _id: phone }, { $set: { expiresAt: new Date(0) } });

  const existing = await users.findOneAndUpdate(
    { phone },
    {
      $set: { lastLoginAt: now },
      $setOnInsert: {
        phone,
        createdAt: now,
        displayName: defaultDisplayName(phone),
        plan: 'beginner',
        usageSessions: 0,
        usageBattles: 0,
        strategyTags: [],
      },
    },
    { upsert: true, returnDocument: 'after', includeResultMetadata: true },
  );
  const user = existing.value as UserDoc;
  const isNew = !existing.lastErrorObject?.updatedExisting;

  const token = randomBytes(32).toString('base64url');
  await sessions.insertOne({
    _id: hashToken(token),
    userId: user._id,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  return {
    ok: true,
    token,
    user: {
      id: user._id.toHexString(),
      phone: user.phone,
      name: nameOf(user),
      plan: normalizePlan(user.plan),
    },
    isNew,
  };
}

export async function userFromToken(
  token: string | undefined,
): Promise<(SessionUser & { _id: ObjectId }) | null> {
  if (!token) return null;
  const { sessions, users } = await collections();
  const now = new Date();
  const session = await sessions.findOne({ _id: hashToken(token), expiresAt: { $gt: now } });
  if (!session) return null;
  if (now.getTime() - session.createdAt.getTime() > SESSION_TTL_MS) {
    await sessions.deleteOne({ _id: session._id });
    return null;
  }
  const user = await users.findOne({ _id: session.userId });
  return user
    ? {
        _id: user._id,
        id: user._id.toHexString(),
        phone: user.phone,
        name: nameOf(user),
        plan: normalizePlan(user.plan),
      }
    : null;
}

export async function revokeToken(token: string | undefined): Promise<void> {
  if (!token) return;
  const { sessions } = await collections();
  await sessions.deleteOne({ _id: hashToken(token) });
}

/** The signed-in user of the current request (server components / route handlers). */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    const user = await userFromToken(token);
    return user ? { id: user.id, phone: user.phone, name: user.name, plan: user.plan } : null;
  } catch (e) {
    console.error('[auth] session lookup failed', e);
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_MS / 1000,
};
