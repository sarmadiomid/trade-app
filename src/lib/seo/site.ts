/** Canonical site origin and shared SEO copy for Candelo. */

export const SITE_URL = 'https://candelo.ir';

export const SITE_NAME = 'Candelo';

export const SITE_TITLE = 'Candelo | بک‌تست و بازپخش بازار';

export const SITE_DESCRIPTION =
  'بازار را کندل‌به‌کندل بازپخش کنید، با حساب مجازی معامله کنید و استراتژی را قبل از ریسک واقعی بسنجید.';

export function absoluteUrl(path = '/'): string {
  if (!path || path === '/') return `${SITE_URL}/`;
  return path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
