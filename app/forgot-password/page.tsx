'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthShell, { authButton, authInput } from '@/components/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || 'Something went wrong. Please try again.');
      else setSent(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell subtitle="Reset your password">
      {sent ? (
        <div className="text-center">
          <p className="text-[#1F2937] font-semibold mb-2">Check your inbox</p>
          <p className="text-sm text-gray-600 mb-6">
            If an account exists for <strong>{email}</strong>, we sent a link to choose a new password. It works once and expires in 1 hour.
            Don&apos;t see it? Check your spam folder.
          </p>
          <Link href="/login" className="text-[#0F3460] font-bold text-sm hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-semibold">{error}</p>
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-gray-600">Enter the email you signed up with and we&apos;ll send you a reset link.</p>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#1F2937] mb-2">Email Address</label>
              <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" className={authInput} />
            </div>
            <button type="submit" disabled={loading} className={authButton}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-600">
            Remembered it? <Link href="/login" className="text-[#0F3460] font-bold hover:underline">Sign in</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
