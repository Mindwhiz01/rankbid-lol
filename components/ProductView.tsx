'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import PlatformIcon from '@/components/PlatformIcon';
import { IconTile, PremiumIcons } from '@/components/PremiumIcons';
import FounderLinks, { FounderLinksCard, type FounderSocials } from '@/components/FounderLinks';
import { useState, useEffect, type CSSProperties } from 'react';
import { ArrowUpRight, Share2, Copy, Check } from 'lucide-react';
import StatusCardModal from '@/components/StatusCardModal';
import RankingRow from '@/components/RankingRow';
import { categoryPath, getCategoryLabel } from '@/lib/categories';
import { useVote } from '@/lib/useVote';
import { linkedInShareUrl, supportUrl } from '@/lib/site';
import { claimClick } from '@/lib/clickCount';

interface Listing {
  id: string;
  url: string;
  title: string;
  description: string;
  category: string;
  platform: string;
  totalVotes?: number;
  dayVotes?: number;
  clickCount: number;
  createdAt: string;
  updatedAt?: string;
}

// The server renders this with the listing already loaded (so crawlers see the content);
// it only fetches on the client when the server didn't find it yet (a just-submitted product).
export default function ProductView({ id, initialProduct, initialAllListings, founder = null }: {
  id: string;
  initialProduct: Listing | null;
  initialAllListings: Listing[];
  /** Founder links from the paid spot this product holds, if any. */
  founder?: FounderSocials | null;
}) {
  const [product, setProduct] = useState<Listing | null>(initialProduct);
  const [loading, setLoading] = useState(!initialProduct);
  const [allListings, setAllListings] = useState<Listing[]>(initialAllListings);
  const [copied, setCopied] = useState(false);
  const [showStatusCard, setShowStatusCard] = useState(false);
  const { voted, extraVotes, message: voteMessage, vote } = useVote(id);

  useEffect(() => {
    if (!initialProduct) fetchProduct();
  }, [id]);

  // Opening a product page counts as a click (once per visitor every 30 minutes, see /api/click).
  const [ownClick, setOwnClick] = useState(0);
  useEffect(() => {
    claimClick(id);
    fetch('/api/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data?.counted) setOwnClick(1); })
      .catch(() => {});
  }, [id]);

  // The person who submitted this product gets a Sponsor button (the checkout checks ownership too).
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/api/user/submissions', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (live && Array.isArray(data?.listings)) setIsOwner(data.listings.some((l: { id: string }) => l.id === id));
      })
      .catch(() => {});
    return () => { live = false; };
  }, [id]);

  const fetchProduct = async () => {
    try {
      // A just-submitted product can take a moment to appear (replication lag), so retry once on 404.
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(`/api/product/${id}`);
        if (res.ok) {
          const data = await res.json();
          setProduct(data.product);
          setAllListings(data.allListings || []);
          return;
        }
        if (res.status !== 404) return;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Failed to fetch product:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVisitUrl = () => {
    if (!product) return '#';
    // If URL already has protocol, use it as-is
    if (product.url.startsWith('http://') || product.url.startsWith('https://')) {
      return product.url;
    }
    // For social platforms without protocol, construct the proper URL
    switch (product.platform?.toLowerCase()) {
      case 'linkedin':
        return `https://www.linkedin.com/in/${product.url}`;
      case 'twitter':
      case 'x':
        return `https://twitter.com/${product.url.replace('@', '')}`;
      case 'instagram':
        return `https://instagram.com/${product.url.replace('@', '')}`;
      case 'tiktok':
        return `https://tiktok.com/@${product.url.replace('@', '')}`;
      case 'facebook':
        return `https://facebook.com/${product.url}`;
      default:
        return product.url;
    }
  };

  const handleCopyLink = async () => {
    if (!product) return;
    const url = supportUrl(product.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleShareTwitter = () => {
    if (!product) return;
    const url = supportUrl(product.id);
    const text = `Check out "${product.title}" on RankBid! Vote for it to help it climb the ${getCategoryLabel(product.category)} rankings. ${url}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const handleShareLinkedIn = () => {
    if (!product) return;
    const url = supportUrl(product.id);
    const text = `Check out "${product.title}" on RankBid! 🚀\n\nVote for it to help it climb the ${getCategoryLabel(product.category)} rankings. It takes 10 seconds, no account needed.`;
    const linkedInUrl = linkedInShareUrl(text, url);
    window.open(linkedInUrl, '_blank', 'width=550,height=420');
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50">
          <div className="h-56 sm:h-64 bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] animate-pulse" />
          <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-40 bg-white border border-gray-200 rounded-2xl animate-pulse" />
            <div className="h-40 bg-white border border-gray-200 rounded-2xl animate-pulse" />
          </div>
        </div>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <div className="min-h-[70vh] bg-gray-50 flex items-center justify-center px-4">
          <div className="text-center bg-white border border-gray-200 shadow-sm rounded-2xl p-8 max-w-md w-full">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#0F3460]/5 text-[#0F3460] flex items-center justify-center">
              <PremiumIcons.Compass className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#1F2937] mb-2">Product not found</h1>
            <p className="text-sm text-[#1F2937]/60 mb-5">It may have been removed or the link is incorrect.</p>
            <Link href="/" className="inline-block px-5 py-2.5 bg-[#0F3460] text-white font-black rounded-lg hover:bg-[#0D2A50] transition-colors text-sm">
              Back to Rankings
            </Link>
          </div>
        </div>
      </>
    );
  }

  const votes = (product.totalVotes || 0) + extraVotes;
  const isRanked = votes > 0;

  // Rank = products with more votes, plus products that reached the same count more recently, plus one.
  // A vote cast on this page just now makes this product the most recent at its new count.
  const lastVotedAt = (l: Listing) => new Date(l.updatedAt || l.createdAt).getTime();
  const ownLastVotedAt = extraVotes > 0 ? Date.now() : lastVotedAt(product);
  const ranksAbove = (pool: Listing[]) =>
    pool.filter(l => {
      if (l.id === product.id) return false;
      const lv = l.totalVotes || 0;
      if (lv !== votes) return lv > votes;
      return lastVotedAt(l) > ownLastVotedAt;
    }).length;
  const totalProducts = Math.max(allListings.length, 1);
  const allTimeRank = ranksAbove(allListings) + 1;
  const categoryPool = allListings.filter(l => l.category === product.category);
  const categoryRank = ranksAbove(categoryPool) + 1;

  const relatedListings = allListings
    .filter(l => l.category === product.category && l.id !== product.id)
    .sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0))
    .slice(0, 5);

  let favicon: string | null = null;
  try {
    favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(getVisitUrl()).hostname)}&sz=128`;
  } catch {}

  const shareLink = supportUrl(product.id);
  const whatsappText = `Support "${product.title}" on RankBid: it takes 10 seconds, no account needed. ${shareLink}`;
  const listedOn = new Date(product.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const platformName = product.platform === 'twitter' || product.platform === 'x' ? 'X' : product.platform;

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        {/* HERO */}
        <section className="spotlight relative overflow-hidden bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white">
          <div className="absolute inset-0 opacity-25 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-24 -right-16 w-80 h-80 bg-[#1a5490] rounded-full blur-3xl"></div>
            <div className="absolute -bottom-28 -left-16 w-80 h-80 bg-[#059669] rounded-full blur-3xl"></div>
          </div>

          <div className="relative max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pt-5 sm:pt-8 pb-8 sm:pb-12">
            <nav aria-label="Breadcrumb" className="slide-up text-xs text-white/60 mb-4 sm:mb-6 flex items-center gap-1.5 flex-wrap" style={{ '--d': '0ms' } as CSSProperties}>
              <Link href="/categories" className="hover:text-white">Categories</Link>
              <span aria-hidden="true">/</span>
              <Link href={categoryPath(product.category)} className="hover:text-white">{getCategoryLabel(product.category)}</Link>
              <span aria-hidden="true">/</span>
              <span className="text-white/80 truncate max-w-[12rem] sm:max-w-xs">{product.title}</span>
            </nav>

            <div className="flex flex-col md:flex-row md:items-start gap-4 sm:gap-6">
              <div className="slide-up w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white shadow-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ '--d': '80ms' } as CSSProperties}>
                {favicon ? <img src={favicon} alt={`${product.title} logo`} className="w-10 h-10 sm:w-12 sm:h-12 object-contain" /> : <PlatformIcon platform={product.platform} size={40} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="slide-up flex flex-wrap items-center gap-2 mb-2 sm:mb-3" style={{ '--d': '140ms' } as CSSProperties}>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/15 border border-white/15">{getCategoryLabel(product.category)}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-white/15 border border-white/15 capitalize">
                    <PlatformIcon platform={product.platform} size={12} /> {platformName}
                  </span>
                  {isRanked && allTimeRank <= 3 && (
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-400 text-[#0B2545]">Top {allTimeRank} overall</span>
                  )}
                </div>
                <h1 className="slide-up text-2xl sm:text-4xl md:text-5xl font-black leading-tight mb-2 sm:mb-3 break-words" style={{ '--d': '200ms' } as CSSProperties}>{product.title}</h1>
                {product.description && (
                  <p className="slide-up text-sm sm:text-base md:text-lg text-white/75 leading-relaxed max-w-3xl mb-5 sm:mb-7" style={{ '--d': '260ms' } as CSSProperties}>{product.description}</p>
                )}

                <div className="slide-up flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3" style={{ '--d': '320ms' } as CSSProperties}>
                  <button
                    onClick={vote}
                    title={voted ? 'Click to remove your vote' : undefined}
                    className={`inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 font-black rounded-xl text-sm transition-all active:scale-95 disabled:opacity-60 ${
                      voted
                        ? 'bg-white/15 text-white border border-white/25 hover:bg-red-500/80 hover:border-red-400'
                        : 'bg-gradient-to-r from-[#059669] to-[#10B981] text-white shadow-lg shadow-black/20 hover:-translate-y-0.5 hover:shadow-xl'
                    }`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={voted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.5s-8.5-4.8-8.5-11A4.5 4.5 0 0112 7a4.5 4.5 0 018.5 2.5c0 6.2-8.5 11-8.5 11z" />
                    </svg>
                    {voted ? 'Voted' : 'Vote'} · {votes}
                  </button>
                  <a
                    href={product.url.startsWith('http') ? `/api/click?id=${encodeURIComponent(product.id)}` : getVisitUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-white text-[#0F3460] font-black rounded-xl hover:-translate-y-0.5 active:scale-95 transition-all text-sm shadow-lg shadow-black/10"
                  >
                    Visit {product.platform === 'website' ? 'Website' : 'Profile'}
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                  {isOwner && (
                    <Link
                      href={`/sponsor?listing=${encodeURIComponent(product.id)}`}
                      className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-[#0B2545] font-black rounded-xl hover:-translate-y-0.5 active:scale-95 transition-all text-sm shadow-lg shadow-black/20"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9L12 2.5z" /></svg>
                      {founder ? 'Raise sponsored rank' : 'Sponsor this product'}
                    </Link>
                  )}
                  <span className="text-xs sm:text-sm font-semibold text-white/70 tabular-nums">
                    {((product.clickCount || 0) + ownClick).toLocaleString()} {(product.clickCount || 0) + ownClick === 1 ? 'click' : 'clicks'}
                  </span>
                  {founder && <FounderLinks listing={founder} title={product.title} size="md" />}
                  {voteMessage && <span className="text-xs sm:text-sm font-semibold text-emerald-300">{voteMessage}</span>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* MAIN COLUMN */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">
            {/* Stats */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-black text-[#1F2937] mb-4">Ranking stats</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 -mx-4 sm:-mx-6 border-y border-gray-100 divide-x divide-gray-100 [&>*:nth-child(3)]:border-l-0 sm:[&>*:nth-child(3)]:border-l [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-t-0">
                <div className="px-4 sm:px-6 py-4">
                  <p className="text-[11px] sm:text-xs font-bold text-[#1F2937]/50">Overall rank</p>
                  {isRanked ? (
                    <p className="text-2xl sm:text-3xl font-black text-[#0F3460] mt-1 tabular-nums">#{allTimeRank}<span className="text-xs sm:text-sm font-semibold text-[#1F2937]/35"> / {totalProducts}</span></p>
                  ) : (
                    <p className="text-lg sm:text-xl font-black text-[#1F2937] mt-1.5">Unranked</p>
                  )}
                </div>
                <div className="px-4 sm:px-6 py-4">
                  <p className="text-[11px] sm:text-xs font-bold text-[#1F2937]/50 truncate">In {getCategoryLabel(product.category)}</p>
                  <p className="text-2xl sm:text-3xl font-black text-[#0F3460] mt-1 tabular-nums">
                    {isRanked ? <>#{categoryRank}<span className="text-xs sm:text-sm font-semibold text-[#1F2937]/35"> / {categoryPool.length}</span></> : '—'}
                  </p>
                </div>
                <div className="px-4 sm:px-6 py-4">
                  <p className="text-[11px] sm:text-xs font-bold text-[#1F2937]/50">Total votes</p>
                  <p className="text-2xl sm:text-3xl font-black text-[#1F2937] mt-1 tabular-nums">{votes}</p>
                </div>
                <div className="px-4 sm:px-6 py-4">
                  <p className="text-[11px] sm:text-xs font-bold text-[#1F2937]/50">Votes today</p>
                  <p className="text-2xl sm:text-3xl font-black text-[#059669] mt-1 tabular-nums">{(product.dayVotes || 0) + extraVotes}</p>
                </div>
              </div>
              {!isRanked && (
                <p className="mt-4 text-xs sm:text-sm text-[#1F2937]/65 bg-[#059669]/5 border border-[#059669]/20 rounded-xl px-3 py-2.5">
                  No votes yet. Cast the first vote or share the support link to get this product on the leaderboard.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs sm:text-sm">
                <span className="text-[#1F2937]/55">Listed <span className="font-bold text-[#1F2937]">{listedOn}</span></span>
                <span className="text-[#1F2937]/55">Platform <span className="font-bold text-[#1F2937] capitalize">{platformName}</span></span>
              </div>
            </div>

            {/* More in this category: gives visitors a next step instead of leaving */}
            {relatedListings.length > 0 && (
              <div>
                <div className="flex items-end justify-between gap-3 mb-3 sm:mb-4">
                  <h2 className="text-base sm:text-xl font-black text-[#1F2937]">More in {getCategoryLabel(product.category)}</h2>
                  <Link href={categoryPath(product.category)} className="text-xs sm:text-sm font-bold text-[#0F3460] hover:underline whitespace-nowrap">
                    All {getCategoryLabel(product.category)} rankings →
                  </Link>
                </div>
                <div className="curve-list space-y-2.5 sm:space-y-3">
                  {relatedListings.map((l, i) => (
                    <RankingRow key={l.id} listing={l} rank={i + 1} votes={l.totalVotes || 0} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <aside className="space-y-4 sm:space-y-6 order-1 lg:order-2">
            {founder && <FounderLinksCard listing={founder} title={product.title} />}
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 sm:p-6 lg:sticky lg:top-36">
              <div className="flex items-center gap-3 mb-3">
                <IconTile tone="green"><PremiumIcons.Share /></IconTile>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-[#1F2937]">Share &amp; collect votes</h2>
                  <p className="text-xs text-[#1F2937]/55">Anyone can vote with name + email</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-1.5 pl-3 bg-gray-50 border border-gray-200 rounded-xl mb-3">
                <span className="text-xs font-semibold text-[#1F2937]/70 truncate flex-1">{shareLink.replace(/^https?:\/\//, '')}</span>
                <button onClick={handleCopyLink} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0F3460] text-white text-xs font-black rounded-lg hover:bg-[#0D2A50] active:scale-95 transition-all flex-shrink-0">
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2">
                <a href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener noreferrer" className="text-center px-2 py-2 rounded-lg bg-[#25D366] text-white text-xs font-black hover:opacity-90 transition">WhatsApp</a>
                <button onClick={handleShareTwitter} className="px-2 py-2 rounded-lg bg-black text-white text-xs font-black hover:opacity-90 transition">X</button>
                <button onClick={handleShareLinkedIn} className="px-2 py-2 rounded-lg bg-[#0A66C2] text-white text-xs font-black hover:opacity-90 transition">LinkedIn</button>
              </div>
              <button
                onClick={() => setShowStatusCard(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[#0F3460]/25 text-[#0F3460] text-xs sm:text-sm font-black hover:bg-[#0F3460]/5 transition"
              >
                <Share2 className="w-4 h-4" /> Download rank card
              </button>
            </div>
          </aside>
        </div>

      </div>

      {/* Status Card Modal */}
      {product && (
        <StatusCardModal
          isOpen={showStatusCard}
          onClose={() => setShowStatusCard(false)}
          product={{
            id: product.id,
            title: product.title,
            description: product.description,
            category: product.category,
            platform: product.platform,
            totalVotes: votes,
            rank: allTimeRank,
          }}
          productUrl={supportUrl(product.id)}
        />
      )}
    </>
  );
}
