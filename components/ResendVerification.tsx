'use client';

import { useState } from 'react';

/** "Resend the confirmation email" link for an email signup that hasn't confirmed yet. */
export default function ResendVerification({ email, next }: { email: string; next?: string | null }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const resend = async () => {
    setState('sending');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send the email');
      setState('sent');
      setMessage('Sent! Check your inbox (and the spam folder).');
    } catch (e) {
      setState('error');
      setMessage(e instanceof Error ? e.message : 'Could not send the email');
    }
  };

  if (state === 'sent' || state === 'error') {
    return <p className={`text-sm ${state === 'sent' ? 'text-emerald-700' : 'text-red-700'}`}>{message}</p>;
  }
  return (
    <button type="button" onClick={resend} disabled={state === 'sending'} className="text-sm font-bold text-[#0F3460] hover:underline disabled:opacity-50">
      {state === 'sending' ? 'Sending…' : 'Resend the confirmation email'}
    </button>
  );
}
