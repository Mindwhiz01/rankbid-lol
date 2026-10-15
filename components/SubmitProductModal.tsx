'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import SubmitProductForm from '@/components/SubmitProductForm';
import { getCategoryLabel } from '@/lib/categories';
import { MIN_BID_USD } from '@/lib/premiumSpots';
import type { SubmitPlatform } from '@/lib/platform-url';

type Plan = 'free' | 'sponsored';

export interface SubmitModalOptions {
  /** Stored category value to preselect, e.g. "AIMedia". */
  category?: string | null;
  /** Platform tab to start on. */
  platform?: SubmitPlatform;
}

const OPEN_EVENT = 'rankbid:open-submit';

/** Opens the site-wide submit modal (mounted once by SubmitModalHost in the root layout). */
export function openSubmitModal(options: SubmitModalOptions = {}) {
  window.dispatchEvent(new CustomEvent<SubmitModalOptions>(OPEN_EVENT, { detail: options }));
}

/**
 * The one submit modal for the whole site. It opens from openSubmitModal() and from any link to
 * "/#submit" (data-category / data-platform preset it), so submit buttons never leave the page.
 * Free listings go live straight away; Sponsored lists the product the same way, then continues
 * to the sponsor checkout to pick a price.
 */
export function SubmitModalHost() {
  const [open, setOpen] = useState<SubmitModalOptions | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => setOpen((e as CustomEvent<SubmitModalOptions>).detail ?? {});
    // Capture phase, so this runs before Next's <Link> navigates (it skips prevented clicks).
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== '/' || url.hash !== '#submit') return;
      e.preventDefault();
      setOpen({
        category: link.dataset.category || url.searchParams.get('category'),
        platform: (link.dataset.platform as SubmitPlatform | undefined) || undefined,
      });
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return open ? <SubmitDialog category={open.category ?? ''} initialPlatform={open.platform} onClose={() => setOpen(null)} /> : null;
}

/** A button that opens the submit modal, preset to `category` / `platform`. */
export default function SubmitProductModal({ category, platform, label = 'Submit a product', className }: SubmitModalOptions & {
  label?: React.ReactNode;
  className?: string;
}) {
  return (
    <button type="button" onClick={() => openSubmitModal({ category, platform })} className={className}>{label}</button>
  );
}

function SubmitDialog({ category, initialPlatform = 'website', onClose }: { category: string; initialPlatform?: SubmitPlatform; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<Plan>('free');
  const [platform, setPlatform] = useState<SubmitPlatform>(initialPlatform);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ id: string; name: string } | null>(null);
  const categoryLabel = category ? getCategoryLabel(category) : '';

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => setSignedIn(r.ok))
      .catch(() => setSignedIn(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const next = encodeURIComponent(pathname || '/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0B2545]/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[94vh] overflow-y-auto bg-white rounded-3xl shadow-2xl slide-up text-left"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#1F2937]/50 hover:text-[#1F2937] hover:bg-gray-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 sm:p-8">
          <h2 id="submit-modal-title" className="pr-10 text-xl sm:text-2xl font-black text-[#0B2545]">
            {categoryLabel ? `Launch in ${categoryLabel}` : 'Submit your product'}
          </h2>
          <p className="mt-1 text-sm text-[#1F2937]/60">List it for free, or sponsor it to sit above the community rankings.</p>

          {done ? (
            <div className="mt-6 rounded-2xl bg-[#059669]/5 border border-[#059669]/25 p-5">
              <p className="font-black text-[#1F2937]">🎉 {done.name} is live!</p>
              <p className="mt-1 text-sm text-[#1F2937]/70">Community voting starts now. Share your page to collect votes.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/product/${done.id}`} className="px-4 py-2.5 rounded-xl bg-[#0F3460] text-white text-sm font-black hover:bg-[#0D2A50] transition-colors">
                  View your product
                </Link>
                <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-[#1F2937] hover:bg-gray-50 transition-colors">
                  Done
                </button>
              </div>
            </div>
          ) : signedIn === null ? (
            <p className="mt-6 text-sm text-[#1F2937]/50">Loading…</p>
          ) : !signedIn ? (
            <div className="mt-6 rounded-2xl bg-[#F4F6FA] p-5">
              <p className="font-bold text-[#1F2937]">Sign in to submit your product</p>
              <p className="mt-1 text-sm text-[#1F2937]/60">A free account lets you submit, vote and track your rank.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/signup?next=${next}`} className="px-4 py-2.5 rounded-xl bg-[#0F3460] text-white text-sm font-black hover:bg-[#0D2A50] transition-colors">
                  Create free account
                </Link>
                <Link href={`/login?next=${next}`} className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-[#1F2937] hover:bg-white transition-colors">
                  Sign in
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-5" role="radiogroup" aria-label="Listing type">
                {([
                  ['free', 'Free', 'Goes live now, ranked by community votes.'],
                  ['sponsored', 'Sponsored', `Pinned above the rankings. From $${MIN_BID_USD}.`],
                ] as const).map(([key, title, text]) => {
                  const on = plan === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPlan(key)}
                      className={`text-left rounded-2xl border-2 p-3 sm:p-4 transition-colors ${
                        on ? 'border-[#0F3460] bg-[#0F3460]/[0.04]' : 'border-gray-200 hover:border-[#0F3460]/30'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${on ? 'border-[#0F3460]' : 'border-gray-300'}`}>
                          {on && <span className="w-2 h-2 rounded-full bg-[#0F3460]" />}
                        </span>
                        <span className="font-black text-sm sm:text-base text-[#1F2937]">{title}</span>
                        {key === 'sponsored' && (
                          <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Paid</span>
                        )}
                      </span>
                      <span className="block mt-1.5 text-xs text-[#1F2937]/60">{text}</span>
                    </button>
                  );
                })}
              </div>

              <SubmitProductForm
                platform={platform}
                onPlatformChange={setPlatform}
                initialCategory={category}
                submitLabel={plan === 'free' ? 'Submit for free' : 'Continue to sponsor'}
                onError={setError}
                beforeSubmit={
                  <>
                    {plan === 'sponsored' && (
                      <p className="text-xs text-[#1F2937]/55">
                        Your product is listed first (free, same checks), then you choose your rank and pay on the next page.
                      </p>
                    )}
                    {error && <p role="alert" className="text-xs sm:text-sm font-bold text-red-600">{error}</p>}
                  </>
                }
                onSubmitted={({ id, displayHandle }) => {
                  setError('');
                  if (plan === 'sponsored') {
                    // The host lives in the layout, so the dialog would stay open over the checkout.
                    router.push(`/sponsor?listing=${encodeURIComponent(id)}`);
                    onClose();
                    return;
                  }
                  setDone({ id, name: displayHandle ? `@${displayHandle}` : 'Your product' });
                  router.refresh();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
