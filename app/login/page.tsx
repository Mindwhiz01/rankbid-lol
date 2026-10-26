'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import ResendVerification from '@/components/ResendVerification';
import { safeNextPath } from '@/lib/safe-next';

// Where to go after login: ?next=/some/path (same-site paths only, never //host, /\host or full URLs).
function nextPath(): string {
  return safeNextPath(new URLSearchParams(window.location.search).get('next'), '/');
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnverified(false);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setUnverified(Boolean(data.unverified));
        return;
      }

      // Store user info in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));

      router.push(nextPath());
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Google login failed');
        return;
      }

      // Store user info in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));

      router.push(nextPath());
    } catch {
      setError('An error occurred during Google login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-gray-900 flex items-center justify-center px-4 py-10">
      <div className="absolute -top-32 -right-24 w-96 h-96 bg-[#1a5490] rounded-full blur-3xl opacity-40 pointer-events-none" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-24 w-96 h-96 bg-[#059669] rounded-full blur-3xl opacity-25 pointer-events-none" aria-hidden="true" />
      <div className="relative w-full max-w-md slide-up">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 border border-white/20">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex mb-4">
              <img src="/brand/logo.png" alt="RankBid" width={491} height={295} className="h-24 w-auto" />
            </Link>
            <p className="text-gray-600 text-sm mt-4">Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-semibold">{error}</p>
              {unverified && <div className="mt-2"><ResendVerification email={email} next={nextPath()} /></div>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#1F2937] mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F3460] focus:border-transparent transition-all"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-semibold text-[#1F2937]">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-bold text-[#0F3460] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F3460] focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-[#0F3460] text-white font-bold rounded-lg hover:bg-[#0D2A50] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin">⏳</span> Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="text-xs text-gray-500 font-semibold">OR</span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>

          {/* Google Login */}
          <div className="mt-6 flex justify-center">
            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google login failed')}
                text="signin_with"
                size="large"
              />
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-[#0F3460] font-bold hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
