'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell, { authButton } from '@/components/AuthShell';

// Opened from the "Confirm your vote" email. On success the support page shows its thank-you
// (SupportVoteForm reads the same localStorage key).
export default function ConfirmSupportVotePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const started = useRef(false);

  // The token works once, so this runs once.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get('token') || '';
    fetch('/api/support-vote/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data.listingId !== 'string') throw new Error(data.error || 'Could not confirm your vote. Please try again.');
        try { localStorage.setItem(`rankbid_supported_${data.listingId}`, data.name || 'friend'); } catch {}
        router.replace(`/support/${encodeURIComponent(data.listingId)}`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Network error. Please try again.'));
  }, [router]);

  return (
    <AuthShell subtitle="Confirm your vote">
      {error ? (
        <div className="text-center">
          <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-semibold">{error}</p>
          </div>
          <Link href="/" className={`${authButton} inline-block`}>Go to RankBid</Link>
        </div>
      ) : (
        <p className="text-center text-sm text-gray-600">Confirming your vote…</p>
      )}
    </AuthShell>
  );
}
