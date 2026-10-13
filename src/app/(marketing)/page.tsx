import type { Metadata } from 'next';
import { Landing } from '@/components/marketing/Landing';
import { currentUser } from '@/server/auth';

export const metadata: Metadata = {
  title: 'چارتیکس | پلتفرم نمودار و تحلیل تکنیکال حرفه‌ای',
  description:
    'داده لحظه‌ای همه بازارهای مالی، بیش از ۱۰۰ اندیکاتور، ابزارهای ترسیم حرفه‌ای و بک‌تست با ری‌پلی؛ تجربه‌ای در سطح تریدینگ‌ویو.',
};

export default async function HomePage() {
  const user = await currentUser();
  return <Landing signedIn={user !== null} />;
}
