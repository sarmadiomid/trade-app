import type { Metadata } from 'next';
import { Landing } from '@/components/marketing/Landing';
import { currentUser } from '@/server/auth';

export const metadata: Metadata = {
  title: 'چارتیکس | بک‌تست و بازپخش بازار',
  description:
    'بازار را کندل‌به‌کندل بازپخش کنید، با حساب مجازی معامله کنید و استراتژی را قبل از ریسک واقعی بسنجید.',
};

export default async function HomePage() {
  const user = await currentUser();
  return <Landing signedIn={user !== null} />;
}
