import { redirect } from 'next/navigation';
import { CGJLogo } from '@/components/CGJLogo';
import { SignOutButton } from '@/components/admin/SignOutButton';
import { getAdminSession, getAppSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function UnauthorizedAdminPage() {
  const session = await getAppSession();
  if (!session) redirect('/admin/login');
  if (await getAdminSession()) redirect('/admin');

  return <main className="grid min-h-screen place-items-center bg-[#10223c] p-5"><section className="max-w-md bg-[#fffdf8] p-9 text-center"><CGJLogo className="mx-auto" /><h1 className="mt-6 font-display text-3xl">Admin access required</h1><p className="mt-3 text-sm leading-6 text-[#61707b]">{session.identity.email} signed in successfully, but this Google account is not in the active CGJ administrator allowlist.</p><SignOutButton className="mx-auto mt-6 bg-[#10223c] px-5 py-3 font-bold text-white" /></section></main>;
}
