'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { PremiumIcons } from '@/components/PremiumIcons';
import { SUPPORT_EMAIL } from '@/lib/site';

/** What /api/premium-listings/status returns for this payment. */
interface BidStatus {
  status: string;
  /** Current rank by price (null if unknown). */
  position: number | null;
  bidUsd: number;
  expiresAt: string | null;
  productTitle: string | null;
  reference: string | null;
}

// The webhook usually lands within seconds; after this we stop polling and say so.
const POLL_MS = 2000;
const GIVE_UP_MS = 90_000;

const usd = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function PaymentSuccessPage() {
  // useSearchParams needs a Suspense boundary so the rest of the page can be prerendered.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F6F7FB]" />}>
      <PaymentSuccess />
    </Suspense>
  );
}

function PaymentSuccess() {
  const searchParams = useSearchParams();
  const premiumId = searchParams.get('listing_id');
  const sessionRef = searchParams.get('txn_ref');

  const [bid, setBid] = useState<BidStatus | null>(null);
  const [loadError, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const error = premiumId ? loadError : 'This link is missing the payment details.';

  // The listing is activated only by the Stripe webhook; this page just watches for it.
  useEffect(() => {
    if (!premiumId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const res = await fetch(`/api/premium-listings/status?id=${encodeURIComponent(premiumId)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (stopped) return;
        if (!res.ok) {
          setError(data.error || 'We could not load this payment.');
          return;
        }
        setBid(data);
        if (data.status !== 'pending') return;
      } catch {
        // Network hiccup: keep trying until the time limit.
      }
      if (Date.now() - startedAt > GIVE_UP_MS) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(poll, POLL_MS);
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [premiumId]);

  const status = bid?.status;
  const confirming = !error && (!bid || status === 'pending') && !timedOut;

  return (
    <>
      <Header />
      <div className="relative min-h-screen bg-[#F6F7FB] flex items-center justify-center px-4 py-10 sm:py-16 overflow-hidden">
        {/* Soft navy and amber glow behind the card */}
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(15,52,96,0.16),transparent)]" />
        <div aria-hidden className="pointer-events-none absolute top-24 right-[-120px] w-[360px] h-[360px] rounded-full bg-[radial-gradient(closest-side,rgba(245,158,11,0.14),transparent)]" />
        <div className="relative max-w-xl w-full slide-up">
          {confirming ? (
            <Confirming />
          ) : error ? (
            <Outcome tone="red" title="We couldn't load this payment" lead={error}>
              If you were charged, email <a className="font-bold text-[#0F3460] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              {sessionRef ? <> and quote <span className="font-mono break-all">{sessionRef}</span></> : null}.
            </Outcome>
          ) : status === 'pending' ? (
            <Outcome tone="amber" title="Still confirming your payment" lead="Stripe hasn't confirmed it yet. This can take a few minutes for some payment methods.">
              You don&apos;t need to stay on this page. We&apos;ll email you as soon as your sponsored listing is live.
            </Outcome>
          ) : status === 'active' ? (
            <Live bid={bid!} />
          ) : status === 'needs_refund' ? (
            <Outcome tone="amber" title="Your listing could not start" lead={`Your ${usd(bid!.bidUsd)} payment couldn't be used for a sponsored listing.`}>
              Your payment will be refunded in full to your card. You can bid again any time from your listings.
            </Outcome>
          ) : status === 'failed' ? (
            <Outcome tone="red" title="Payment didn't go through" lead="Stripe reported that this payment failed or the checkout expired. You have not been charged.">
              You can try again from your listings.
            </Outcome>
          ) : status === 'outbid' || status === 'replaced' ? (
            <Outcome tone="navy" title="Payment confirmed" lead={status === 'outbid' ? 'Your bid went live, but it is no longer active.' : 'Your bid went live, and this product has since been sponsored again with a new bid.'}>
              Check your listings to see where you stand, or raise your bid.
            </Outcome>
          ) : (
            <Outcome tone="red" title="This payment was refunded" lead="This sponsored listing was removed and the payment refunded.">
              Questions? Email <a className="font-bold text-[#0F3460] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </Outcome>
          )}
        </div>
      </div>
    </>
  );
}

const card = 'bg-white rounded-[28px] shadow-[0_30px_80px_-30px_rgba(15,52,96,0.45)] ring-1 ring-[#0F3460]/10 overflow-hidden';

/** Navy band with a faint dot grid, shared by every state. */
function Hero({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative bg-gradient-to-br from-[#0A2342] via-[#0F3460] to-[#1a5490] text-white px-6 sm:px-10 pt-8 sm:pt-10 pb-10 sm:pb-12 overflow-hidden">
      <div aria-hidden className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div aria-hidden className="absolute -right-20 -top-24 w-72 h-72 rounded-full bg-amber-400/25 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Ticket-style tear line between the hero and the body. */
function TearLine() {
  return (
    <div aria-hidden className="relative h-0">
      <div className="absolute -left-4 -top-4 w-8 h-8 rounded-full bg-[#F6F7FB]" />
      <div className="absolute -right-4 -top-4 w-8 h-8 rounded-full bg-[#F6F7FB]" />
      <div className="absolute left-6 right-6 top-0 border-t-2 border-dashed border-[#0F3460]/15" />
    </div>
  );
}

function Check({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Confirming() {
  return (
    <div className={card} role="status" aria-live="polite">
      <Hero>
        <div className="flex flex-col items-center text-center py-4">
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-white/15" />
            <div className="absolute inset-0 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">Confirming your payment…</h1>
          <p className="text-sm sm:text-base text-white/70 max-w-sm">Your listing goes live as soon as Stripe confirms the payment. This usually takes a few seconds.</p>
        </div>
      </Hero>
    </div>
  );
}

const TONES = {
  red: { badge: 'bg-red-500/15 text-red-200 ring-red-300/30', label: 'Needs attention', icon: '!' },
  amber: { badge: 'bg-amber-400/15 text-amber-200 ring-amber-300/30', label: 'In progress', icon: '…' },
  navy: { badge: 'bg-white/10 text-white/80 ring-white/20', label: 'Update', icon: 'i' },
} as const;

function Outcome({ tone, title, lead, children }: { tone: keyof typeof TONES; title: string; lead: string; children?: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div className={card}>
      <Hero>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ring-1 ${t.badge}`}>
          <span className="w-4 h-4 rounded-full bg-current/20 grid place-items-center text-[10px] leading-none">{t.icon}</span>
          {t.label}
        </span>
        <h1 className="mt-5 text-2xl sm:text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 text-sm sm:text-base text-white/75">{lead}</p>
      </Hero>
      <TearLine />
      <div className="px-6 sm:px-10 pt-8 pb-8 space-y-8">
        {children && <p className="text-sm text-[#1F2937]/70 leading-relaxed">{children}</p>}
        <Actions />
      </div>
    </div>
  );
}

function Actions() {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Link
        href="/"
        className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-[#0F3460] to-[#1a5490] text-white text-sm font-black rounded-xl shadow-lg shadow-[#0F3460]/25 hover:-translate-y-0.5 active:translate-y-0 transition-all"
      >
        <PremiumIcons.Trophy className="w-4 h-4" />
        Back to leaderboard
      </Link>
      <Link
        href="/profile"
        className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white text-[#0F3460] text-sm font-black rounded-xl ring-1 ring-[#0F3460]/20 hover:bg-[#0F3460]/5 transition-all"
      >
        <PremiumIcons.Chart className="w-4 h-4" />
        View my listings
      </Link>
    </div>
  );
}

const PERKS = [
  { icon: PremiumIcons.Shield, text: 'Ranked by price. A higher bid moves you down, and we email you if you drop off the homepage top 10.' },
  { icon: PremiumIcons.Trophy, text: 'The homepage shows the top 10. Every sponsored listing is on the sponsored page.' },
  { icon: PremiumIcons.Calendar, text: 'One payment, no end date. Your sponsored listing stays live for life.' },
  { icon: PremiumIcons.Bolt, text: 'A receipt is on its way to your email. Payments for active listings are not refundable.' },
];

function Live({ bid }: { bid: BidStatus }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!bid.reference) return;
    navigator.clipboard?.writeText(bid.reference).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div className={card}>
      <Hero>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 ring-1 ring-emerald-300/30 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-200">
            <span className="w-4 h-4 rounded-full bg-emerald-400 text-[#0A2342] grid place-items-center"><Check className="w-2.5 h-2.5" /></span>
            Payment confirmed
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50">Sponsor pass</span>
        </div>

        <div className="mt-8 flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300/90">Now sponsored</p>
            <h1 className="mt-2 text-2xl sm:text-4xl font-black tracking-tight leading-tight break-words">
              {bid.productTitle || 'Your product'}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-white/70">is live on RankBid{bid.position && bid.position <= 10 ? ' and on the homepage' : ''}.</p>
          </div>
          {bid.position ? (
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50 mb-1">Rank</p>
              <p className="text-7xl sm:text-8xl font-black tracking-[-0.06em] leading-[0.85] tabular-nums bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent drop-shadow-[0_8px_24px_rgba(245,158,11,0.35)]">
                #{bid.position}
              </p>
            </div>
          ) : (
            <div className="shrink-0 w-20 h-20 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-[#0A2342] grid place-items-center shadow-[0_8px_30px_rgba(245,158,11,0.45)]">
              <Check className="w-10 h-10" />
            </div>
          )}
        </div>
      </Hero>

      <TearLine />

      <div className="px-6 sm:px-10 pt-8 pb-8 space-y-8">
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Paid"><span className="text-emerald-600">{usd(bid.bidUsd)}</span></Stat>
          <Stat label={bid.expiresAt ? 'Runs until' : 'Duration'}>{bid.expiresAt ? day(bid.expiresAt) : 'Lifetime'}</Stat>
          <Stat label="Status">
            <span className="inline-flex items-center gap-1.5 text-emerald-600">
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
                <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          </Stat>
        </dl>

        {bid.reference && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F6F7FB] ring-1 ring-[#0F3460]/10 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1F2937]/45">Payment reference</p>
              <p className="mt-0.5 font-mono text-xs sm:text-sm text-[#1F2937] truncate">{bid.reference}</p>
            </div>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-black text-[#0F3460] ring-1 ring-[#0F3460]/20 hover:bg-white transition-colors"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        <div>
          <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1F2937]/45 mb-3">Good to know</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 rounded-xl ring-1 ring-[#0F3460]/10 p-3.5">
                <span className="shrink-0 w-8 h-8 rounded-lg bg-[#0F3460]/[0.07] text-[#0F3460] grid place-items-center">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-xs leading-relaxed text-[#1F2937]/75">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <Actions />
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#F6F7FB] ring-1 ring-[#0F3460]/10 px-3 py-3 sm:px-4">
      <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1F2937]/45">{label}</dt>
      <dd className="mt-1 text-sm sm:text-base font-black text-[#1F2937] leading-snug">{children}</dd>
    </div>
  );
}
