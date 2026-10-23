'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import PasswordInput from '@/components/PasswordInput';
import Turnstile, { TURNSTILE_SITE_KEY, type TurnstileHandle } from '@/components/Turnstile';

// After sign-up: ?next=/path (same-site only), otherwise straight to the submit form.
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/#submit';
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Please complete the "I am human" check');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, turnstileToken: captchaToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Signup failed');
        // Each token works once: get a fresh one for the next attempt.
        captcha.current?.reset();
        return;
      }

      // Store user info in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));

      router.push(nextPath());
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
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
        setError(data.error || 'Google signup failed');
        return;
      }

      // Store user info in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));

      router.push(nextPath());
    } catch (err) {
      setError('An error occurred during Google signup');
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
            <p className="text-gray-600 text-sm mt-4">Create a new account</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-semibold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-[#1F2937] mb-2">
                Full Name (Optional)
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F3460] focus:border-transparent transition-all"
              />
            </div>

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
              <label htmlFor="password" className="block text-sm font-semibold text-[#1F2937] mb-2">
                Password
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F3460] focus:border-transparent transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-[#1F2937] mb-2">
                Confirm Password
              </label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F3460] focus:border-transparent transition-all"
              />
            </div>

            <div className="mt-6">
              <Turnstile ref={captcha} onToken={setCaptchaToken} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-[#0F3460] text-white font-bold rounded-lg hover:bg-[#0D2A50] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin">⏳</span> Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="text-xs text-gray-500 font-semibold">OR</span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>

          {/* Google Signup */}
          <div className="mt-6 flex justify-center">
            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google signup failed')}
                text="signup_with"
                size="large"
              />
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-[#0F3460] font-bold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
