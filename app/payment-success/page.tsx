'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { IconTile, PremiumIcons } from '@/components/PremiumIcons';
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
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

export default function PaymentSuccessPage() {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12">
        <div className="max-w-2xl w-full slide-up">
          {confirming ? (
            <Confirming />
          ) : error ? (
            <Outcome tone="red" icon="⚠️" title="We couldn't load this payment" lead={error}>
              <p className="text-sm text-gray-600">
                If you were charged, email <a className="font-bold underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                {sessionRef ? <> and quote <span className="font-mono">{sessionRef}</span></> : null}.
              </p>
            </Outcome>
          ) : status === 'pending' ? (
            <Outcome tone="yellow" icon="⏳" title="Still confirming your payment" lead="Stripe hasn't confirmed it yet. This can take a few minutes for some payment methods.">
              <p className="text-sm text-gray-600">
                You don&apos;t need to stay on this page. We&apos;ll email you as soon as your sponsored listing is live.
              </p>
            </Outcome>
          ) : status === 'active' ? (
            <Live bid={bid!} />
          ) : status === 'needs_refund' ? (
            <Outcome tone="orange" icon="↩️" title="Your listing could not start" lead={`Your ${usd(bid!.bidUsd)} payment couldn't be used for a sponsored listing.`}>
              <p className="text-sm text-gray-600">Your payment will be refunded in full to your card. You can bid again any time from your listings.</p>
            </Outcome>
          ) : status === 'failed' ? (
            <Outcome tone="red" icon="✕" title="Payment didn't go through" lead="Stripe reported that this payment failed or the checkout expired. You have not been charged.">
              <p className="text-sm text-gray-600">You can try again from your listings.</p>
            </Outcome>
          ) : status === 'outbid' || status === 'replaced' ? (
            <Outcome tone="yellow" icon="🔁" title="Payment confirmed" lead={status === 'outbid' ? 'Your bid went live, but it is no longer active.' : 'Your bid went live, and this product has since been sponsored again with a new bid.'}>
              <p className="text-sm text-gray-600">Check your listings to see where you stand, or raise your bid.</p>
            </Outcome>
          ) : (
            <Outcome tone="red" icon="⚠️" title="This payment was refunded" lead="This sponsored listing was removed and the payment refunded.">
              <p className="text-sm text-gray-600">
                Questions? Email <a className="font-bold underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
            </Outcome>
          )}
        </div>
      </div>
    </>
  );
}

function Confirming() {
  return (
    <div className="bg-white shadow-xl rounded-2xl border border-gray-200 p-8 sm:p-12 text-center" role="status" aria-live="polite">
      <div className="w-12 h-12 mx-auto mb-5 rounded-full border-4 border-[#0F3460] border-t-transparent animate-spin" />
      <h1 className="text-xl sm:text-2xl font-black text-[#1F2937] mb-2">Confirming your payment…</h1>
      <p className="text-sm sm:text-base text-gray-600">Your listing goes live as soon as Stripe confirms the payment. This usually takes a few seconds.</p>
    </div>
  );
}

const TONES = {
  red: 'from-[#B91C1C] to-[#EF4444]',
  orange: 'from-[#C2410C] to-[#F97316]',
  yellow: 'from-[#A16207] to-[#EAB308]',
} as const;

function Outcome({ tone, icon, title, lead, children }: { tone: keyof typeof TONES; icon: string; title: string; lead: string; children?: React.ReactNode }) {
  return (
    <div className="bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden">
      <div className={`bg-gradient-to-br ${TONES[tone]} p-6 sm:p-8 text-center text-white`}>
        <div className="text-5xl mb-3" aria-hidden>{icon}</div>
        <h1 className="text-2xl sm:text-3xl font-black mb-2">{title}</h1>
        <p className="text-sm sm:text-base opacity-90">{lead}</p>
      </div>
      <div className="p-5 sm:p-8 space-y-6">
        {children}
        <Actions />
      </div>
    </div>
  );
}

function Actions() {
  return (
    <div className="flex flex-col gap-3 pt-6 border-t border-gray-200">
      <Link
        href="/"
        className="w-full px-6 py-4 bg-[#0F3460] text-white font-black rounded-lg hover:bg-[#0D2A50] active:scale-95 transition-all duration-200 text-center shadow-lg border-2 border-[#0F3460]"
      >
        🏠 Back to Leaderboard
      </Link>
      <Link
        href="/profile"
        className="w-full px-6 py-4 bg-white text-gray-900 font-black rounded-lg hover:bg-gray-100 active:scale-95 transition-all duration-200 text-center border-2 border-gray-400"
      >
        📊 View My Listings
      </Link>
    </div>
  );
}

function Live({ bid }: { bid: BidStatus }) {
  return (
    <div className="bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-br from-[#059669] to-[#10B981] p-6 sm:p-8 text-center text-white">
        <div className="text-5xl sm:text-6xl mb-4 animate-bounce">✅</div>
        <h1 className="text-2xl sm:text-4xl font-black mb-2">Payment confirmed</h1>
        <p className="text-sm sm:text-lg opacity-90">
          {bid.productTitle ? <strong>{bid.productTitle}</strong> : 'Your product'} is now sponsored{bid.position ? ` and ranked #${bid.position}` : ''}
        </p>
      </div>

      <div className="p-5 sm:p-8 space-y-6 sm:space-y-8">
        <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
          <h2 className="text-xl font-black text-gray-900 mb-4">📋 Details</h2>
          <div className="space-y-3">
            {bid.position && <Row label="Current rank"><span className="text-2xl font-black text-orange-600">#{bid.position}</span></Row>}
            <Row label="Amount paid"><span className="text-xl font-black text-green-600">{usd(bid.bidUsd)}</span></Row>
            {bid.expiresAt && <Row label="Runs until"><span className="font-bold text-gray-900">{day(bid.expiresAt)}</span></Row>}
            {bid.reference && <Row label="Payment reference"><span className="font-mono text-xs sm:text-sm bg-gray-100 px-3 py-1 rounded text-gray-900 break-all">{bid.reference}</span></Row>}
            <Row label="Status" last>
              <span className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold">
                <span className="w-2 h-2 bg-green-700 rounded-full" />
                Live
              </span>
            </Row>
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-6 border-2 border-yellow-300">
          <h3 className="font-black text-gray-900 mb-3">⚠️ Good to know</h3>
          <ul className="text-sm text-gray-700 space-y-3">
            <li className="flex items-start gap-2"><IconTile size="sm" tone="green"><PremiumIcons.Shield className="w-4 h-4" /></IconTile><span className="pt-1">Sponsored listings are ranked by price. A higher bid moves you down; we email you if you drop off the homepage top 10</span></li>
            <li className="flex items-start gap-2"><IconTile size="sm" tone="green"><PremiumIcons.Trophy className="w-4 h-4" /></IconTile><span className="pt-1">The homepage shows the top 10; every sponsored listing is on the sponsored page</span></li>
            <li className="flex items-start gap-2"><IconTile size="sm" tone="green"><PremiumIcons.Calendar className="w-4 h-4" /></IconTile><span className="pt-1">After 30 days the listing ends; your product stays on the free leaderboard</span></li>
            <li className="flex items-start gap-2"><IconTile size="sm" tone="green"><PremiumIcons.Bolt className="w-4 h-4" /></IconTile><span className="pt-1">A receipt is on its way to your email. Payments for active listings are not refundable</span></li>
          </ul>
        </div>

        <Actions />
      </div>
    </div>
  );
}

function Row({ label, last, children }: { label: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex justify-between items-center gap-4 py-2 ${last ? '' : 'border-b border-gray-300'}`}>
      <span className="font-bold text-gray-700">{label}:</span>
      {children}
    </div>
  );
}
