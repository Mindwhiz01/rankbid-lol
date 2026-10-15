'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import Link from 'next/link';
import { SUPPORT_EMAIL } from '@/lib/site';
import { SITE_DESCRIPTION } from '@/lib/seo';

const POLICY_LINKS = [
  { href: '/rules', label: 'Pricing & rules' },
  { href: '/faq', label: 'FAQ' },
  { href: '/tos', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: `mailto:${SUPPORT_EMAIL}`, label: 'Contact' },
];

const styles = `
  @keyframes csRise {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes csFloat {
    0%, 100% { transform: translateY(0) rotate(-3deg); }
    50% { transform: translateY(-10px) rotate(-1deg); }
  }
  @keyframes csDrift {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(40px, -30px) scale(1.08); }
  }
  @keyframes csSweep {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }
  .cs-rise { opacity: 0; animation: csRise 800ms cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0ms) both; }
  .cs-float { animation: csFloat 6s ease-in-out infinite; }
  .cs-drift { animation: csDrift 14s ease-in-out infinite; }
  .cs-sweep {
    background-image: linear-gradient(100deg, #ffffff 0%, #ffffff 40%, #6EE7B7 50%, #ffffff 60%, #ffffff 100%);
    background-size: 300% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: csSweep 7s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .cs-rise, .cs-float, .cs-drift, .cs-sweep { animation: none; opacity: 1; }
  }
`;

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export default function ComingSoon() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  const loadCount = () =>
    fetch('/api/waitlist/count')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (typeof d?.count === 'number') setWaitlistCount(d.count);
      })
      .catch(() => {});

  useEffect(() => {
    loadCount();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setSubmitted(true);
        setEmail('');
        loadCount();
      } else {
        setError(data.error || 'Could not join the waitlist. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="spotlight relative isolate min-h-screen overflow-hidden bg-[#071a33] text-white flex flex-col" suppressHydrationWarning>
        {/* Background: brand glows + dotted grid fading out from the centre */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="cs-drift absolute -top-48 left-[10%] w-[40rem] h-[40rem] rounded-full bg-[#1a5490]/40 blur-3xl" />
          <div className="cs-drift absolute -bottom-48 -right-24 w-[34rem] h-[34rem] rounded-full bg-[#059669]/20 blur-3xl" style={{ animationDelay: '-7s' }} />
          <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,255,255,0.35)_0.6px,transparent_0.6px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,#000_15%,transparent_70%)]" />
        </div>

        <main className="relative z-10 flex-1 flex items-center">
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
            {/* Eyebrow */}
            <span
              style={delay(0)}
              className="cs-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-emerald-300/90"
            >
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
              </span>
              Launching soon
            </span>

            {/* Wordmark with an oversized R */}
            <h1 style={delay(100)} className="cs-rise mt-8 sm:mt-10 flex items-end justify-center select-none" aria-label="RankBid">
              <span
                aria-hidden="true"
                className="cs-float relative mr-1 sm:mr-2 inline-flex items-center justify-center w-[6.5rem] h-[6.5rem] sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-[1.75rem] sm:rounded-[2.5rem] bg-gradient-to-br from-white to-[#DCE7F5] text-[#0F3460] text-[5rem] sm:text-[8rem] md:text-[9.5rem] font-black leading-none tracking-[-0.06em] shadow-2xl shadow-black/40 ring-1 ring-white/40"
              >
                <img src="/brand/logo-mark.png" alt="" width={223} height={194} className="w-[72%] h-auto" />
                <span className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 w-6 h-6 sm:w-9 sm:h-9 rounded-full bg-emerald-400 text-[#071a33] text-[10px] sm:text-sm font-black flex items-center justify-center shadow-lg tracking-normal">#1</span>
              </span>
              <span aria-hidden="true" className="cs-sweep pb-1 sm:pb-2 text-5xl sm:text-7xl md:text-8xl font-black leading-none tracking-[-0.05em]">
                ankBid
              </span>
            </h1>

            <p style={delay(180)} className="cs-rise mt-8 sm:mt-12 text-3xl sm:text-5xl md:text-6xl font-black tracking-[-0.04em] leading-tight">
              Something big is{' '}
              <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">coming soon.</span>
            </p>

            {/* Plain-language summary: the only copy crawlers and AI answer engines see before launch */}
            <p style={delay(220)} className="cs-rise mt-5 sm:mt-6 max-w-xl mx-auto text-sm sm:text-base text-white/60 leading-relaxed">
              {SITE_DESCRIPTION}
            </p>

            {/* Waitlist */}
            <div style={delay(260)} className="cs-rise mt-8 sm:mt-12 max-w-lg mx-auto">
              {!submitted ? (
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 p-1.5 sm:rounded-2xl rounded-2xl bg-white/[0.06] border border-white/15 backdrop-blur-sm focus-within:border-emerald-300/60 transition-colors">
                  <label htmlFor="waitlist-email" className="sr-only">Email address</label>
                  <input
                    id="waitlist-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="flex-1 min-w-0 px-4 py-3 bg-transparent text-white placeholder-white/40 text-sm sm:text-base focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-white text-[#0F3460] text-sm sm:text-base font-black shadow-lg shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                  >
                    {loading ? 'Joining…' : 'Join the waitlist →'}
                  </button>
                </form>
              ) : (
                <div className="p-5 rounded-2xl bg-emerald-400/10 border border-emerald-300/40">
                  <p className="text-lg font-black text-emerald-300">You&apos;re on the list ✓</p>
                  <p className="text-sm text-white/70 mt-1">We&apos;ll email you the moment RankBid goes live.</p>
                </div>
              )}
              {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-300">{error}</p>}

              {waitlistCount !== null && waitlistCount > 0 && (
                <p className="mt-4 text-sm text-white/55">
                  <span className="font-black text-white tabular-nums">{waitlistCount.toLocaleString()}</span>{' '}
                  {waitlistCount === 1 ? 'person has' : 'people have'} already joined. First come, first served.
                </p>
              )}
            </div>
          </div>
        </main>

        {/* Pricing, policies and contact stay reachable before launch (Stripe reviews these). */}
        <footer className="relative z-10 px-4 pb-6">
          <nav aria-label="Policies" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/50">
            {POLICY_LINKS.map(link => (
              <Link key={link.label} href={link.href} className="hover:text-white transition-colors">{link.label}</Link>
            ))}
          </nav>
        </footer>
      </div>
    </>
  );
}
