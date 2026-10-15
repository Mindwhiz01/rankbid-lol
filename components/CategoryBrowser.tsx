import Link from 'next/link';
import Header from '@/components/Header';
import RankingRow from '@/components/RankingRow';
import SelectionHeading from '@/components/SelectionHeading';
import CategoryDropdown from '@/components/CategoryDropdown';
import SubmitProductModal from '@/components/SubmitProductModal';
import Pagination, { PAGE_SIZE } from '@/components/Pagination';
import { CATEGORIES, categoryPath, getCategoryLabel } from '@/lib/categories';
import { MIN_BID_USD } from '@/lib/premiumSpots';
import type { Listing } from '@/lib/server/listings';

// Server-rendered category hub and category pages. Every category is a real link to its
// own URL so crawlers can reach each one, and the rankings are in the initial HTML.
export default function CategoryBrowser({ selected, listings, counts, intro, custom = [], page = 1 }: {
  selected: string | null;
  /** 1-based page of the rankings to show (from ?page=), PAGE_SIZE per page. */
  page?: number;
  /** Categories people added under "Other" (listed after the built-in ones, before Other). */
  custom?: string[];
  listings: Listing[];
  counts: Record<string, number>;
  intro: string;
}) {
  const label = selected ? getCategoryLabel(selected) : 'All Categories';
  const totalCount = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const totalPages = Math.max(1, Math.ceil(listings.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const offset = (current - 1) * PAGE_SIZE;
  const basePath = selected ? categoryPath(selected) : '/categories';

  return (
    <>
      <Header />
      <div className="bg-white text-[#1F2937]">
        <section className="spotlight relative z-20 bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white">
          {/* Only the background shapes are clipped, so the category dropdown can open over the section below. */}
          <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-24 -right-16 w-72 h-72 bg-[#1a5490] rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-16 w-72 h-72 bg-[#059669] rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-10 md:py-12">
            {selected && (
              <nav aria-label="Breadcrumb" className="text-xs text-white/60 mb-4 flex items-center gap-1.5">
                <Link href="/categories" className="hover:text-white">Categories</Link>
                <span aria-hidden="true">/</span>
                <span className="text-white/80">{label}</span>
              </nav>
            )}
            <SelectionHeading
              as="h1"
              tone="dark"
              lead={selected ? 'top' : 'browse'}
              highlight={selected ? `${label} products` : 'categories'}
              className="mb-4 sm:mb-5"
            />
            <p className="text-sm sm:text-base text-white/75 max-w-2xl mb-6 sm:mb-9">{intro}</p>

            <CategoryDropdown
              label={label}
              count={selected ? counts[selected] || 0 : totalCount}
              options={[null, ...CATEGORIES.filter(c => c !== 'Other'), ...custom, 'Other'].map(cat => ({
                key: cat ?? 'all',
                href: cat ? categoryPath(cat) : '/categories',
                label: cat ? getCategoryLabel(cat) : 'All Categories',
                count: cat ? counts[cat] || 0 : totalCount,
                active: selected === cat,
              }))}
            />
          </div>
        </section>

        <section className="bg-gray-50 py-6 sm:py-10 md:py-12 min-h-[40vh]">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-black text-[#1F2937] mb-1">
                {selected ? `${label} rankings` : 'Top products across all categories'}
              </h2>
              <p className="text-xs sm:text-sm text-[#1F2937]/60 font-semibold">
                {listings.length} product{listings.length !== 1 ? 's' : ''} ranked by community votes
              </p>
            </div>

            {listings.length === 0 ? (
              <div className="text-center py-8 sm:py-12 border border-gray-200 shadow-sm bg-white rounded-lg">
                <p className="text-sm font-bold text-[#1F2937] mb-4">No products yet in {selected ? label : 'any category'}. Be the first to launch here.</p>
                <SubmitProductModal
                  category={selected}
                  label="Submit a product"
                  className="inline-block px-4 sm:px-6 py-2 sm:py-2.5 bg-[#0F3460] text-white font-black text-xs sm:text-sm rounded-lg hover:bg-[#0D2A50] active:scale-95 transition-all"
                />
                <p className="mt-3 text-xs text-[#1F2937]/50">Free, or sponsored from ${MIN_BID_USD}.</p>
              </div>
            ) : (
              <>
                <ol start={offset + 1} className="curve-list space-y-3 sm:space-y-4">
                  {listings.slice(offset, offset + PAGE_SIZE).map((listing, idx) => (
                    <li key={listing.id}>
                      <RankingRow listing={listing} rank={offset + idx + 1} votes={listing.totalVotes} votesLabel="votes" />
                    </li>
                  ))}
                </ol>
                <Pagination
                  currentPage={current}
                  totalPages={totalPages}
                  hrefFor={p => (p === 1 ? basePath : `${basePath}?page=${p}`)}
                />
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
