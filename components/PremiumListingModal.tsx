'use client';

import { useEffect, useState } from 'react';
import { bidForRank, HOME_SPONSORED, MAX_SOCIAL_LINKS, rankForBid } from '@/lib/premiumSpots';
import { detectPlatform, normalizePlatform, type SubmitPlatform } from '@/lib/platform-url';
import CategoryField, { categoryChoice, categoryChoiceError, categoryPayload, type CategoryChoice } from '@/components/CategoryField';

interface PremiumListingModalProps {
  /** The product being boosted. Leave out to let the buyer pick one of theirs or add a new one. */
  listingId?: string;
  listingTitle?: string;
  /** The signed-in user's products, offered when no listingId is given. */
  ownListings?: { id: string; title: string; platform?: string }[];
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
  newProduct?: { url: string; category: string; customCategory?: string };
  /** Whole USD; the rank follows from it. */
  bidUsd: number;
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
function SocialMark({ field }: { field: SocialField }) {
  const social = SOCIALS.find(s => s.name === field)!;
  if (social.icon) return <img src={social.icon} alt="" className="w-4 h-4 object-contain" />;
  if (field === 'founderYoutube') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <rect x="1.5" y="5" width="21" height="14" rx="4" fill="#FF0000" />
        <path d="M10 9v6l5.2-3z" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#181717" aria-hidden="true">
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
  // Product picker (only without a fixed listingId): an own listing's id, or NEW_PRODUCT.
  const [productChoice, setProductChoice] = useState(NEW_PRODUCT);
  const [productUrl, setProductUrl] = useState('');
  const [productCategory, setProductCategory] = useState<CategoryChoice>(() => categoryChoice(initialCategory));
  const [ranked, setRanked] = useState<RankedListing[]>([]);
  // The rank the buyer picked; null means the suggested one. The price follows from it.
  const [rankInput, setRankInput] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const picking = !fixedListingId;
  const isNewProduct = picking && productChoice === NEW_PRODUCT;
  const listingId = fixedListingId ?? (isNewProduct ? undefined : productChoice);
  const title = listingTitle ?? (isNewProduct ? 'New product' : ownListings.find(l => l.id === productChoice)?.title);
  const productPlatform = isNewProduct
    ? detectPlatform(productUrl)
    : normalizePlatform(ownListings.find(l => l.id === listingId)?.platform);
  const ownField = productPlatform ? PLATFORM_FIELD[productPlatform] : null;

  // Which link type each social row holds, in order. Values live in formData.
  const [linkRows, setLinkRows] = useState<SocialField[]>(() => defaultRows(ownField));
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
      if (!productUrl.trim()) {
        setError('❌ Please enter your product URL');
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

    // Only send the social link rows that are on screen.
    const shown = new Set<string>(visibleRows);
    const payload = { ...formData };
    for (const s of SOCIALS) {
      if (!shown.has(s.name)) payload[s.name] = '';
    }

    try {
      console.log('🎯 Submitting premium listing:', {
        bidUsd: price,
        name: formData.founderName,
        email: formData.founderEmail,
        phone: formData.founderPhone,
      });

      await onSubmit({
        ...(isNewProduct
          ? { newProduct: { url: productUrl.trim(), ...categoryPayload(productCategory) } }
          : { listingId }),
        bidUsd: price,
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
        setRankInput(null);
        setProductChoice(NEW_PRODUCT);
        setProductUrl('');
        setProductCategory(categoryChoice(initialCategory));
        setLinkRows(defaultRows(null));
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('❌ Premium submission error:', err);
      const errorMessage = err.message || 'Failed to submit premium listing request';
      setError(`❌ Error: ${errorMessage}`);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Buying again for a product replaces its current listing, so it doesn't compete with itself.
  const current = ranked.find(r => r.listingId === listingId);
  const others = ranked.filter(r => r.listingId !== listingId);
  const otherBids = others.map(r => r.bidUsd);
  const lastRank = others.length + 1;
  const suggestedRank = Math.min(targetRank ?? HOME_SPONSORED, lastRank);
  const priceFor = (r: number) => bidForRank(Math.min(Math.max(r, 1), lastRank), otherBids);
  const price = priceFor(rankInput ?? suggestedRank);
  // Tied bids can make a rank's price land higher, so the rank is read back from the price.
  const rank = rankForBid(price, otherBids);
  // The listing the bid lands just above (it currently holds that rank).
  const passes = others[rank - 1];
  // Every homepage rank that is open, then the next free place on the sponsored page.
  const rankChoices = [
    ...new Set(
      [...Array.from({ length: Math.min(lastRank, HOME_SPONSORED) }, (_, i) => i + 1), suggestedRank, lastRank]
        .map(r => rankForBid(priceFor(r), otherBids)),
    ),
  ].sort((a, b) => a - b);

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
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 w-10 h-10 rounded-full flex items-center justify-center text-[#1F2937]/50 hover:text-[#1F2937] hover:bg-gray-100 transition"
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
            <p className="mt-2 text-sm text-[#1F2937]/60">Please make sure the information below is correct before you pay.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8 lg:gap-12 items-start">
            {/* Left: the form */}
            <div className="space-y-9 min-w-0">
              {successMessage && <div className="bg-[#059669]/10 border border-[#059669]/30 text-[#047857] px-4 py-3 rounded-xl text-sm font-semibold">{successMessage}</div>}
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold">{error}</div>}

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
                      <label className="block">
                        <span className={fieldLabel}>Product URL or profile link {req}</span>
                        <input type="text" inputMode="url" value={productUrl} onChange={e => setProductUrl(e.target.value)} placeholder="yourproduct.com" className={input} />
                      </label>
                      <div className="block">
                        <span className={fieldLabel}>Category {req}</span>
                        <CategoryField value={productCategory} onChange={setProductCategory} />
                      </div>
                      <p className="sm:col-span-2 text-xs text-[#1F2937]/55 -mt-1">
                        It is listed on RankBid first (free, same checks as a normal submission), then you pay to sponsor it.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* Rank: pick a place, the price follows */}
              <section>
                <h3 className={sectionTitle}>Sponsored rank {req}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                  {rankChoices.map(r => {
                    const amount = priceFor(r);
                    const active = r === rank;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRankInput(r)}
                        aria-pressed={active}
                        aria-label={`Rank ${r} for $${amount}`}
                        className={`rounded-2xl border-2 px-2 py-3 text-center transition-all active:scale-[0.98] ${
                          active ? 'border-[#0F3460] bg-[#0F3460] text-white shadow-lg shadow-[#0F3460]/25' : 'border-gray-200 bg-white text-[#0B2545] hover:border-[#0F3460]/40'
                        }`}
                      >
                        <span className="block text-3xl font-black tracking-[-0.04em] leading-none tabular-nums">#{r}</span>
                        <span className={`block mt-1.5 text-base font-black tabular-nums ${active ? 'text-amber-300' : 'text-amber-600'}`}>${amount}</span>
                        <span className={`block mt-0.5 text-[10px] font-bold uppercase tracking-wider ${active ? 'text-white/60' : 'text-[#1F2937]/40'}`}>
                          {r <= HOME_SPONSORED ? 'Homepage' : 'Sponsored'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center gap-4 sm:gap-5 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
                  <span className="text-5xl sm:text-6xl font-black tracking-[-0.05em] leading-none text-amber-600 tabular-nums">#{rank}</span>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-xl font-black text-[#0B2545]">
                      ${price} <span className="text-sm font-semibold text-[#1F2937]/55">· 30 days on the {where.toLowerCase()}</span>
                    </p>
                    <p className="text-xs text-[#1F2937]/60 mt-0.5">
                      {passes
                        ? `Above ${passes.title ?? 'another product'} ($${passes.bidUsd}), which moves down one place.`
                        : rank === 1 ? 'Nobody is sponsored yet: you take the top place.' : 'You take the next place after the current listings.'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#1F2937]/55 mt-2">
                  Listings are ranked by price for 30 days. Someone paying more later moves you down; equal amounts keep whoever paid first ahead.
                </p>
                {current && (
                  <p className="text-xs font-bold text-amber-700 mt-1">
                    This product is #{current.position} at ${current.bidUsd}. Paying again replaces that listing with a new 30-day one.
                  </p>
                )}
              </section>

              {/* Founder */}
              <section>
                <h3 className={sectionTitle}>Founder details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className={fieldLabel}>Name {req}</span>
                    <input type="text" name="founderName" value={formData.founderName} onChange={handleChange} required className={input} placeholder="Your name" />
                  </label>
                  <label className="block">
                    <span className={fieldLabel}>Phone {req}</span>
                    <input type="tel" name="founderPhone" value={formData.founderPhone} onChange={handleChange} required className={input} placeholder="+92 300 1234567" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={fieldLabel}>Email {req}</span>
                    <input type="email" name="founderEmail" value={formData.founderEmail} onChange={handleChange} required className={input} placeholder="you@example.com" />
                  </label>
                </div>
              </section>

              {/* Socials */}
              <section>
                <div className="flex items-baseline justify-between gap-3 mb-4">
                  <h3 className={sectionTitle + ' mb-0'}>Social links</h3>
                  <span className="text-xs font-semibold text-[#1F2937]/45">Shown on your listing · {visibleRows.length}/{MAX_LINKS}</span>
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
                          <svg className="absolute right-2.5 w-3.5 h-3.5 text-[#1F2937]/45 pointer-events-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
                  <p className="px-4 py-3 text-xs text-[#1F2937]/60 border-t border-[#0F3460]/10">
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
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#1F2937]/50">Sponsored rank</p>
                  <p className="text-sm font-bold text-[#1F2937]/70">{where}</p>
                  <p className="mt-1 text-xl font-black text-[#0B2545] tabular-nums">${price}</p>
                </div>
                <span className="text-6xl font-black tracking-[-0.05em] leading-none text-amber-600 tabular-nums">#{rank}</span>
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="font-bold text-[#1F2937]">Product</dt>
                  <dd className="text-right font-semibold text-[#1F2937]/70 truncate max-w-[60%]">{title || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#1F2937]/70">Duration</dt>
                  <dd className="font-semibold text-[#1F2937]">30 days</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#1F2937]/70">Social links shown</dt>
                  <dd className="font-semibold text-[#1F2937]">{visibleRows.filter(f => formData[f].trim()).length}</dd>
                </div>
              </dl>

              <div className="my-5 border-t border-dashed border-gray-300" />
              <div className="flex justify-between text-sm">
                <span className="text-[#1F2937]/70">Subtotal</span>
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
                disabled={loading}
                className="mt-6 w-full px-5 py-3.5 bg-gradient-to-r from-[#0F3460] to-[#1a5490] text-white text-sm font-black rounded-xl shadow-lg shadow-[#0F3460]/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                {loading ? 'Processing…' : `Pay $${price} with Stripe`}
              </button>
              <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-sm font-bold text-[#1F2937]/55 hover:text-[#1F2937] transition">
                Cancel
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#1F2937]/45">
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
