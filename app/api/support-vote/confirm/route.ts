import { after, NextRequest, NextResponse } from 'next/server';
import { getListing, recordVote, sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';
import { notifyVote, snapshotListing } from '@/lib/server/vote-notify';
import { isCrossSiteWrite } from '@/lib/server/session';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { claimPendingSupportVote } from '@/lib/server/support-confirm';

// POST { token }: the guest clicked the emailed link, so their support vote counts now.

// PostgREST answers 404 / PGRST205 when the supporters table hasn't been created yet.
function isMissingTable(status: number, body: string) {
  return status === 404 || body.includes('PGRST205') || body.includes('does not exist');
}

export async function POST(req: NextRequest) {
  if (isCrossSiteWrite(req)) {
    return NextResponse.json({ error: 'Cross-site request refused' }, { status: 403 });
  }
  try {
    if (!supabaseConfigured()) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    const { token } = await req.json().catch(() => ({}));
    if (typeof token !== 'string' || !token || token.length > 200) {
      return NextResponse.json({ error: 'This confirmation link is invalid.' }, { status: 400 });
    }
    if (!(await rateLimit(`support-confirm-ip:${ipHash(req)}`, 30, 60 * 60))) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const pending = await claimPendingSupportVote(token);
    if (!pending) {
      return NextResponse.json({ error: 'This confirmation link has expired or was already used. Vote again from the support link to get a new one.' }, { status: 400 });
    }
    const listing = await getListing(pending.listing_id);
    if (!listing) return NextResponse.json({ error: 'This product is no longer listed.' }, { status: 404 });

    const firstName = pending.name.split(' ')[0];
    const before = await snapshotListing(listing.id);
    const result = await recordVote(listing.id, pending.voter_id);
    if (result.status === 'duplicate') {
      return NextResponse.json({ success: true, alreadyCounted: true, listingId: listing.id, title: listing.title, name: firstName });
    }
    if (before) after(() => notifyVote(before, result.totalVotes, pending.voter_id));

    // Supporter details are best-effort: the vote above already counts even if this table is missing.
    const supporterRes = await fetch(sbUrl('supporters'), {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ listing_id: listing.id, name: pending.name, email: pending.email, support_type: pending.support_type }),
    });
    if (!supporterRes.ok) {
      const text = await supporterRes.text();
      if (isMissingTable(supporterRes.status, text)) {
        console.warn('[support-vote] supporters table missing; run supabase/migrations/add_supporters.sql');
      } else {
        console.error('[support-vote] failed to save supporter:', supporterRes.status, text);
      }
    }

    return NextResponse.json({ success: true, listingId: listing.id, title: listing.title, name: firstName, totalVotes: result.totalVotes });
  } catch (error) {
    console.error('[support-vote] confirm error:', error);
    return NextResponse.json({ error: 'Could not confirm your vote. Please try again.' }, { status: 500 });
  }
}
