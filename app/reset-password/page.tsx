'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import AuthShell, { authButton, authInput } from '@/components/AuthShell';

export default function ResetPasswordPage() {
  // The token arrives in the emailed link (?token=…); read on submit so no render depends on it.
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  // Admin invites link here with &invite=1: the same flow, worded as setting a first password.
  const invite = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get('invite') === '1',
    () => false,
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!token) return setError('This reset link is invalid. Please request a new one.');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('The two passwords don’t match');

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      // Every session was ended, this browser's too.
      try { localStorage.removeItem('user'); } catch {}
      setDone(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell subtitle={invite ? 'Set your password' : 'Choose a new password'}>
      {done ? (
        <div className="text-center">
          <p className="text-[#1F2937] font-semibold mb-2">{invite ? 'Password set' : 'Password changed'}</p>
          <p className="text-sm text-gray-600 mb-6">
            {invite ? 'You can now sign in to the admin dashboard with your email and this password.' : 'For your security we signed you out everywhere. Sign in with your new password.'}
          </p>
          <Link href={invite ? '/admin' : '/login'} className={`${authButton} inline-block`}>{invite ? 'Open the dashboard' : 'Sign in'}</Link>
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-semibold">{error}</p>
              {/expired|invalid|already used/i.test(error) && invite && (
                <p className="text-sm text-red-700">Ask the person who invited you to resend the invite.</p>
              )}
              {/expired|invalid|already used/i.test(error) && !invite && (
                <Link href="/forgot-password" className="text-sm font-bold text-[#0F3460] hover:underline">Request a new link</Link>
              )}
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-[#1F2937] mb-2">New password</label>
              <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" placeholder="At least 8 characters" className={authInput} />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-semibold text-[#1F2937] mb-2">Confirm new password</label>
              <input type="password" id="confirm" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={8} required autoComplete="new-password" className={authInput} />
            </div>
            <button type="submit" disabled={loading} className={authButton}>
              {loading ? 'Saving…' : invite ? 'Set password' : 'Save new password'}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
