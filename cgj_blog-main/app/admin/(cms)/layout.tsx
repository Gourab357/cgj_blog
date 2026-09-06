import { redirect } from 'next/navigation';
import { getAdminSession, getAppSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminCmsLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect('/admin/login');
  if (!await getAdminSession()) redirect('/admin/unauthorized');
  return <>{children}</>;
}
