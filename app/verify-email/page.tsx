'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell, { authButton } from '@/components/AuthShell';

// After confirming: ?next=/path from the signup (same-site only), otherwise the submit form.
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/#submit';
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const started = useRef(false);

  // Confirms as soon as the emailed link opens. The token works once, so this runs once.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get('token') || '';
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not confirm the email. Please try again.');
        try { localStorage.setItem('user', JSON.stringify(data.user)); } catch {}
        router.replace(nextPath());
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Network error. Please try again.'));
  }, [router]);

  return (
    <AuthShell subtitle="Confirm your email">
      {error ? (
        <div className="text-center">
          <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-semibold">{error}</p>
          </div>
          <Link href="/login" className={`${authButton} inline-block`}>Go to sign in</Link>
        </div>
      ) : (
        <p className="text-center text-sm text-gray-600">Confirming your email…</p>
      )}
    </AuthShell>
  );
}
