import { after, NextRequest, NextResponse } from 'next/server';
import { getListing, recordVote, removeVote, sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';
import { notifyVote, snapshotListing } from '@/lib/server/vote-notify';
import { getSessionUser } from '@/lib/server/session';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';

// Signed-in voting. The voter is whoever owns the session cookie; ids sent by the browser are ignored.

async function hasUserVote(userId: string, listingId: string): Promise<boolean> {
  const res = await fetch(
    sbUrl(`user_votes?user_id=eq.${encodeURIComponent(userId)}&listing_id=eq.${encodeURIComponent(listingId)}&select=id`),
    { headers: sbHeaders(), cache: 'no-store' }
  );
  const rows = res.ok ? await res.json() : [];
  return Array.isArray(rows) && rows.length > 0;
}

// Voting and unvoting one product over and over churns its rank. This applies to every account,
// including RATE_LIMIT_EXEMPT_USERS testers.
const TOGGLE_MESSAGE = 'You’re changing your vote on this product too quickly. Please wait a few minutes.';
const toggleAllowed = (userId: string, listingId: string) => rateLimit(`vote-toggle:${userId}:${listingId}`, 6, 10 * 60);

export async function POST(req: NextRequest) {
  try {
    if (!supabaseConfigured()) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to vote' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : '';
    if (!listingId || listingId.length > 100) {
      return NextResponse.json({ error: 'Missing listingId' }, { status: 400 });
    }

    // Slows down scripted voting from many accounts on one network. The checks are independent, so they
    // run together (each is one database call), as do the three reads below.
    const [ipOk, userOk, toggleOk] = await Promise.all([
      rateLimit(`vote-ip:${ipHash(req)}`, 30, 60 * 60),
      rateLimit(`vote-user:${user.id}`, 60, 60 * 60),
      toggleAllowed(user.id, listingId),
    ]);
    if (!ipOk || !userOk) {
      return NextResponse.json({ error: 'Too many votes. Please try again later.' }, { status: 429 });
    }
    if (!toggleOk) {
      return NextResponse.json({ error: TOGGLE_MESSAGE }, { status: 429 });
    }

    const [listing, alreadyVoted, before] = await Promise.all([
      getListing(listingId),
      hasUserVote(user.id, listingId),
      snapshotListing(listingId),
    ]);
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (alreadyVoted) {
      return NextResponse.json({ error: 'Already voted', voted: true }, { status: 400 });
    }

    const result = await recordVote(listing.id, `user:${user.id}`);
    if (result.status === 'duplicate') {
      return NextResponse.json({ error: 'Already voted', voted: true }, { status: 400 });
    }
    if (before) after(() => notifyVote(before, result.totalVotes, `user:${user.id}`));

    const userVoteRes = await fetch(sbUrl('user_votes'), {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({
        id: `uv_${crypto.randomUUID()}`,
        user_id: user.id,
        listing_id: listing.id,
        voted_at: new Date().toISOString(),
      }),
    });
    if (!userVoteRes.ok) {
      console.error('Failed to insert user vote:', userVoteRes.status, await userVoteRes.text());
    }

    return NextResponse.json(
      { success: true, voted: true, totalVotes: result.totalVotes, dayVotes: result.dayVotes },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error recording vote:', error);
    return NextResponse.json(
      { error: 'Failed to record vote. Please try again later.' },
      { status: 500 }
    );
  }
}

// DELETE { listingId } — the signed-in user takes back their vote.
export async function DELETE(req: NextRequest) {
  try {
    if (!supabaseConfigured()) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : '';
    if (!listingId || listingId.length > 100) {
      return NextResponse.json({ error: 'Missing listingId' }, { status: 400 });
    }

    // Shares the vote limit, so voting and unvoting can't be looped to churn the rankings.
    const [userOk, toggleOk, listing] = await Promise.all([
      rateLimit(`vote-user:${user.id}`, 60, 60 * 60),
      toggleAllowed(user.id, listingId),
      getListing(listingId),
    ]);
    if (!userOk) {
      return NextResponse.json({ error: 'Too many changes. Please try again later.' }, { status: 429 });
    }
    if (!toggleOk) {
      return NextResponse.json({ error: TOGGLE_MESSAGE }, { status: 429 });
    }

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const [, counts] = await Promise.all([
      fetch(
        sbUrl(`user_votes?user_id=eq.${encodeURIComponent(user.id)}&listing_id=eq.${encodeURIComponent(listing.id)}`),
        { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=minimal' }) }
      ),
      removeVote(listing.id, `user:${user.id}`),
    ]);

    return NextResponse.json({ success: true, voted: false, ...counts });
  } catch (error) {
    console.error('Error removing vote:', error);
    return NextResponse.json({ error: 'Failed to remove vote. Please try again later.' }, { status: 500 });
  }
}

// GET ?listingId — vote count, and whether the signed-in user has voted.
export async function GET(req: NextRequest) {
  const listingId = req.nextUrl.searchParams.get('listingId');
  if (!listingId) {
    return NextResponse.json({ error: 'Missing listingId' }, { status: 400 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ voteCount: 0, userVoted: false });
  }

  try {
    const id = encodeURIComponent(listingId);
    const countRes = await fetch(sbUrl(`votes?listing_id=eq.${id}&select=id`), {
      method: 'HEAD',
      headers: sbHeaders({ Prefer: 'count=exact' }),
      cache: 'no-store',
    });
    const voteCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0') || 0;

    const user = await getSessionUser(req);
    const userVoted = user ? await hasUserVote(user.id, listingId) : false;

    return NextResponse.json({ voteCount, userVoted });
  } catch (error) {
    console.error('Error fetching votes:', error);
    return NextResponse.json({ voteCount: 0, userVoted: false });
  }
}
