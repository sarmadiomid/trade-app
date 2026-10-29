import { NextResponse, type NextRequest } from 'next/server';
import { publicOrigin } from '@/server/http';
import { settleZarinpalReturn } from '@/server/payments';

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
    <p style="margin:0;color:#b7b1a6">این نشانی بازگشت زرین‌پال است. بعد از پرداخت، نتیجه خرید به همین آدرس برمی‌گردد.</p>
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

/** Zarinpal returns the buyer here with Authority and Status query parameters. */
export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get('Authority') ?? '';
  const status = req.nextUrl.searchParams.get('Status') ?? '';
  if (!authority) return page();
  return redirectReturn(req, authority, status);
}

/** Reserved for a gateway that posts its result. Zarinpal uses GET. */
export async function POST(req: NextRequest) {
  await req.text().catch(() => '');
  return page();
}

async function redirectReturn(req: NextRequest, authority: string, status: string) {
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
