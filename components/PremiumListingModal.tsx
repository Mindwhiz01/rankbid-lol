'use client';

import { useEffect, useRef, useState } from 'react';
import PhoneField, { fullPhone } from '@/components/PhoneField';
import { bidForRank, HOME_SPONSORED, MAX_BID_USD, MAX_SOCIAL_LINKS, MIN_BID_USD, rankForBid } from '@/lib/premiumSpots';
import { PLATFORM_LABELS, normalizePlatform, platformExample, platformUrlProblem, type SubmitPlatform } from '@/lib/platform-url';
import CategoryField, { categoryChoice, categoryChoiceError, categoryPayload, type CategoryChoice } from '@/components/CategoryField';

interface PremiumListingModalProps {
  /** The product being boosted. Leave out to let the buyer pick one of theirs or add a new one. */
  listingId?: string;
  listingTitle?: string;
  /** The signed-in user's products, offered when no listingId is given. */
  ownListings?: { id: string; title: string; platform?: string; url?: string }[];
  /** Rank the suggested amount aims for when the modal opens (default: the lowest homepage rank). */
  targetRank?: number;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PremiumData) => Promise<void>;
  /** Category preselected for a new product (e.g. from an empty category page). */
  initialCategory?: string;
  /** 'page' renders the checkout inline (the /sponsor page) instead of as an overlay. */
  variant?: 'modal' | 'page';
}

export interface PremiumData {
  /** Existing product to boost; absent when newProduct is set. */
  listingId?: string;
  /** A product that is not listed yet: it is submitted first, then the bid goes to checkout. */
  newProduct?: { link: string; platform: SubmitPlatform; category: string; customCategory?: string };
  /** Whole USD charged; with a live spot it is added to that bid, and the rank follows from the total. */
  bidUsd: number;
  /** The product's current live bid (0 when none): the bid this payment raises. */
  raiseFromUsd?: number;
  founderName: string;
  founderEmail: string;
  founderPhone: string;
  founderWebsite?: string;
  founderTwitter?: string;
  founderLinkedin?: string;
  founderInstagram?: string;
  founderFacebook?: string;
  founderTiktok?: string;
  founderYoutube?: string;
  founderGithub?: string;
  paymentMethod: string;
}

// Link types a founder can pick for each social link row (all saved by the premium API).
const SOCIALS = [
  { name: 'founderWebsite', label: 'Website', placeholder: 'https://example.com', icon: '/web.png' },
  { name: 'founderTwitter', label: 'X / Twitter', placeholder: 'x.com/handle', icon: '/twitter.png' },
  { name: 'founderLinkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/…', icon: '/linkedin.png' },
  { name: 'founderInstagram', label: 'Instagram', placeholder: 'instagram.com/handle', icon: '/instagram.png' },
  { name: 'founderFacebook', label: 'Facebook', placeholder: 'facebook.com/…', icon: '/facebook.png' },
  { name: 'founderTiktok', label: 'TikTok', placeholder: 'tiktok.com/@handle', icon: '/tiktok.png' },
  { name: 'founderYoutube', label: 'YouTube', placeholder: 'youtube.com/@…', icon: '' },
  { name: 'founderGithub', label: 'GitHub', placeholder: 'github.com/…', icon: '' },
] as const;

type SocialField = (typeof SOCIALS)[number]['name'];

// The link row that would just repeat the sponsored product itself (an Instagram profile
// doesn't need an Instagram link under it), so it is left out of the social links.
const PLATFORM_FIELD: Record<SubmitPlatform, SocialField> = {
  website: 'founderWebsite',
  twitter: 'founderTwitter',
  linkedin: 'founderLinkedin',
  instagram: 'founderInstagram',
  facebook: 'founderFacebook',
  tiktok: 'founderTiktok',
};

/** The first link types other than the product's own, one row each. */
const defaultRows = (skip: SocialField | null): SocialField[] =>
  SOCIALS.map(s => s.name).filter(n => n !== skip).slice(0, MAX_SOCIAL_LINKS);

// YouTube and GitHub have no image in /public, so they get inline marks.
function SocialMark({ field, size = 'w-4 h-4' }: { field: SocialField; size?: string }) {
  const social = SOCIALS.find(s => s.name === field)!;
  if (social.icon) return <img src={social.icon} alt="" className={`${size} object-contain`} />;
  if (field === 'founderYoutube') {
    return (
      <svg viewBox="0 0 24 24" className={size} aria-hidden="true">
        <rect x="1.5" y="5" width="21" height="14" rx="4" fill="#FF0000" />
        <path d="M10 9v6l5.2-3z" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={size} fill="#181717" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

/** A live sponsored listing, as /api/premium-listings/ladder returns it (highest bid first). */
interface RankedListing {
  position: number;
  listingId: string;
  title: string | null;
  bidUsd: number;
}

/** Up to four social links can be saved, and all of them show at any rank. */
const MAX_LINKS = MAX_SOCIAL_LINKS;

const NEW_PRODUCT = 'new';
/** What the buyer typed, kept for the trip to Stripe so a cancelled checkout comes back filled in. */
const DRAFT_KEY = 'rankbid-sponsor-draft';

type SponsorDraft = { formData?: Record<string, string>; phoneCountry?: string; linkRows?: SocialField[]; bidInput?: string };

/** The saved draft, read once (and cleared) when the form mounts. Only rendered in the browser. */
function takeDraft(): SponsorDraft {
  try {
    if (typeof window === 'undefined') return {};
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    sessionStorage.removeItem(DRAFT_KEY);
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

export default function PremiumListingModal({
  listingId: fixedListingId,
  listingTitle,
  ownListings = [],
  targetRank,
  initialCategory = '',
  isOpen,
  onClose,
  onSubmit,
  variant = 'modal',
}: PremiumListingModalProps) {
  const asPage = variant === 'page';
  // Back from a cancelled Stripe checkout: start with what the buyer typed (saved in handleSubmit).
  const [draft] = useState(takeDraft);
  // Product picker (only without a fixed listingId): an own listing's id, or NEW_PRODUCT.
  const [productChoice, setProductChoice] = useState(NEW_PRODUCT);
  const [productUrl, setProductUrl] = useState('');
  // Platform tab for a new product, as on the homepage submit form (a profile can be just a handle).
  const [newPlatform, setNewPlatform] = useState<SubmitPlatform>('website');
  const [productCategory, setProductCategory] = useState<CategoryChoice>(() => categoryChoice(initialCategory));
  const [ranked, setRanked] = useState<RankedListing[]>([]);
  // What the buyer typed; empty means the suggested amount. The rank follows from it.
  const [bidInput, setBidInput] = useState(typeof draft.bidInput === 'string' ? draft.bidInput : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);

  // The Pay button sits far below the error banner; bring the error into view so it isn't missed.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  const picking = !fixedListingId;
  const isNewProduct = picking && productChoice === NEW_PRODUCT;
  const listingId = fixedListingId ?? (isNewProduct ? undefined : productChoice);
  const title = listingTitle ?? (isNewProduct ? 'New product' : ownListings.find(l => l.id === productChoice)?.title);
  const productPlatform = isNewProduct
    ? newPlatform
    : normalizePlatform(ownListings.find(l => l.id === listingId)?.platform);
  const ownField = productPlatform ? PLATFORM_FIELD[productPlatform] : null;
  const productLink = isNewProduct ? productUrl.trim() : ownListings.find(l => l.id === listingId)?.url;

  // Which link type each social row holds, in order. Values live in formData.
  const [linkRows, setLinkRows] = useState<SocialField[]>(() => (Array.isArray(draft.linkRows) ? draft.linkRows : defaultRows(ownField)));
  const [phoneCountry, setPhoneCountry] = useState(typeof draft.phoneCountry === 'string' ? draft.phoneCountry : 'US');
  const [formData, setFormData] = useState({
    founderName: '',
    founderEmail: '',
    founderPhone: '',
    founderWebsite: '',
    founderTwitter: '',
    founderLinkedin: '',
    founderInstagram: '',
    founderFacebook: '',
    founderTiktok: '',
    founderYoutube: '',
    founderGithub: '',
    ...draft.formData,
  });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/premium-listings/ladder', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled && Array.isArray(data?.ranked)) setRanked(data.ranked); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    if (isNewProduct) {
      const linkProblem = platformUrlProblem(newPlatform, productUrl);
      if (linkProblem) {
        setError(`❌ ${linkProblem}`);
        setLoading(false);
        return;
      }
      const categoryProblem = categoryChoiceError(productCategory);
      if (categoryProblem) {
        setError(`❌ ${categoryProblem}`);
        setLoading(false);
        return;
      }
    }

    // Validate required fields
    if (!formData.founderName.trim()) {
      setError('❌ Please enter founder name');
      setLoading(false);
      return;
    }
    if (!formData.founderEmail.trim()) {
      setError('❌ Please enter founder email');
      setLoading(false);
      return;
    }
    if (!formData.founderPhone.trim()) {
      setError('❌ Please enter founder phone');
      setLoading(false);
      return;
    }

    if (!validBid) {
      setError(`❌ Enter a whole-dollar amount from $${MIN_BID_USD} to $${maxAdd.toLocaleString('en-US')}`);
      setLoading(false);
      return;
    }

    // Only send the social link rows that are on screen.
    const shown = new Set<string>(visibleRows);
    const payload = { ...formData, founderPhone: fullPhone(phoneCountry, formData.founderPhone) };
    for (const s of SOCIALS) {
      if (!shown.has(s.name)) payload[s.name] = '';
    }

    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, phoneCountry, linkRows, bidInput }));
    } catch {}

    try {
      await onSubmit({
        ...(isNewProduct
          ? { newProduct: { link: productUrl.trim(), platform: newPlatform, ...categoryPayload(productCategory) } }
          : { listingId }),
        bidUsd: price,
        raiseFromUsd: raise,
        ...payload,
        paymentMethod: 'stripe',
      });

      console.log('✅ Premium listing submitted successfully');
      setSuccessMessage('✅ Taking you to Stripe to pay…');

      // On the page the browser is already on its way to Stripe; only the overlay resets and closes.
      if (asPage) return;
      // Reset form after brief delay
      setTimeout(() => {
        setFormData({
          founderName: '',
          founderEmail: '',
          founderPhone: '',
          founderWebsite: '',
          founderTwitter: '',
          founderLinkedin: '',
          founderInstagram: '',
          founderFacebook: '',
          founderTiktok: '',
          founderYoutube: '',
          founderGithub: '',
        });
        setBidInput('');
        setProductChoice(NEW_PRODUCT);
        setProductUrl('');
        setNewPlatform('website');
        setProductCategory(categoryChoice(initialCategory));
        setLinkRows(defaultRows(null));
        onClose();
      }, 1500);
    } catch (err) {
      console.error('❌ Premium submission error:', err);
      const errorMessage = (err instanceof Error && err.message) || 'Failed to submit premium listing request';
      setError(`❌ Error: ${errorMessage}`);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // A product that already holds a spot raises it: what the buyer pays is added to its current bid,
  // so it never competes with itself and keeps what it paid before.
  const current = ranked.find(r => r.listingId === listingId);
  const raise = current?.bidUsd ?? 0;
  const maxAdd = MAX_BID_USD - raise;
  const others = ranked.filter(r => r.listingId !== listingId);
  const otherBids = others.map(r => r.bidUsd);
  const lastRank = others.length + 1;
  // New spot: aim for the target rank. Raise: enough to climb one place (or the minimum at #1).
  const suggested = current
    ? Math.min(maxAdd, Math.max(MIN_BID_USD, bidForRank(Math.max(1, current.position - 1), otherBids) - raise))
    : bidForRank(Math.min(targetRank ?? HOME_SPONSORED, lastRank), otherBids);
  const bid = bidInput === '' ? suggested : Number(bidInput);
  const validBid = Number.isInteger(bid) && bid >= MIN_BID_USD && bid <= maxAdd;
  // price = what is paid now; total = the spot's bid after paying, which sets the rank.
  const price = validBid ? bid : suggested;
  const total = raise + price;
  const rank = rankForBid(total, otherBids);
  // The listing the bid lands just above (it currently holds that rank).
  const passes = others[rank - 1];
  const topBid = bidForRank(1, otherBids);

  // Each row picks its own platform; the product's own platform is never offered, so a row
  // holding it (the product link was typed after the rows were set) shows the next free one.
  const spare = SOCIALS.find(s => s.name !== ownField && !linkRows.includes(s.name))?.name;
  const rows = linkRows.flatMap(r => (r !== ownField ? [r] : spare ? [spare] : []));
  const visibleRows = rows.slice(0, MAX_LINKS);
  const unusedSocials = SOCIALS.filter(s => s.name !== ownField && !rows.includes(s.name));

  const changeRowPlatform = (index: number, next: SocialField) => {
    const prevField = rows[index];
    setLinkRows(rows.map((r, i) => (i === index ? next : r)));
    // Carry the typed link over to the newly picked platform.
    setFormData(prev => ({ ...prev, [next]: prev[prevField], [prevField]: '' }));
  };
  const removeRow = (index: number) => {
    const field = rows[index];
    setLinkRows(rows.filter((_, i) => i !== index));
    setFormData(prev => ({ ...prev, [field]: '' }));
  };
  const addRow = () => {
    if (unusedSocials[0]) setLinkRows([...rows, unusedSocials[0].name]);
  };

  const input = 'w-full px-4 py-3 text-sm bg-white text-[#1F2937] border border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F3460]/20 focus:border-[#0F3460] transition';
  const fieldLabel = 'block text-[13px] font-semibold text-[#1F2937]/70 mb-1.5';
  const sectionTitle = 'text-lg sm:text-xl font-black tracking-[-0.02em] text-[#0B2545] mb-4';
  const req = <span className="text-amber-500">*</span>;
  const where = rank <= HOME_SPONSORED ? 'Homepage' : 'Sponsored page';

  return (
    <div
      className={asPage ? 'w-full' : 'fixed inset-0 bg-[#0B2545]/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4'}
      onClick={asPage ? undefined : onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className={`relative bg-white rounded-[28px] w-full max-w-5xl mx-auto ${
          asPage ? 'border border-gray-200 shadow-sm' : 'shadow-2xl max-h-[94vh] overflow-y-auto slide-up'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={asPage ? 'Back' : 'Close'}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 w-10 h-10 rounded-full flex items-center justify-center text-[#1F2937]/70 hover:text-[#1F2937] hover:bg-gray-100 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        <div className="px-5 sm:px-10 lg:px-14 pt-8 sm:pt-12 pb-8 sm:pb-12">
          {/* Heading */}
          <div className="pr-10 mb-8 sm:mb-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-700">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9L12 2.5z" /></svg>
              Sponsor your product
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-[-0.04em] text-[#0B2545] leading-[1.05]">Checkout details</h2>
            <p className="mt-2 text-sm text-[#1F2937]/70">Please make sure the information below is correct before you pay.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8 lg:gap-12 items-start">
            {/* Left: the form */}
            <div className="space-y-9 min-w-0">
              {successMessage && <div className="bg-[#059669]/10 border border-[#059669]/30 text-[#047857] px-4 py-3 rounded-xl text-sm font-semibold">{successMessage}</div>}
              {error && <div ref={errorRef} role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>}

              {/* The product being sponsored, with its platform, so it's clear which one this is */}
              {!isNewProduct && listingId && productPlatform && (
                <section className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-[#F4F6FA] p-4">
                  <span className="w-14 h-14 flex-shrink-0 rounded-2xl bg-white border border-gray-200 flex items-center justify-center">
                    <SocialMark field={PLATFORM_FIELD[productPlatform]} size="w-8 h-8" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-[#1F2937]/70">Sponsoring</p>
                    <p className="text-lg font-black text-[#0B2545] truncate">{title}</p>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1F2937]/70 min-w-0">
                      <span className="flex-shrink-0">{PLATFORM_LABELS[productPlatform]}</span>
                      {productLink && <span className="truncate">· {productLink.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>}
                    </p>
                  </div>
                </section>
              )}

              {/* Product: an existing one of theirs, or a new URL to list first */}
              {picking && (
                <section>
                  <h3 className={sectionTitle}>Product details</h3>
                  {ownListings.length > 0 && (
                    <label className="block mb-4">
                      <span className={fieldLabel}>Product {req}</span>
                      <select aria-label="Product" value={productChoice} onChange={e => setProductChoice(e.target.value)} className={input}>
                        <option value={NEW_PRODUCT}>+ Add a new product</option>
                        {ownListings.map(l => (
                          <option key={l.id} value={l.id}>{l.title}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {isNewProduct && (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_13rem] gap-4">
                      {/* Platform tabs, same as the homepage submit form */}
                      <div className="sm:col-span-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Platform">
                        {(Object.keys(PLATFORM_FIELD) as SubmitPlatform[]).map(p => (
                          <button
                            key={p}
                            type="button"
                            role="radio"
                            aria-checked={newPlatform === p}
                            onClick={() => setNewPlatform(p)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${
                              newPlatform === p ? 'bg-[#0F3460] border-[#0F3460] text-white' : 'bg-white border-gray-200 text-[#1F2937] hover:border-[#0F3460]/40'
                            }`}
                          >
                            <SocialMark field={PLATFORM_FIELD[p]} />
                            {PLATFORM_LABELS[p]}
                          </button>
                        ))}
                      </div>
                      <label className="block">
                        <span className={fieldLabel}>{newPlatform === 'website' ? 'Product URL' : `${PLATFORM_LABELS[newPlatform]} profile link or username`} {req}</span>
                        <input
                          type="text"
                          inputMode="url"
                          value={productUrl}
                          onChange={e => setProductUrl(e.target.value)}
                          placeholder={platformExample(newPlatform)}
                          className={input}
                        />
                        {productUrl.trim() && platformUrlProblem(newPlatform, productUrl) && (
                          <span className="block mt-1 text-xs font-bold text-red-600">{platformUrlProblem(newPlatform, productUrl)}</span>
                        )}
                      </label>
                      <div className="block">
                        <span className={fieldLabel}>Category {req}</span>
                        <CategoryField value={productCategory} onChange={setProductCategory} />
                      </div>
                      <p className="sm:col-span-2 text-xs text-[#1F2937]/70 -mt-1">
                        It is listed on RankBid first (free, same checks as a normal submission), then you pay to sponsor it.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* Amount: the buyer pays what they like, the rank follows */}
              <section>
                <h3 className={sectionTitle}>{current ? 'Amount to add' : 'Your amount'} {req}</h3>
                {current && (
                  <p className="-mt-2 mb-3 text-sm text-[#1F2937]/70">
                    This product is <strong className="text-[#0B2545]">#{current.position}</strong> with a <strong className="text-[#0B2545]">${current.bidUsd}</strong> bid. What you pay now is added to it: you keep your spot and pay only the difference.
                  </p>
                )}
                <label className="block">
                  <span className="relative block">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-[#1F2937]/70">$</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label={current ? 'Amount to add in USD' : 'Amount in USD'}
                      min={MIN_BID_USD}
                      max={maxAdd}
                      step="1"
                      value={bidInput}
                      onChange={e => setBidInput(e.target.value)}
                      placeholder={String(suggested)}
                      className={input + ' pl-9 text-lg font-bold'}
                    />
                  </span>
                </label>
                {validBid ? (
                  <p className="mt-1.5 text-xs text-[#1F2937]/70">
                    Whole dollars, from ${MIN_BID_USD}. {rank > 1 && (current ? `The top spot (#1) needs $${Math.max(MIN_BID_USD, topBid - raise)} more.` : `The top spot (#1) needs $${topBid}.`)}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs font-bold text-red-600">Enter a whole-dollar amount from ${MIN_BID_USD} to ${maxAdd.toLocaleString('en-US')}.</p>
                )}

                <div className="mt-4 flex items-center gap-4 sm:gap-5 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
                  <span className="text-5xl sm:text-6xl font-black tracking-[-0.05em] leading-none text-amber-700 tabular-nums">#{rank}</span>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-xl font-black text-[#0B2545]">
                      ${total} <span className="text-sm font-semibold text-[#1F2937]/70">· {current ? `$${raise} + $${price} added, ` : ''}{where === 'Homepage' ? 'lifetime on the Sponsored page, on the homepage while in the top 10' : 'lifetime on the Sponsored page'}</span>
                    </p>
                    <p className="text-xs text-[#1F2937]/70 mt-0.5">
                      {passes
                        ? `Above ${passes.title ?? 'another product'} ($${passes.bidUsd}), which moves down one place.`
                        : rank === 1 ? 'Nobody is sponsored yet: you take the top place.' : 'You take the next place after the current listings.'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#1F2937]/70 mt-2">
                  One payment, no end date. Listings are ranked by price: someone paying more later moves you down; equal amounts keep whoever paid first ahead.
                </p>
              </section>

              {/* Founder */}
              <section>
                <h3 className={sectionTitle}>Founder details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className={fieldLabel}>Name {req}</span>
                    <input type="text" name="founderName" value={formData.founderName} onChange={handleChange} required autoComplete="name" className={input} placeholder="John Smith" />
                  </label>
                  <label className="block">
                    <span className={fieldLabel}>Phone {req}</span>
                    <PhoneField
                      country={phoneCountry}
                      onCountryChange={setPhoneCountry}
                      value={formData.founderPhone}
                      onChange={v => setFormData(prev => ({ ...prev, founderPhone: v }))}
                      required
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={fieldLabel}>Email {req}</span>
                    <input type="email" name="founderEmail" value={formData.founderEmail} onChange={handleChange} required autoComplete="email" className={input} placeholder="john@example.com" />
                  </label>
                </div>
              </section>

              {/* Socials */}
              <section>
                <div className="flex items-baseline justify-between gap-3 mb-4">
                  <h3 className={sectionTitle + ' mb-0'}>Social links</h3>
                  <span className="text-xs font-semibold text-[#1F2937]/70">Shown on your listing · {visibleRows.length}/{MAX_LINKS}</span>
                </div>

                <div className="space-y-3">
                  {visibleRows.map((field, index) => {
                    const social = SOCIALS.find(s => s.name === field)!;
                    return (
                      <div
                        key={field}
                        className="flex items-stretch rounded-xl border border-gray-200 bg-white focus-within:border-[#0F3460] focus-within:ring-2 focus-within:ring-[#0F3460]/20 transition"
                      >
                        {/* Platform picker */}
                        <label className="relative flex items-center gap-2 pl-4 pr-8 border-r border-gray-200 bg-[#F4F6FA] rounded-l-xl cursor-pointer flex-shrink-0">
                          <SocialMark field={field} />
                          <span className="text-xs font-bold text-[#1F2937] whitespace-nowrap">{social.label}</span>
                          <svg className="absolute right-2.5 w-3.5 h-3.5 text-[#1F2937]/70 pointer-events-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z" clipRule="evenodd" />
                          </svg>
                          <select
                            aria-label={`Platform for link ${index + 1}`}
                            value={field}
                            onChange={e => changeRowPlatform(index, e.target.value as SocialField)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          >
                            {SOCIALS.filter(s => s.name === field || (s.name !== ownField && !rows.includes(s.name))).map(s => (
                              <option key={s.name} value={s.name}>{s.label}</option>
                            ))}
                          </select>
                        </label>

                        <input
                          type="text"
                          name={field}
                          aria-label={`${social.label} link`}
                          value={formData[field]}
                          onChange={handleChange}
                          placeholder={social.placeholder}
                          className="min-w-0 flex-1 px-4 py-3 text-sm text-[#1F2937] bg-transparent placeholder-gray-400 focus:outline-none"
                        />

                        {visibleRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            aria-label={`Remove ${social.label} link`}
                            className="px-3 text-[#1F2937]/35 hover:text-red-600 transition"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {visibleRows.length < MAX_LINKS && unusedSocials.length > 0 && (
                  <button
                    type="button"
                    onClick={addRow}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-3 text-sm font-bold text-[#0F3460] hover:border-[#0F3460] hover:bg-[#0F3460]/[0.03] transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    Add link
                  </button>
                )}
              </section>

              {/* Payment */}
              <section>
                <h3 className={sectionTitle}>Payment method</h3>
                <div className="rounded-2xl border border-[#0F3460]/30 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-4 bg-[#F4F6FA]">
                    <span className="w-5 h-5 rounded-full border-2 border-[#0F3460] flex items-center justify-center flex-shrink-0" aria-hidden>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0F3460]" />
                    </span>
                    <span className="text-sm font-bold text-[#1F2937]">Credit / Debit card</span>
                    <span className="ml-auto flex items-center gap-1.5" aria-label="Visa, Mastercard, American Express">
                      <span className="h-6 px-1.5 rounded-md bg-white border border-gray-200 flex items-center text-[10px] font-black italic text-[#1A1F71]">VISA</span>
                      <span className="h-6 w-9 rounded-md bg-white border border-gray-200 flex items-center justify-center" aria-hidden>
                        <span className="w-3 h-3 rounded-full bg-[#EB001B]" /><span className="w-3 h-3 -ml-1.5 rounded-full bg-[#F79E1B] mix-blend-multiply" />
                      </span>
                      <span className="h-6 px-1.5 rounded-md bg-[#2E77BC] flex items-center text-[9px] font-black text-white">AMEX</span>
                    </span>
                  </div>
                  <p className="px-4 py-3 text-xs text-[#1F2937]/70 border-t border-[#0F3460]/10">
                    You won&apos;t be charged yet. You&apos;ll be taken to Stripe to pay securely in USD; your listing goes live as soon as the payment is confirmed.
                  </p>
                </div>
              </section>
            </div>

            {/* Right: order summary */}
            <aside className={`lg:sticky ${asPage ? 'lg:top-32' : 'lg:top-0'} rounded-3xl bg-[#F4F6FA] border border-gray-200 p-6 sm:p-7`}>
              <h3 className={sectionTitle}>Order details</h3>
              <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl bg-white border border-amber-200 px-5 py-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#1F2937]/70">Sponsored rank</p>
                  <p className="text-sm font-bold text-[#1F2937]/70">{where}</p>
                  <p className="mt-1 text-xl font-black text-[#0B2545] tabular-nums">${total}{current && <span className="ml-1.5 text-xs font-semibold text-[#1F2937]/70">total bid</span>}</p>
                </div>
                <span className="text-6xl font-black tracking-[-0.05em] leading-none text-amber-700 tabular-nums">#{rank}</span>
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="font-bold text-[#1F2937]">Product</dt>
                  <dd className="flex items-center justify-end gap-1.5 font-semibold text-[#1F2937]/70 min-w-0 max-w-[65%]">
                    {productPlatform && <span className="flex-shrink-0" title={PLATFORM_LABELS[productPlatform]}><SocialMark field={PLATFORM_FIELD[productPlatform]} /></span>}
                    <span className="truncate">{title || '—'}</span>
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#1F2937]/70">Duration</dt>
                  <dd className="font-semibold text-[#1F2937]">Lifetime</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#1F2937]/70">Social links shown</dt>
                  <dd className="font-semibold text-[#1F2937]">{visibleRows.filter(f => formData[f].trim()).length}</dd>
                </div>
              </dl>

              <div className="my-5 border-t border-dashed border-gray-300" />
              {current && (
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-[#1F2937]/70">Current bid (already paid)</span>
                  <span className="font-semibold tabular-nums text-[#1F2937]/70">${raise}.00</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[#1F2937]/70">{current ? 'Added now' : 'Subtotal'}</span>
                <span className="font-semibold tabular-nums">${price}.00</span>
              </div>
              <div className="flex justify-between text-sm mt-3">
                <span className="text-[#1F2937]/70">Fees</span>
                <span className="font-semibold tabular-nums">$0.00</span>
              </div>
              <div className="my-5 border-t border-dashed border-gray-300" />
              <div className="flex items-end justify-between">
                <span className="font-bold text-[#1F2937]">Total amount</span>
                <span className="text-3xl font-black tracking-[-0.03em] text-[#0B2545] tabular-nums">${price}</span>
              </div>

              <button
                type="submit"
                disabled={loading || !validBid}
                className="mt-6 w-full px-5 py-3.5 bg-gradient-to-r from-[#0F3460] to-[#1a5490] text-white text-sm font-black rounded-xl shadow-lg shadow-[#0F3460]/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                {loading ? 'Processing…' : `Pay $${price} with Stripe`}
              </button>
              <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-sm font-bold text-[#1F2937]/70 hover:text-[#1F2937] transition">
                Cancel
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#1F2937]/70">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                Secure payment by Stripe
              </p>
            </aside>
          </div>
        </div>
      </form>
    </div>
  );
}
