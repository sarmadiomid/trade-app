import { NextResponse, type NextRequest } from 'next/server';
import { parseSepReturn } from '@/lib/app/billing/gateway';
import { publicOrigin } from '@/server/http';
import { settleSepReturn, settleZarinpalReturn } from '@/server/payments';

export const dynamic = 'force-dynamic';

const PAGE = `<!doctype html>
<html lang="fa" dir="rtl">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>بازگشت از پرداخت | Candelo</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0e1116;color:#f4f1ea;font-family:Tahoma,sans-serif">
  <main style="max-width:28rem;padding:2rem;text-align:center;line-height:1.9">
    <h1 style="font-size:1.35rem;margin:0 0 .75rem">بازگشت از درگاه پرداخت</h1>
    <p style="margin:0;color:#b7b1a6">این نشانی بازگشت درگاه پرداخت است. بعد از پرداخت، نتیجه خرید به همین آدرس برمی‌گردد.</p>
  </main>
</body>
</html>`;

function page() {
  return new NextResponse(PAGE, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/** Zarinpal uses Authority/Status. SEP may use GetMethod=true and send State/RefNum/ResNum. */
export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get('Authority') ?? '';
  if (authority) {
    const status = req.nextUrl.searchParams.get('Status') ?? '';
    return redirectZarinpal(req, authority, status);
  }
  const sep = parseSepReturn(req.nextUrl.searchParams);
  if (sep.resNum || sep.refNum || sep.state) return redirectSep(req, sep);
  return page();
}

/** SEP posts form fields after OnlinePG. Zarinpal does not use POST. */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await req.json()) as Record<string, unknown>;
      const flat: Record<string, string> = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          flat[key] = String(value);
        }
      }
      const sep = parseSepReturn(flat);
      if (sep.resNum || sep.refNum || sep.state) return redirectSep(req, sep);
    } else {
      const form = await req.formData();
      const flat: Record<string, string> = {};
      for (const [key, value] of form.entries()) {
        if (typeof value === 'string') flat[key] = value;
      }
      const sep = parseSepReturn(flat);
      if (sep.resNum || sep.refNum || sep.state) return redirectSep(req, sep);
    }
  } catch (error) {
    console.error('[billing/callback] sep body', error);
  }
  return page();
}

async function redirectZarinpal(req: NextRequest, authority: string, status: string) {
  const origin = publicOrigin(req) ?? req.nextUrl.origin;
  const destination = new URL('/home/checkout/result', origin);
  try {
    const result = await settleZarinpalReturn({ authority, status });
    if (result.paymentId) destination.searchParams.set('payment', result.paymentId);
    else destination.searchParams.set('outcome', result.outcome);
  } catch (error) {
    console.error('[billing/callback]', error);
    destination.searchParams.set('outcome', 'error');
  }
  const response = NextResponse.redirect(destination);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

async function redirectSep(req: NextRequest, fields: ReturnType<typeof parseSepReturn>) {
  const origin = publicOrigin(req) ?? req.nextUrl.origin;
  const destination = new URL('/home/checkout/result', origin);
  try {
    const result = await settleSepReturn(fields);
    if (result.paymentId) destination.searchParams.set('payment', result.paymentId);
    else destination.searchParams.set('outcome', result.outcome);
  } catch (error) {
    console.error('[billing/callback]', error);
    destination.searchParams.set('outcome', 'error');
  }
  // 303 so a SEP form POST becomes a GET on the receipt page.
  const response = NextResponse.redirect(destination, 303);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
