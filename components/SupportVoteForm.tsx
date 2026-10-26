'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import PlatformIcon from '@/components/PlatformIcon';
import Turnstile, { TURNSTILE_SITE_KEY, type TurnstileHandle } from '@/components/Turnstile';
import { IconTile, PremiumIcons } from '@/components/PremiumIcons';
import { getCategoryLabel } from '@/lib/categories';
import type { PublicListing } from '@/lib/server/votes';
import { linkedInShareUrl, supportUrl } from '@/lib/site';
import { PLATFORM_LABELS, normalizePlatform } from '@/lib/platform-url';
import { safeExternalUrl } from '@/lib/utils';
import { logoUrl } from '@/lib/logo';

type SupportType = 'founder' | 'friend' | 'supporter';

const OPTIONS: { value: SupportType; label: string; hint: string; icon: ReactNode; tone: 'navy' | 'green' }[] = [
  { value: 'founder', label: 'Founder', hint: 'I’m a fellow founder', icon: <PremiumIcons.Rocket />, tone: 'navy' },
  { value: 'friend', label: 'Friend', hint: 'I know the maker', icon: <PremiumIcons.Heart />, tone: 'green' },
  { value: 'supporter', label: 'Supporter', hint: 'I like what they’re building', icon: <PremiumIcons.Badge />, tone: 'navy' },
];

const TYPE_LABEL: Record<SupportType, string> = { founder: 'Founder', friend: 'Friend', supporter: 'Supporter' };

interface Summary {
  counts: Record<SupportType, number>;
  recent: { name: string; type: SupportType }[];
}

const doneKey = (id: string) => `rankbid_supported_${id}`;
const noopSubscribe = () => () => {};

function readSaved(id: string): string | null {
  try {
    return localStorage.getItem(doneKey(id));
  } catch {
    return null;
  }
}
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

function faviconFor(url: string): string | null {
  try {
    return logoUrl(new URL(url).hostname, 128);
  } catch {
    return null;
  }
}

export default function SupportVoteForm({ listing }: { listing: PublicListing }) {
  const [supportType, setSupportType] = useState<SupportType | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Name saved from an earlier visit (this browser already voted), or set after voting now.
  const savedName = useSyncExternalStore(noopSubscribe, () => readSaved(listing.id), () => null);
  const [justVotedName, setJustVotedName] = useState<string | null>(null);
  const doneName = justVotedName ?? savedName;
  const done = doneName ? { name: doneName } : null;
  const [votes, setVotes] = useState(listing.totalVotes);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [copied, setCopied] = useState(false);
  const shareUrl = supportUrl(listing.id);

  useEffect(() => {
    fetch(`/api/support-vote?listingId=${encodeURIComponent(listing.id)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => data && setSummary(data))
      .catch(() => {});
  }, [listing.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supportType) return setError('Choose how you support this maker');
    if (name.trim().length < 2) return setError('Please enter your name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError('Please enter a valid email address');
    if (TURNSTILE_SITE_KEY && !captchaToken) return setError('Please complete the "I am human" check');

    setSubmitting(true);
    try {
      const res = await fetch('/api/support-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, name, email, supportType, company, turnstileToken: captchaToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const first = name.trim().split(' ')[0];
        if (typeof data.totalVotes === 'number') setVotes(data.totalVotes);
        setSummary(prev => prev && {
          counts: { ...prev.counts, [supportType]: prev.counts[supportType] + 1 },
          recent: [{ name: first, type: supportType }, ...prev.recent].slice(0, 8),
        });
        try { localStorage.setItem(doneKey(listing.id), first); } catch {}
        setJustVotedName(first);
      } else if (data.alreadyVoted) {
        setError('This email has already voted for this product. Thank you!');
      } else if (res.status === 429 && data.retryAt) {
        const at = new Date(data.retryAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        setError(`Too many votes from your network right now. Please try again after ${at}.`);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
      // A token is single-use: get a fresh one for the next try.
      if (!res.ok) captcha.current?.reset();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const shareText = `I just voted for ${listing.title} on RankBid. Show some support too, it takes 10 seconds:`;
  const favicon = faviconFor(listing.url);
  const totalSupporters = summary ? summary.counts.founder + summary.counts.friend + summary.counts.supporter : 0;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-10 space-y-4 sm:space-y-5">
      {/* Product card */}
      <div style={delay(0)} className="slide-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white p-5 sm:p-7 shadow-lg">
        <div className="absolute -top-20 -right-16 w-64 h-64 bg-[#059669]/25 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
        <p className="relative text-xs font-bold uppercase tracking-[0.15em] text-white/60 mb-3">You’ve been invited to support</p>
        <div className="relative flex items-start gap-3 sm:gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden">
            {favicon ? <img src={favicon} alt={`${listing.title} logo`} className="w-9 h-9 sm:w-10 sm:h-10 object-contain" /> : <PlatformIcon platform={listing.platform} size={32} />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-3xl font-black leading-tight break-words">{listing.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs font-semibold bg-white/15 px-2 py-0.5 rounded-full">{getCategoryLabel(listing.category)}</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 px-2 py-0.5 rounded-full ">
                <PlatformIcon platform={listing.platform} size={12} /> {listing.platform === 'twitter' || listing.platform === 'x' ? 'X' : PLATFORM_LABELS[normalizePlatform(listing.platform)]}
              </span>
            </div>
          </div>
          <div className="text-center flex-shrink-0">
            <p className="text-2xl sm:text-4xl font-black leading-none">{votes}</p>
            <p className="text-[11px] sm:text-xs text-white/60 font-semibold mt-1">{votes === 1 ? 'vote' : 'votes'}</p>
          </div>
        </div>
        {listing.description && (
          <p className="relative text-xs sm:text-sm text-white/75 leading-relaxed mt-4 line-clamp-3">{listing.description}</p>
        )}
        {listing.url && (
          <a href={safeExternalUrl(listing.url) ?? '#'} target="_blank" rel="noopener noreferrer" className="relative inline-flex items-center gap-1 mt-3 text-xs sm:text-sm font-bold text-white/90 hover:text-white underline underline-offset-2">
            Visit {listing.platform === 'website' ? 'website' : 'profile'} ↗
          </a>
        )}
      </div>

      {/* Vote form or thank-you */}
      <div style={delay(120)} className="slide-up bg-white border border-gray-200 shadow-sm rounded-2xl p-5 sm:p-7">
        {done ? (
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#059669]/10 text-[#059669] flex items-center justify-center">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#1F2937] mb-1">Thank you, {done.name}!</h2>
            <p className="text-sm text-[#1F2937]/65 mb-5">Your vote for {listing.title} has been counted. Share it so more people can help.</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2.5 rounded-xl bg-[#25D366] text-white text-xs sm:text-sm font-black hover:opacity-90 transition">WhatsApp</a>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2.5 rounded-xl bg-black text-white text-xs sm:text-sm font-black hover:opacity-90 transition">Post on X</a>
              <a href={linkedInShareUrl(shareText, shareUrl)} target="_blank" rel="noopener noreferrer" className="px-3 py-2.5 rounded-xl bg-[#0A66C2] text-white text-xs sm:text-sm font-black hover:opacity-90 transition">LinkedIn</a>
              <button onClick={copyLink} className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-[#0F3460] text-xs sm:text-sm font-black hover:border-[#0F3460]/40 transition">{copied ? 'Copied!' : 'Copy link'}</button>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
              <div>
                <p className="text-sm font-black text-[#1F2937]">Building something too?</p>
                <p className="text-xs text-[#1F2937]/70">Launch it on RankBid for free and get your own support link.</p>
              </div>
              <Link href="/signup" className="px-4 py-2 rounded-lg bg-[#0F3460] text-white text-xs sm:text-sm font-black hover:bg-[#0D2A50] transition flex-shrink-0">Launch for free</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 className="text-lg sm:text-xl font-black text-[#1F2937] mb-1">Cast your vote</h2>
            <p className="text-xs sm:text-sm text-[#1F2937]/70 mb-4 sm:mb-5">No account needed. Takes about 10 seconds.</p>

            <p className="text-xs font-bold text-[#1F2937] mb-2">I’m supporting as a…</p>
            <div role="radiogroup" aria-label="Support type" className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-5">
              {OPTIONS.map(opt => {
                const active = supportType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSupportType(opt.value)}
                    className={`flex sm:flex-col items-center sm:items-start gap-3 p-3 sm:p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                      active ? 'border-[#0F3460] bg-[#0F3460]/5 shadow-md' : 'border-gray-200 hover:border-[#0F3460]/40 hover:bg-gray-50'
                    }`}
                  >
                    <IconTile tone={opt.tone} size="sm">{opt.icon}</IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#1F2937]">{opt.label}</p>
                      <p className="text-xs text-[#1F2937]/70">{opt.hint}</p>
                    </div>
                    <span className={`sm:hidden w-4 h-4 rounded-full border-2 flex-shrink-0 ${active ? 'border-[#0F3460] bg-[#0F3460]' : 'border-gray-300'}`} />
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="block text-xs font-bold text-[#1F2937] mb-1.5">Your name</span>
                <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={60} placeholder="John Smith"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F3460]/30 focus:border-[#0F3460]" />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-[#1F2937] mb-1.5">Your email</span>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" maxLength={254} placeholder="john@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F3460]/30 focus:border-[#0F3460]" />
              </label>
            </div>

            {/* Honeypot: hidden from people, filled by bots */}
            <input value={company} onChange={e => setCompany(e.target.value)} name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

            <Turnstile ref={captcha} onToken={setCaptchaToken} />

            {error && <p className="text-xs sm:text-sm font-semibold text-red-600 mb-3" role="alert">{error}</p>}

            <button type="submit" disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-[#059669] to-[#10B981] text-white font-black text-sm sm:text-base shadow-lg shadow-[#059669]/25 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 transition-all disabled:opacity-60 disabled:pointer-events-none">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-8.5-4.8-8.5-11A4.5 4.5 0 0112 7a4.5 4.5 0 018.5 2.5c0 6.2-8.5 11-8.5 11z" /></svg>
              {submitting ? 'Recording your vote…' : `Vote for ${listing.title}`}
            </button>
            <p className="text-[11px] text-[#1F2937]/70 text-center mt-3">
              We only use your email to make sure each person votes once. It’s never shown publicly. See our <Link href="/tos" className="underline">terms</Link>.
            </p>
          </form>
        )}
      </div>

      {/* Supporter breakdown */}
      {summary && totalSupporters > 0 && (
        <div style={delay(240)} className="slide-up bg-white border border-gray-200 shadow-sm rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm sm:text-base font-black text-[#1F2937] mb-3">{totalSupporters} {totalSupporters === 1 ? 'person has' : 'people have'} shown support</h2>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {OPTIONS.map(opt => (
              <div key={opt.value} className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-lg sm:text-2xl font-black text-[#0F3460]">{summary.counts[opt.value]}</p>
                <p className="text-[11px] sm:text-xs font-semibold text-[#1F2937]/70">{opt.label}{summary.counts[opt.value] === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>
          {summary.recent.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {summary.recent.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0F3460]/5 text-[#0F3460]">
                  {r.name} <span className="text-[#1F2937]/40">· {TYPE_LABEL[r.type]}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
