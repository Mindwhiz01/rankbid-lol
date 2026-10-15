'use client';

import { useEffect, useState } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';

interface PremiumListing {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_description: string;
  category: string;
  total_votes: number;
  day_votes: number;
  /** Live rank by price for active listings; the recorded rank otherwise. */
  position: number | null;
  bid_usd: number | null;
  amount_pkr: number | null;
  payment_method: string | null;
  expires_at?: string | null;
  founder_name: string;
  founder_email: string;
  founder_phone: string;
  payment_status: string;
  payment_verified_at?: string | null;
  stripe_url?: string | null;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
}

type Filter = 'pending' | 'active' | 'needs_refund' | 'ended' | 'all';

/** Filter pills: which statuses each shows, and what an empty list means. */
const FILTERS: { key: Filter; label: string; statuses: string[] | null; empty: string }[] = [
  { key: 'pending', label: 'Pending', statuses: ['pending'], empty: 'No payments waiting. Stripe payments go live on their own; pending ones are checkouts not paid yet or missed by the webhook.' },
  { key: 'active', label: 'Active', statuses: ['active'], empty: 'No sponsored listings are live right now.' },
  { key: 'needs_refund', label: 'Needs refund', statuses: ['needs_refund'], empty: 'Nothing to refund.' },
  { key: 'ended', label: 'Ended', statuses: ['outbid', 'replaced'], empty: 'No ended listings yet. Listings end when their 30 days run out or the product is sponsored again.' },
  { key: 'all', label: 'All', statuses: null, empty: 'No sponsored orders yet.' },
];

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  needs_refund: 'bg-orange-100 text-orange-700',
  outbid: 'bg-gray-100 text-gray-700',
  replaced: 'bg-gray-100 text-gray-700',
};

/**
 * Sponsored payments: approve or reject pending orders and review every order by status.
 * Used on /admin/premium and inline on the admin Overview. The caller must be signed in as admin.
 */
export default function AdminPayments({ title = 'Approve payments' }: { title?: string | null }) {
  // Every order is loaded once; the filter pills only narrow the list (and show counts).
  const [allListings, setAllListings] = useState<PremiumListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('pending');
  const current = FILTERS.find(f => f.key === filter)!;
  const inFilter = (f: (typeof FILTERS)[number], l: PremiumListing) => !f.statuses || f.statuses.includes(l.payment_status);
  const premiumListings = allListings.filter(l => inFilter(current, l));
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: string }>>([]);

  const showToast = (message: string, type = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const fetchPremiumListings = async () => {
    setLoading(true);
    try {
      // An empty status lists every order.
      const res = await fetch('/api/admin/premium-listings?status=');

      if (res.ok) {
        const data = await res.json();
        setAllListings(data.premiumListings);
      } else {
        showToast('Failed to fetch premium listings', 'error');
      }
    } catch (error) {
      showToast('Error fetching premium listings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (premiumListingId: string) => {
    try {
      const res = await fetch('/api/admin/premium-listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          premiumListingId,
          status: 'approved',
          approvedBy: 'admin'
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.result?.status === 'needs_refund') {
        showToast(`Bid is below the $${data.result.required} minimum. Marked for refund.`, 'error');
        fetchPremiumListings();
      } else if (res.ok) {
        showToast(`Approved: listing is live${data.result?.position ? ` at #${data.result.position}` : ''}`, 'success');
        fetchPremiumListings();
      } else {
        showToast(data.error || 'Failed to approve', 'error');
      }
    } catch (error) {
      showToast('Error approving listing', 'error');
    }
  };

  const handleReject = async (premiumListingId: string) => {
    if (!confirm('Are you sure you want to reject this request?')) return;

    try {
      const res = await fetch('/api/admin/premium-listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          premiumListingId,
          status: 'rejected',
          approvedBy: 'admin'
        })
      });

      if (res.ok) {
        showToast('Premium listing rejected', 'success');
        fetchPremiumListings();
      } else {
        showToast('Failed to reject', 'error');
      }
    } catch (error) {
      showToast('Error rejecting listing', 'error');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load of the orders
    fetchPremiumListings();
  }, []);

  return (
    <>
      <div>
        {title && <h2 className="text-xl font-black text-[#1F2937] mb-4">{title}</h2>}
        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map(f => {
            const count = allListings.filter(l => inFilter(f, l)).length;
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={on}
                className={`px-4 py-2 text-sm font-bold rounded-full transition-colors flex items-center gap-2 ${
                  on ? 'bg-[#0F3460] text-white' : 'bg-white text-[#1F2937] hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {f.label}
                <span className={`min-w-[1.25rem] px-1.5 rounded-full text-[11px] tabular-nums ${on ? 'bg-white/20' : 'bg-[#F4F6FA] text-[#1F2937]/60'}`}>{count}</span>
              </button>
            );
          })}
          <button onClick={() => fetchPremiumListings()} className="ml-auto px-4 py-2 text-sm font-bold rounded-full bg-white hover:bg-gray-50">
            Refresh
          </button>
        </div>

        {/* Premium Listings Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin text-4xl">⏳</div>
            <p className="text-gray-600 mt-4">Loading premium listings...</p>
          </div>
        ) : premiumListings.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 max-w-md mx-auto">{current.empty}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {premiumListings.map(listing => (
              <div key={listing.id} className="bg-white rounded-3xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left: Listing Info */}
                  <div className="md:col-span-2">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#0F3460] to-[#1a5490] rounded-2xl flex items-center justify-center text-white font-black">
                        {listing.position ? `#${listing.position}` : '–'}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-[#1F2937]">{listing.listing_title}</h3>
                        <p className="text-sm text-[#1F2937]/70 mt-1">{listing.listing_description}</p>
                        <div className="flex gap-4 mt-3 flex-wrap text-xs">
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {listing.category}
                          </span>
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                            {listing.total_votes} votes
                          </span>
                          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">
                            {listing.day_votes} today
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Founder Info */}
                    <div className="bg-[#F4F6FA] rounded-2xl p-4 mt-4">
                      <p className="text-xs font-bold text-gray-600 uppercase mb-2">Founder Information</p>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-bold">Name:</span> {listing.founder_name}</p>
                        <p><span className="font-bold">Email:</span> {listing.founder_email}</p>
                        <p><span className="font-bold">Phone:</span> {listing.founder_phone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status & Actions */}
                  <div className="md:border-l border-gray-200 md:pl-6">
                    <div className="mb-4">
                      <p className="text-xs font-bold text-gray-600 uppercase mb-2">Price</p>
                      <p className="text-3xl font-black text-[#0F3460]">
                        ${listing.bid_usd ?? 'N/A'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {listing.position ? `Rank #${listing.position}` : 'Not ranked'}
                        {listing.amount_pkr ? ` · PKR ${listing.amount_pkr.toLocaleString()}` : ''}
                        {listing.payment_method ? ` · ${listing.payment_method}` : ''}
                      </p>
                      {listing.payment_status === 'active' && listing.expires_at && (
                        <p className="text-xs text-gray-600 mt-1">Until {new Date(listing.expires_at).toLocaleDateString()}</p>
                      )}
                      <p className={`text-xs font-bold mt-2 ${listing.payment_verified_at ? 'text-green-700' : 'text-gray-500'}`}>
                        {listing.payment_verified_at
                          ? `✓ Paid ${new Date(listing.payment_verified_at).toLocaleString()}`
                          : 'Not paid yet'}
                      </p>
                      {listing.stripe_url && (
                        <a href={listing.stripe_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#635BFF] hover:underline">
                          View in Stripe ↗
                        </a>
                      )}
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-bold text-gray-600 uppercase mb-2">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-lg font-bold text-xs ${
                        STATUS_STYLES[listing.payment_status] || 'bg-red-100 text-red-700'
                      }`}>
                        {listing.payment_status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    {listing.payment_status === 'pending' && (
                      <div className="flex gap-2 flex-col">
                        <button
                          onClick={() => handleApprove(listing.id)}
                          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(listing.id)}
                          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}

                    {listing.approved_at && (
                      <div className="text-xs text-gray-600 mt-4 pt-4 border-t border-gray-200">
                        <p>Approved by: {listing.approved_by}</p>
                        <p>On: {new Date(listing.approved_at).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg font-bold text-sm animate-in fade-in ${
              toast.type === 'success'
                ? 'bg-green-100 text-green-700'
                : toast.type === 'error'
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
