'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import AdminPayments from '@/components/AdminPayments';

/** Standalone payments page; the same panel also opens inline from the admin Overview. */
export default function PremiumAdmin() {
  const [adminKey, setAdminKey] = useState('');
  // null until the session check answers, so a signed-in admin never sees the login form flash.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  // Exchanges the key for the httpOnly admin cookie; the key itself is never stored in the browser.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: adminKey }),
    }).catch(() => null);
    setAdminKey('');
    if (res?.ok) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError(res?.status === 429 ? 'Too many attempts, try later' : 'Wrong admin key');
    }
  };

  useEffect(() => {
    // Older versions kept the raw key here; remove it.
    localStorage.removeItem('admin_key');
    fetch('/api/admin/session')
      .then(res => res.json())
      .then(data => setIsAuthenticated(!!data.admin))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => {});
    setIsAuthenticated(false);
    setAdminKey('');
  };

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-[#0B2545] flex items-center justify-center text-white/60">Checking access…</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F3460] to-[#1a5490] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-black text-[#1F2937] mb-2">Admin Access</h1>
          <p className="text-[#1F2937]/60 mb-6">Enter your admin key</p>
          {error && <p className="text-sm text-red-600 font-semibold mb-4">{error}</p>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#1F2937] mb-2">Admin Key</label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter admin key"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0F3460]"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-6 py-3 bg-[#0F3460] text-white font-bold rounded-lg hover:bg-[#0D2A50] transition-colors"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AdminShell active="payments" onSignOut={handleLogout}>
      <AdminPayments />
    </AdminShell>
  );
}
