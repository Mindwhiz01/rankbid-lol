'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import RankingRow from '@/components/RankingRow';
import Pagination from '@/components/Pagination';
import { usePaged } from '@/lib/usePaged';
import { useState, useEffect, Suspense, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

interface Listing {
  id: string;
  url: string;
  title: string;
  description: string;
  category: string;
  platform: string;
  totalVotes: number;
  dayVotes: number;
  clickCount: number;
}


function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const [input, setInput] = useState(query);
  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(!!query);
  const paged = usePaged(results, query);

  // A new ?q= (typed here, or back/forward): show it in the box and start over. Adjusted during render
  // (React's pattern for state that follows a prop), so there's no extra render with the old results.
  const [shownQuery, setShownQuery] = useState(query);
  if (query !== shownQuery) {
    setShownQuery(query);
    setInput(query);
    setResults([]);
    setLoading(!!query);
  }

  useEffect(() => {
    if (!query) return;

    let cancelled = false;
    const searchProducts = async () => {
      try {
        const res = await fetch('/api/listings/submit?limit=1000&sort=totalVotes');
        const data = res.ok ? await res.json() : { listings: [] };
        const q = query.toLowerCase();
        const filtered = (data.listings || []).filter((l: Listing) =>
          [l.title, l.description, l.category, l.url].some(field => (field || '').toLowerCase().includes(q))
        );
        if (!cancelled) setResults(filtered);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    searchProducts();
    return () => { cancelled = true; };
  }, [query]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <div className="bg-gray-50 min-h-screen text-[#1F2937]">
      <PageHero title="Search" subtitle={query ? `Results for “${query}”` : 'Find products, tools and creators ranked by the community.'}>
        <form onSubmit={submit} className="slide-up mt-5 sm:mt-7 flex max-w-xl bg-white rounded-xl shadow-lg p-1.5" style={{ '--d': '240ms' } as CSSProperties}>
          <div className="flex items-center flex-1 min-w-0 pl-3 text-[#1F2937]/40">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Search products, categories…"
              aria-label="Search products"
              className="w-full px-2 sm:px-3 py-2 text-sm sm:text-base text-[#1F2937] placeholder-[#1F2937]/40 bg-transparent outline-none"
            />
          </div>
          <button type="submit" className="px-4 sm:px-6 py-2 bg-[#0F3460] text-white font-black text-xs sm:text-sm rounded-lg hover:bg-[#0D2A50] active:scale-95 transition-all">
            Search
          </button>
        </form>
      </PageHero>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-10 md:py-12">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin text-3xl sm:text-4xl">⏳</div>
            <p className="text-xs sm:text-sm text-[#1F2937]/70 font-semibold mt-2">Searching products...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-8 sm:py-12 px-4 border border-gray-200 shadow-sm bg-white rounded-lg">
            <h2 className="text-base sm:text-lg font-black text-[#1F2937] mb-1">
              {query ? 'No products found' : 'Start searching'}
            </h2>
            <p className="text-xs sm:text-sm text-[#1F2937]/70 mb-4 sm:mb-6">
              {query ? `Nothing matches “${query}”. Try a different word or browse categories.` : 'Type a product name, category or website above.'}
            </p>
            <Link
              href="/categories"
              className="inline-flex px-4 sm:px-6 py-2 sm:py-2.5 bg-[#0F3460] text-white font-black text-xs sm:text-sm rounded-lg hover:bg-[#0D2A50] active:scale-95 transition-all"
            >
              Browse Categories
            </Link>
          </div>
        ) : (
          <div id={paged.anchorId} className="scroll-mt-24">
            <p className="text-xs sm:text-sm text-[#1F2937]/70 font-semibold mb-4">
              Found <span className="font-black text-[#1F2937]">{results.length}</span> product{results.length !== 1 ? 's' : ''}
            </p>
            <div className="curve-list space-y-2.5 sm:space-y-3">
              {paged.pageItems.map((listing, idx) => (
                <RankingRow key={listing.id} listing={listing} rank={paged.offset + idx + 1} votes={listing.totalVotes || 0} votesLabel="votes" />
              ))}
            </div>
            <Pagination currentPage={paged.page} totalPages={paged.totalPages} onPageChange={paged.goTo} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
        <SearchContent />
      </Suspense>
    </>
  );
}
