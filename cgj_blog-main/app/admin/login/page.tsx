import { redirect } from 'next/navigation';
import { CGJLogo } from '@/components/CGJLogo';
import { getAdminSession, getAppSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const errors: Record<string, string> = {
  configuration: 'Google sign-in is not configured on this deployment.',
  google_cancelled: 'Google sign-in was cancelled. Please try again.',
  invalid_callback: 'Google did not return a valid sign-in response. Please try again.',
  google_sign_in_failed: 'Google sign-in could not be verified. Please start again.',
  server_error: 'The sign-in service is temporarily unavailable. Please try again.',
};

export default async function AdminLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const session = await getAppSession();
  if (session) {
    if (await getAdminSession()) redirect('/admin');
    redirect('/admin/unauthorized');
  }
  const error = searchParams.error ? errors[searchParams.error] ?? 'Unable to sign in.' : null;

  return <main className="grid min-h-screen place-items-center bg-[#10223c] p-5"><section className="w-full max-w-md bg-[#fffdf8] p-8 md:p-10"><div className="flex items-center gap-3"><CGJLogo /><div><b className="tracking-[.12em]">CGJ EDITORIAL</b><p className="text-xs text-[#61707b]">NUSRL · RANCHI</p></div></div><p className="eyebrow mt-8 text-[#ef765d]">Secure workspace</p><h1 className="mt-3 font-display text-4xl text-[#10223c]">Welcome back.</h1><p className="mt-3 text-sm leading-6 text-[#61707b]">Sign in with the Google account authorized for the CGJ editorial team.</p><a href="/api/auth/google?next=/admin" className="mt-7 flex w-full items-center justify-center gap-3 bg-[#10223c] p-3.5 font-bold text-white hover:bg-[#ef765d]"><span aria-hidden="true" className="text-lg">G</span> Continue with Google</a>{error && <p className="mt-5 text-sm leading-6 text-[#b94e3a]" role="alert">{error}</p>}<a href="/" className="mt-6 block text-center text-sm font-bold text-[#61707b]">Return to public site</a></section></main>;
}
