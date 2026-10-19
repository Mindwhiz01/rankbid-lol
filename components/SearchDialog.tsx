'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CornerDownLeft, Search, TrendingUp, X } from 'lucide-react';
import { categoryPath, getCategoryLabel } from '@/lib/categories';

interface Listing {
  id: string;
  url: string;
  title: string;
  description: string;
  category: string;
  totalVotes: number;
}

const QUICK_CATEGORIES = ['AIMedia', 'Marketing', 'Productivity', 'Developer', 'Design', 'Agents'];
const MAX_RESULTS = 6;

// Listings are fetched once per page load, the first time the dialog opens.
let listingsCache: Promise<Listing[]> | null = null;
function loadListings(): Promise<Listing[]> {
  listingsCache ??= fetch('/api/listings/submit?limit=1000&sort=totalVotes')
    .then(r => (r.ok ? r.json() : { listings: [] }))
    .then(d => (d.listings || []) as Listing[])
    .catch(() => {
      listingsCache = null;
      return [];
    });
  return listingsCache;
}

function matches(l: Listing, q: string): boolean {
  return [l.title, l.description, getCategoryLabel(l.category), l.url].some(f => (f || '').toLowerCase().includes(q));
}

/** Search dialog opened from the header (also ⌘K / Ctrl+K). Shows live matches as you type. */
export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (!open) return;
    loadListings().then(setListings);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!listings) return [];
    return q ? listings.filter(l => matches(l, q)).slice(0, MAX_RESULTS) : listings.slice(0, 4);
  }, [listings, q]);

  if (!open) return null;

  const close = () => {
    setQuery('');
    setActive(-1);
    onClose();
  };

  const go = (href: string) => {
    close();
    router.push(href);
  };

  const seeAll = () => {
    if (q) go(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && results[active]) go(`/product/${results[active].id}`);
      else seeAll();
    }
  };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Search products" onKeyDown={onKeyDown}>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close search"
        onClick={close}
        className="absolute inset-0 w-full h-full bg-[#071a33]/60 backdrop-blur-sm cursor-default"
      />

      <div className="relative mx-3 sm:mx-auto mt-3 sm:mt-[12vh] w-auto sm:w-full sm:max-w-xl rounded-2xl bg-white shadow-2xl shadow-black/30 ring-1 ring-black/5 overflow-hidden animate-[slideUp_200ms_cubic-bezier(0.22,1,0.36,1)]">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 sm:px-5 border-b border-gray-100">
          <Search className="w-5 h-5 text-[#0F3460] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setActive(-1);
            }}
            placeholder="Search products, categories…"
            aria-label="Search products"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 min-w-0 py-4 sm:py-5 text-base sm:text-lg text-[#0B2545] placeholder-[#1F2937]/35 bg-transparent outline-none"
          />
          {query ? (
            <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear search" className="p-1.5 rounded-lg text-[#1F2937]/40 hover:text-[#1F2937] hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <button type="button" onClick={close} className="hidden sm:inline-flex px-2 py-1 rounded-md border border-gray-200 text-[11px] font-bold text-[#1F2937]/50 hover:bg-gray-50">
            Esc
          </button>
          <button type="button" onClick={close} aria-label="Close search" className="sm:hidden p-1.5 -mr-1.5 rounded-lg text-[#1F2937]/60 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[70vh] sm:max-h-[60vh] overflow-y-auto overscroll-contain">
          {/* Categories, shown before typing */}
          {!q && (
            <div className="px-4 sm:px-5 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1F2937]/40 mb-2.5">Browse categories</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_CATEGORIES.map(c => (
                  <Link
                    key={c}
                    href={categoryPath(c)}
                    onClick={close}
                    className="px-3 py-1.5 rounded-full bg-[#0F3460]/[0.06] text-xs sm:text-sm font-semibold text-[#0F3460] hover:bg-[#0F3460] hover:text-white transition-colors"
                  >
                    {getCategoryLabel(c)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          <div className="px-2 sm:px-3 py-3">
            {!q && results.length > 0 && (
              <p className="px-2 pt-1 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1F2937]/40 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Top ranked
              </p>
            )}

            {listings === null ? (
              <p className="px-3 py-6 text-sm text-center text-[#1F2937]/50">Loading products…</p>
            ) : q && results.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm font-semibold text-[#0B2545]">No products match “{query.trim()}”</p>
                <p className="mt-1 text-xs text-[#1F2937]/50">Try a product name, a category or a website.</p>
              </div>
            ) : (
              <ul role="listbox" aria-label="Search results">
                {results.map((l, i) => (
                  <li key={l.id} role="option" aria-selected={i === active}>
                    <Link
                      href={`/product/${l.id}`}
                      onClick={close}
                      onMouseEnter={() => setActive(i)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${i === active ? 'bg-[#0F3460]/[0.06]' : 'hover:bg-gray-50'}`}
                    >
                      <span className="w-9 h-9 flex-shrink-0 rounded-lg bg-gradient-to-br from-[#0F3460] to-[#1a5490] text-white flex items-center justify-center text-sm font-black">
                        {(l.title || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[#0B2545] truncate">{l.title}</span>
                        <span className="block text-xs text-[#1F2937]/50 truncate">{getCategoryLabel(l.category)}</span>
                      </span>
                      <span className="flex-shrink-0 text-xs font-bold text-[#059669] tabular-nums">{(l.totalVotes || 0).toLocaleString('en-US')} {l.totalVotes === 1 ? 'vote' : 'votes'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50/70">
          <span className="hidden sm:flex items-center gap-3 text-[11px] text-[#1F2937]/45">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded border border-gray-200 bg-white font-sans">↑</kbd><kbd className="px-1.5 py-0.5 rounded border border-gray-200 bg-white font-sans">↓</kbd> to navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded border border-gray-200 bg-white font-sans"><CornerDownLeft className="w-3 h-3" /></kbd> to open</span>
          </span>
          {q ? (
            <button type="button" onClick={seeAll} className="ml-auto inline-flex items-center gap-1.5 text-sm font-bold text-[#0F3460] hover:gap-2.5 transition-all">
              See all results <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <Link href="/leaderboard" onClick={close} className="ml-auto inline-flex items-center gap-1.5 text-sm font-bold text-[#0F3460] hover:gap-2.5 transition-all">
              View leaderboard <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
