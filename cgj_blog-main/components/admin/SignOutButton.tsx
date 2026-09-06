'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';

export function SignOutButton({ className = '' }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/admin/login');
    }
  }

  return <button onClick={() => void signOut()} disabled={busy} className={`flex items-center gap-2 disabled:opacity-60 ${className}`}>
    <LogOut size={16} /> {busy ? 'Signing out…' : 'Sign out'}
  </button>;
}
