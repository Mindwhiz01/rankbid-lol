'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SUPPORT_EMAIL } from '@/lib/site';

interface AccountUser {
  id: string;
  email: string;
  name?: string;
}

const input = 'w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F3460]/30 focus:border-[#0F3460]';
const label = 'block text-sm font-semibold text-gray-700 mb-1.5';
const primary = 'px-5 py-2.5 bg-[#0F3460] text-white text-sm font-bold rounded-lg hover:bg-[#0D2A50] transition-colors disabled:opacity-50';

function Status({ ok, text }: { ok: boolean; text: string }) {
  return <p role={ok ? 'status' : 'alert'} className={`text-sm font-semibold ${ok ? 'text-[#047857]' : 'text-red-600'}`}>{text}</p>;
}

/** Profile settings: display name, password and account deletion. */
export default function AccountSettings({ user, onUserChange, onDeleted }: {
  user: AccountUser;
  onUserChange: (user: AccountUser) => void;
  onDeleted: () => void;
}) {
  // Name
  const [name, setName] = useState(user.name || '');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password (Google-only accounts set one without the current password)
  const [hasPassword, setHasPassword] = useState(true);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetch('/api/user/password', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.hasPassword === 'boolean') setHasPassword(d.hasPassword); })
      .catch(() => {});
  }, []);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameMsg(null);
    const trimmed = name.trim();
    if (trimmed.length > 80) return setNameMsg({ ok: false, text: 'Name must be 80 characters or fewer' });
    setNameBusy(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setNameMsg({ ok: false, text: data.error || 'Could not save your name' });
      const updated = { ...user, name: data.name ?? undefined };
      try { localStorage.setItem('user', JSON.stringify(updated)); } catch {}
      onUserChange(updated);
      setNameMsg({ ok: true, text: 'Name saved' });
    } catch {
      setNameMsg({ ok: false, text: 'Network error. Please try again.' });
    } finally {
      setNameBusy(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (next.length < 8) return setPwMsg({ ok: false, text: 'New password must be at least 8 characters' });
    if (next !== confirm) return setPwMsg({ ok: false, text: 'The two new passwords don’t match' });
    setPwBusy(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setPwMsg({ ok: false, text: data.error || 'Could not change your password' });
      setCurrent(''); setNext(''); setConfirm('');
      setHasPassword(true);
      setPwMsg({ ok: true, text: 'Password changed. Other devices were signed out.' });
    } catch {
      setPwMsg({ ok: false, text: 'Network error. Please try again.' });
    } finally {
      setPwBusy(false);
    }
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    setDeleteBusy(true);
    try {
      const res = await fetch('/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: deleteWord.trim(), password: deletePassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setDeleteError(data.error || 'Could not delete your account');
      onDeleted();
    } catch {
      setDeleteError('Network error. Please try again.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-5 sm:p-8 border border-gray-200">
      <div className="space-y-8">
        {/* Account information */}
        <section>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Account information</h3>
          <form onSubmit={saveName} className="space-y-3 max-w-md">
            <label className="block">
              <span className={label}>Display name</span>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" className={input} placeholder="John Smith" />
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={nameBusy || name.trim() === (user.name || '')} className={primary}>
                {nameBusy ? 'Saving…' : 'Save name'}
              </button>
              {nameMsg && <Status {...nameMsg} />}
            </div>
          </form>
          <div className="mt-5 max-w-md">
            <span className={label}>Email address</span>
            <p className="text-gray-600 text-sm">{user.email}</p>
            <p className="text-xs text-gray-500 mt-1">
              Your email is your sign-in. To change it, email <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a> from this address.
            </p>
          </div>
        </section>

        {/* Password */}
        <section className="border-t border-gray-200 pt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-1">{hasPassword ? 'Change password' : 'Set a password'}</h3>
          <p className="text-sm text-gray-500 mb-4">
            {hasPassword
              ? <>Forgot it? <Link href="/forgot-password" className="underline">Reset it by email</Link>.</>
              : 'You sign in with Google. Set a password to also sign in with your email.'}
          </p>
          <form onSubmit={savePassword} className="space-y-3 max-w-md">
            {hasPassword && (
              <label className="block">
                <span className={label}>Current password</span>
                <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required autoComplete="current-password" className={input} />
              </label>
            )}
            <label className="block">
              <span className={label}>New password</span>
              <input type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" className={input} />
            </label>
            <label className="block">
              <span className={label}>Confirm new password</span>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" className={input} />
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={pwBusy} className={primary}>{pwBusy ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}</button>
              {pwMsg && <Status {...pwMsg} />}
            </div>
          </form>
        </section>

        {/* Danger zone */}
        <section className="border-t border-gray-200 pt-8">
          <h3 className="text-lg font-bold text-red-600 mb-2">Danger zone</h3>
          <p className="text-gray-600 text-sm mb-4">
            Deleting your account removes it with all your submissions and their votes. This can&apos;t be undone.
          </p>
          {!deleteOpen ? (
            <button type="button" onClick={() => setDeleteOpen(true)} className="px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors">
              Delete account
            </button>
          ) : (
            <form onSubmit={deleteAccount} className="space-y-3 max-w-md rounded-xl border border-red-200 bg-red-50/60 p-4">
              <label className="block">
                <span className={label}>Type <strong>DELETE</strong> to confirm</span>
                <input value={deleteWord} onChange={e => setDeleteWord(e.target.value)} autoComplete="off" className={input} />
              </label>
              {hasPassword && (
                <label className="block">
                  <span className={label}>Your password</span>
                  <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} required autoComplete="current-password" className={input} />
                </label>
              )}
              {deleteError && <Status ok={false} text={deleteError} />}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={deleteBusy || deleteWord.trim() !== 'DELETE'} className="px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                  {deleteBusy ? 'Deleting…' : 'Delete my account'}
                </button>
                <button type="button" onClick={() => { setDeleteOpen(false); setDeleteWord(''); setDeletePassword(''); setDeleteError(''); }} className="text-sm font-bold text-gray-600 hover:text-gray-900">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
