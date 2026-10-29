import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminDenied, AdminShell } from '@/components/admin/AdminShell';
import { AdminFrame } from '@/components/admin/AdminFrame';
import { currentUser } from '@/server/auth';
import { isAdminPhone } from '@/server/admin-http';
import './admin.css';

const VAZIRMATN =
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css';

export const metadata: Metadata = { title: 'مدیریت | Candelo' };

export default async function AdminLayout({ children }: { readonly children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login?next=%2Fadmin');
  const allowed = isAdminPhone(user.phone);
  return (
    <div lang="fa" dir="rtl" className="h-full">
      <link rel="stylesheet" href={VAZIRMATN} precedence="default" />
      <AdminFrame>
        {allowed ? (
          <AdminShell name={user.name} phone={user.phone}>
            {children}
          </AdminShell>
        ) : (
          <AdminDenied phone={user.phone} />
        )}
      </AdminFrame>
    </div>
  );
}
