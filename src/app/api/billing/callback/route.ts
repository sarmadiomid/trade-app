import { NextResponse, type NextRequest } from 'next/server';

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
    <p style="margin:0;color:#b7b1a6">این نشانی بازگشت پرداخت کندلو است. نتیجه بانک به همین آدرس می‌رسد. تا وقتی اتصال درگاه کامل نشده، دیدن این صفحه طرحی را فعال نمی‌کند.</p>
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

/** Public return address. A browser or the bank's check opens it with GET. */
export function GET() {
  return page();
}

/**
 * Bank Saman posts the payment result here.
 * The body is not trusted and no plan is activated.
 */
export async function POST(req: NextRequest) {
  await req.text().catch(() => '');
  return page();
}
