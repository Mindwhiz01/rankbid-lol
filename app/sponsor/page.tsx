'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import PremiumListingModal, { type PremiumData } from '@/components/PremiumListingModal';
import { startPremiumCheckout } from '@/lib/premiumCheckout';

type OwnListing = { id: string; title: string };

/**
 * Sponsor checkout as its own page. Every "Sponsor" / "Claim" / "Raise bid" button links here:
 * /sponsor?listing=<id> sponsors that product; /sponsor?rank=<n> aims the suggested price at rank n.
 * /sponsor?category=<value> preselects the category for a new product.
 */
export default function SponsorPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<SponsorShell><Loading /></SponsorShell>}>
        <SponsorCheckout />
      </Suspense>
    </>
  );
}

function SponsorShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#F4F6FA] px-3 sm:px-6 py-6 sm:py-10">{children}</main>;
}

function Loading() {
  return <div className="max-w-5xl mx-auto h-[70vh] rounded-[28px] bg-white border border-gray-200 animate-pulse" />;
}

function SponsorCheckout() {
  const router = useRouter();
  const params = useSearchParams();
  const listingParam = params.get('listing');
  const rankParam = Number(params.get('rank'));
  const [own, setOwn] = useState<OwnListing[] | null>(null);

  // Only signed-in makers can sponsor (the checkout API checks ownership too).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/submissions', { cache: 'no-store' })
      .then(async res => {
        if (cancelled) return;
        if (res.status === 401) {
          const here = `/sponsor${window.location.search}`;
          router.replace(`/login?next=${encodeURIComponent(here)}`);
          return;
        }
        const data = res.ok ? await res.json() : {};
        setOwn((data.listings || []).map((l: { id: string; title?: string; handle?: string; url?: string }) => ({
          id: l.id,
          title: l.title || (l.handle ? `@${l.handle}` : l.url || 'Untitled'),
        })));
      })
      .catch(() => { if (!cancelled) setOwn([]); });
    return () => { cancelled = true; };
  }, [router]);

  if (own === null) return <SponsorShell><Loading /></SponsorShell>;

  // A ?listing= that isn't one of theirs falls back to the product picker.
  const fixed = listingParam ? own.find(l => l.id === listingParam) : undefined;

  const handleSubmit = async ({ listingId, newProduct, ...bid }: PremiumData) => {
    let id = listingId ?? fixed?.id;
    if (newProduct) {
      const res = await fetch('/api/listings/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newProduct.url, category: newProduct.category, customCategory: newProduct.customCategory }),
      });
      const created = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(created.error || 'Could not list your product');
      id = created.id;
    }
    if (!id) throw new Error('Choose a product first');
    await startPremiumCheckout(id, { ...bid, paymentMethod: 'stripe' });
  };

  const back = () => (window.history.length > 1 ? router.back() : router.push('/'));

  return (
    <SponsorShell>
      <PremiumListingModal
        variant="page"
        isOpen
        listingId={fixed?.id}
        listingTitle={fixed?.title}
        ownListings={own}
        targetRank={Number.isInteger(rankParam) && rankParam > 0 ? rankParam : undefined}
        initialCategory={params.get('category') ?? ''}
        onClose={back}
        onSubmit={handleSubmit}
      />
    </SponsorShell>
  );
}
