'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, ChevronRight, Star, Pencil, Trash2 } from 'lucide-react';
import Header from '@/components/Header';
import RankingRow from '@/components/RankingRow';
import SubmissionEditModal from '@/components/SubmissionEditModal';
import AccountSettings from '@/components/AccountSettings';
import { HOME_SPONSORED } from '@/lib/premiumSpots';
import Pagination from '@/components/Pagination';
import { usePaged } from '@/lib/usePaged';
import { logoUrl } from '@/lib/logo';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface Listing {
  id: string;
  title: string;
  description: string;
  url?: string;
  handle?: string;
  platform: string;
  totalVotes: number;
  dayVotes: number;
  category: string;
  createdAt: string;
}

/** A live sponsored listing of this user's (from /api/premium-listings/ladder): its rank by price. */
interface HeldSpot {
  position: number;
  bidUsd: number;
  expiresAt: string | null;
}

interface Vote {
  id: string;
  listingId: string;
  votedAt: string;
  listing?: {
    id: string;
    title: string;
    description: string;
    url?: string;
    totalVotes: number;
  };
}


export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Listing[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [allListings, setAllListings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'submissions' | 'votes' | 'settings'>('submissions');
  const [loading, setLoading] = useState(true);
  const [premiumSpots, setPremiumSpots] = useState<Record<string, HeldSpot>>({});
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Listing | null>(null);
  const [deleting, setDeleting] = useState<Listing | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const submissionsPage = usePaged(submissions);
  const votesPage = usePaged(votes);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    try {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      fetchUserData();
    } catch {
      localStorage.removeItem('user');
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [router]);

  const fetchUserData = async () => {
    try {
      const submissionsRes = await fetch('/api/user/submissions');
      if (submissionsRes.ok) {
        const data = await submissionsRes.json();
        setSubmissions(data.listings || []);
        // Older outbid emails link here with ?raise=<listingId>: send them to the sponsor checkout page.
        const raiseId = new URLSearchParams(window.location.search).get('raise');
        if (raiseId && (data.listings || []).some((l: Listing) => l.id === raiseId)) {
          router.replace(`/sponsor?listing=${encodeURIComponent(raiseId)}`);
        }
      }

      const votesRes = await fetch('/api/user/votes');
      if (votesRes.ok) {
        const data = await votesRes.json();
        setVotes(data.votes || []);
      }

      // Which of the user's submissions are sponsored right now, and their rank by price
      const ladderRes = await fetch('/api/premium-listings/ladder');
      if (ladderRes.ok) {
        const data = await ladderRes.json();
        const held: Record<string, HeldSpot> = {};
        for (const r of data.ranked || []) {
          held[r.listingId] = { position: r.position, bidUsd: r.bidUsd, expiresAt: r.expiresAt };
        }
        setPremiumSpots(held);
      }

      // Fetch all listings to calculate rankings
      const allListingsRes = await fetch(`/api/listings?limit=1000&offset=0`);
      if (allListingsRes.ok) {
        const listings = await allListingsRes.json();
        setAllListings(listings || []);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRank = (totalVotes: number): number => {
    return allListings.filter(l => (l.totalVotes || 0) > totalVotes).length + 1;
  };

  const openDelete = (listing: Listing) => {
    setNotice('');
    setDeleteError('');
    setDeleting(listing);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/user/submissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: deleting.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete this submission');
      setSubmissions(prev => prev.filter(l => l.id !== deleting.id));
      setAllListings(prev => prev.filter(l => l.id !== deleting.id));
      setNotice(`${deleting.title || 'Your submission'} was deleted.`);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this submission');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleLogout = async () => {
    // End the server session first; clearing localStorage alone leaves the auth cookie working.
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    setUser(null);
    router.push('/');
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        {/* Profile band */}
        <section className="spotlight relative overflow-hidden bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white">
          <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-24 -right-16 w-72 h-72 bg-[#1a5490] rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-16 w-72 h-72 bg-[#059669] rounded-full blur-3xl"></div>
          </div>
          <div className="relative max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 slide-up">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white text-[#0F3460] rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl flex-shrink-0 shadow-lg">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-3xl font-black truncate">{user.name || user.email.split('@')[0]}</h1>
                  <p className="text-xs sm:text-sm text-white/65 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/10 border border-white/20 text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-5 sm:mt-7 max-w-lg slide-up" style={{ '--d': '120ms' } as CSSProperties}>
              {[
                { label: 'Submissions', value: submissions.length },
                { label: 'Votes received', value: submissions.reduce((sum, l) => sum + (l.totalVotes || 0), 0) },
                { label: 'Votes given', value: votes.length },
              ].map(stat => (
                <div key={stat.label} className="bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 backdrop-blur-sm">
                  <p className="text-lg sm:text-2xl font-black leading-tight">{loading ? '—' : stat.value}</p>
                  <p className="text-[11px] sm:text-xs text-white/65 font-semibold">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pt-5 sm:pt-6">
          <div className="inline-flex p-1 bg-white border border-gray-200 shadow-sm rounded-full max-w-full overflow-x-auto">
            {[
              { id: 'submissions' as const, label: 'My Submissions', count: submissions.length },
              { id: 'votes' as const, label: 'My Votes', count: votes.length },
              { id: 'settings' as const, label: 'Settings', count: null },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-full whitespace-nowrap transition-all ${
                  activeTab === tab.id ? 'bg-[#0F3460] text-white shadow-sm' : 'text-[#1F2937]/65 hover:text-[#0F3460]'
                }`}
              >
                {tab.label}{tab.count !== null && <span className={activeTab === tab.id ? 'text-white/70' : 'text-[#1F2937]/40'}> ({tab.count})</span>}
              </button>
            ))}
          </div>
        </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin text-[#0F3460] text-2xl">⏳</div>
          </div>
        ) : (
          <>
            {/* Submissions Tab */}
            {activeTab === 'submissions' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg sm:text-2xl font-black text-[#1F2937] mb-1">My Submissions</h2>
                  <p className="text-xs sm:text-sm text-[#1F2937]/70">Products and services you&apos;ve submitted to RankBid</p>
                </div>

                {submissions.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 sm:p-12 text-center border border-gray-200 shadow-sm">
                    <p className="text-sm sm:text-base text-[#1F2937]/70 mb-5">You haven&apos;t submitted anything yet.</p>
                    <Link
                      href="/#submit"
                      className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-[#0F3460] text-white font-black text-xs sm:text-sm rounded-lg hover:bg-[#0D2A50] active:scale-95 transition-all"
                    >
                      Submit Your First Product
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                ) : (
                  <div id={submissionsPage.anchorId} className="space-y-3 scroll-mt-24">
                    {notice && (
                      <p role="status" className="px-4 py-3 rounded-xl bg-[#059669]/10 border border-[#059669]/25 text-sm font-semibold text-[#065F46]">
                        {notice}
                      </p>
                    )}
                    {submissionsPage.pageItems.map((listing) => {
                      const title = listing.title || (listing.handle ? `@${listing.handle}` : listing.url || 'Untitled');
                      const spot = premiumSpots[listing.id];
                      const manage = (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setNotice(''); setEditing({ ...listing, title }); }}
                            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[#0F3460] text-xs sm:text-sm font-bold hover:border-[#0F3460]/40 hover:bg-[#0F3460]/[0.04] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openDelete({ ...listing, title })}
                            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-red-600 text-xs sm:text-sm font-bold hover:border-red-300 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      );
                      return (
                        <div key={listing.id}>
                          <RankingRow
                            listing={{ ...listing, url: listing.url || '', title }}
                            rank={calculateRank(listing.totalVotes)}
                            votes={listing.totalVotes || 0}
                          />
                          {/* Premium strip: held spot, or the option to buy one */}
                          {spot ? (
                            <div className="mx-2 sm:mx-3 -mt-1 pt-3 pb-2 px-3 sm:px-4 rounded-b-xl bg-amber-50 border border-t-0 border-amber-200 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-amber-700">
                                <Star className="w-4 h-4 fill-amber-500 text-amber-500" /> Sponsored #{spot.position}
                              </span>
                              <span className="text-xs text-amber-700/70">
                                ${spot.bidUsd} · {spot.position <= HOME_SPONSORED ? 'on the homepage' : 'on the sponsored page'}
                                {spot.expiresAt ? ` · until ${new Date(spot.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ' · lifetime'}
                              </span>
                              <div className="ml-auto flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => router.push(`/sponsor?listing=${encodeURIComponent(listing.id)}`)}
                                  className="text-xs font-black text-amber-700 hover:underline"
                                >
                                  Raise bid
                                </button>
                                {manage}
                              </div>
                            </div>
                          ) : (
                            <div className="mx-2 sm:mx-3 -mt-1 pt-3 pb-2 px-3 sm:px-4 rounded-b-xl bg-gray-50 border border-t-0 border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <p className="text-xs text-[#1F2937]/70">Sponsor it for life from $1, one payment: the higher you pay, the higher it ranks.</p>
                              <div className="self-start sm:self-auto flex flex-wrap items-center gap-1.5">
                                {manage}
                                <button
                                  type="button"
                                  onClick={() => router.push(`/sponsor?listing=${encodeURIComponent(listing.id)}`)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs sm:text-sm font-black shadow-sm shadow-amber-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                                >
                                  <Star className="w-3.5 h-3.5 fill-white" /> Sponsor it
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <Pagination currentPage={submissionsPage.page} totalPages={submissionsPage.totalPages} onPageChange={submissionsPage.goTo} />
                  </div>
                )}
              </div>
            )}

            {/* Votes Tab */}
            {activeTab === 'votes' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg sm:text-2xl font-black text-[#1F2937] mb-1">My Votes</h2>
                  <p className="text-xs sm:text-sm text-[#1F2937]/70">Products and services you&apos;ve voted for</p>
                </div>

                {votes.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 sm:p-12 text-center border border-gray-200 shadow-sm">
                    <p className="text-sm sm:text-base text-[#1F2937]/70 mb-5">You haven&apos;t voted yet.</p>
                    <Link
                      href="/"
                      className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-[#0F3460] text-white font-black text-xs sm:text-sm rounded-lg hover:bg-[#0D2A50] active:scale-95 transition-all"
                    >
                      Explore Rankings
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                ) : (
                  <div id={votesPage.anchorId} className="space-y-3 scroll-mt-24">
                    {votesPage.pageItems.map((vote, idx) => {
                      let faviconUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';

                      if (vote.listing?.url) {
                        try {
                          const urlObj = new URL(vote.listing.url);
                          faviconUrl = logoUrl(urlObj.hostname, 32);
                        } catch {
                          // If URL parsing fails, use default
                        }
                      }

                      return (
                        <Link
                          key={vote.id}
                          href={`/product/${vote.listingId}`}
                          className="flex items-center justify-between p-3 bg-white border border-gray-200 shadow-sm rounded-xl hover:shadow-md hover:border-[#0F3460]/30 transition-all duration-200 group cursor-pointer gap-4"
                        >
                          {/* Left Section: Vote Badge and Favicon */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-9 h-9 bg-[#059669]/10 text-[#059669] rounded-lg flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-8.5-4.8-8.5-11A4.5 4.5 0 0112 7a4.5 4.5 0 018.5 2.5c0 6.2-8.5 11-8.5 11z" /></svg>
                            </div>
                            <img
                              src={faviconUrl}
                              alt="favicon"
                              className="w-6 h-6 rounded flex-shrink-0"
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
                              }}
                            />
                            {/* Title */}
                            <p className="text-xs font-semibold text-[#1F2937] truncate group-hover:text-[#0F3460] transition-colors flex-1 min-w-0">
                              {vote.listing?.title || 'Product'}
                            </p>
                          </div>

                          {/* Right Section: Vote Count and Actions */}
                          <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                            {/* Vote Count */}
                            <div className="min-w-[2.5rem] text-right">
                              <p className="text-lg font-black text-[#0F3460] leading-none">
                                {vote.listing?.totalVotes || 0}
                              </p>
                              <p className="text-[10px] sm:text-[11px] text-[#1F2937]/70 font-semibold mt-0.5">
                                {(vote.listing?.totalVotes || 0) === 1 ? 'vote' : 'votes'}
                              </p>
                            </div>

                            <ChevronRight className="w-4 h-4 text-[#1F2937]/30 group-hover:text-[#0F3460] transition-colors" />
                          </div>
                        </Link>
                      );
                    })}
                    <Pagination currentPage={votesPage.page} totalPages={votesPage.totalPages} onPageChange={votesPage.goTo} />
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg sm:text-2xl font-black text-[#1F2937] mb-1">Settings</h2>
                  <p className="text-xs sm:text-sm text-[#1F2937]/70">Your name, password and account</p>
                </div>

                <AccountSettings
                  user={user}
                  onUserChange={setUser}
                  onDeleted={() => {
                    localStorage.removeItem('user');
                    localStorage.removeItem('auth_token');
                    router.push('/?account=deleted');
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {editing && (
        <SubmissionEditModal
          submission={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            setSubmissions(prev => prev.map(l => (l.id === updated.id ? { ...l, ...updated } : l)));
            setNotice('Your changes were saved.');
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 bg-[#0B2545]/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={() => !deleteBusy && setDeleting(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-submission-title"
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl slide-up p-5 sm:p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 id="delete-submission-title" className="text-base sm:text-lg font-black text-[#1F2937] mb-1.5">Delete this submission?</h2>
            <p className="text-xs sm:text-sm text-[#1F2937]/65">
              <span className="font-bold text-[#1F2937]">{deleting.title}</span> will be removed from the rankings along with
              its {deleting.totalVotes || 0} {deleting.totalVotes === 1 ? 'vote' : 'votes'}. This can&apos;t be undone.
            </p>
            {deleteError && <p role="alert" className="mt-3 text-xs font-bold text-red-600">{deleteError}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                autoFocus
                onClick={() => setDeleting(null)}
                disabled={deleteBusy}
                className="px-4 py-2 rounded-lg border border-gray-300 text-xs sm:text-sm font-bold text-[#1F2937]/70 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteBusy}
                className="px-5 py-2 rounded-lg bg-red-600 text-white text-xs sm:text-sm font-black hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
