'use client';

import { useState, type ReactNode } from 'react';
import CategoryField, { categoryChoice, categoryChoiceError, categoryPayload, type CategoryChoice } from '@/components/CategoryField';
import { PLATFORM_LABELS, detectPlatform, normalizePlatform, platformExample, platformUrlProblem, type SubmitPlatform } from '@/lib/platform-url';

const PLATFORMS: { id: SubmitPlatform; label: string; icon: string }[] = [
  { id: 'website', label: 'Website', icon: '/web.png' },
  { id: 'twitter', label: 'Twitter/X', icon: '/twitter.png' },
  { id: 'linkedin', label: 'LinkedIn', icon: '/linkedin.png' },
  { id: 'facebook', label: 'Facebook', icon: '/facebook.png' },
  { id: 'instagram', label: 'Instagram', icon: '/instagram.png' },
  { id: 'tiktok', label: 'TikTok', icon: '/tiktok.png' },
];

export interface SubmittedProduct {
  id: string;
  displayHandle?: string | null;
}

/**
 * The product submit form: platform tabs, link and category. The link is checked against the
 * picked tab as you go (an Instagram tab needs an Instagram link, the Website tab a normal site),
 * and the server checks it again. The caller must make sure someone is signed in.
 */
export default function SubmitProductForm({
  platform,
  onPlatformChange,
  initialCategory = '',
  onSubmitted,
  onError,
  beforeSubmit,
  submitLabel = 'Submit Product',
}: {
  platform: string;
  onPlatformChange: (platform: SubmitPlatform) => void;
  initialCategory?: string;
  onSubmitted: (product: SubmittedProduct) => void | Promise<void>;
  onError: (message: string) => void;
  /** Rendered between the fields and the submit button. */
  beforeSubmit?: ReactNode;
  submitLabel?: ReactNode;
}) {
  const picked = normalizePlatform(platform);
  const [link, setLink] = useState('');
  const [category, setCategory] = useState<CategoryChoice>(() => categoryChoice(initialCategory));
  // Link errors show once the field was left or the form was sent, then update as you type.
  const [linkTouched, setLinkTouched] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const linkError = linkTouched ? platformUrlProblem(picked, link) : null;
  const categoryError = categoryTouched ? categoryChoiceError(category) : null;
  // When the link belongs to another tab, offer to switch to it.
  const belongsTo = linkError && link.trim() ? detectPlatform(link) : null;
  const switchTo = belongsTo && belongsTo !== picked ? belongsTo : null;

  const choosePlatform = (next: SubmitPlatform) => {
    onPlatformChange(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkTouched(true);
    setCategoryTouched(true);
    const problem = platformUrlProblem(picked, link) ?? categoryChoiceError(category);
    if (problem) {
      onError(problem);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/listings/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: picked === 'website' ? link.trim() : undefined,
          handle: picked !== 'website' ? link.trim() : undefined,
          platform: picked,
          ...categoryPayload(category),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setLink('');
      setLinkTouched(false);
      setCategory(categoryChoice(initialCategory));
      setCategoryTouched(false);
      await onSubmitted({ id: data.id, displayHandle: data.displayHandle });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const field = 'w-full px-3 sm:px-4 py-2 sm:py-3 bg-white text-[#1F2937] border font-semibold text-xs sm:text-sm rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F3460]/30 focus:border-[#0F3460] transition-all duration-200';

  return (
    <div>
      {/* Platform tabs */}
      <div className="flex flex-wrap gap-2 mb-4 md:mb-6" role="radiogroup" aria-label="Platform">
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={picked === p.id}
            onClick={() => choosePlatform(p.id)}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 font-bold text-xs rounded-lg transition-all duration-200 hover:scale-105 flex items-center gap-1 sm:gap-2 ${
              picked === p.id
                ? 'bg-[#0F3460] text-white border border-[#0F3460] shadow-sm'
                : 'bg-white text-[#1F2937] border border-gray-300 hover:border-[#0F3460]/40 hover:bg-[#0F3460]/5'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.icon} alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
            <span className="hidden sm:inline">{p.label}</span>
            <span className="sm:hidden">{p.label.split('/')[0]}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-start">
          <div>
            <input
              type="text"
              inputMode="url"
              name="url"
              aria-label={picked === 'website' ? 'Product URL' : `${PLATFORM_LABELS[picked]} profile URL`}
              aria-invalid={!!linkError || undefined}
              placeholder={picked === 'website' ? 'Product URL' : `${PLATFORM_LABELS[picked]} profile URL`}
              value={link}
              onChange={e => setLink(e.target.value)}
              onBlur={() => link.trim() && setLinkTouched(true)}
              className={`${field} ${linkError ? 'border-red-500' : 'border-gray-300'}`}
            />
            {linkError ? (
              <p className="text-xs text-red-600 font-bold mt-1 slide-in">
                {linkError}
                {switchTo && (
                  <>
                    {' '}
                    <button type="button" onClick={() => choosePlatform(switchTo)} className="underline underline-offset-2 hover:text-red-800">
                      Switch to {PLATFORM_LABELS[switchTo]}
                    </button>
                  </>
                )}
              </p>
            ) : (
              picked !== 'website' && (
                <p className="text-xs text-[#1F2937]/70 font-semibold mt-1">e.g., {platformExample(picked)}</p>
              )
            )}
          </div>

          <div>
            <CategoryField
              value={category}
              onChange={next => setCategory(next)}
              invalid={!!categoryError}
            />
            {categoryError && <p className="text-xs text-red-600 font-bold mt-1 slide-in">{categoryError}</p>}
            {category.category === 'Other' && category.addCustom && !categoryError && (
              <p className="text-xs text-[#1F2937]/70 font-semibold mt-1">It&apos;s saved, so others can pick it too.</p>
            )}
          </div>
        </div>

        {beforeSubmit}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-[#0F3460] to-[#1a5490] text-white font-black text-sm rounded-xl shadow-lg shadow-[#0F3460]/20 hover:shadow-xl active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block animate-spin">⏳</span> Submitting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {submitLabel}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
