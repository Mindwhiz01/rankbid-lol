import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';

type UserVoteRow = { id: string; listing_id: string; voted_at: string };
type ListingRow = { id: string; title: string; description: string | null; location: string | null; total_votes: number | null };

// GET: the signed-in user's votes, newest first, with the listing each one went to.
export async function GET(request: NextRequest) {
  try {
    // Only ever the signed-in user's own data.
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!supabaseConfigured()) {
      return NextResponse.json({ votes: [] }, { status: 200 });
    }

    const votesRes = await fetch(
      sbUrl(`user_votes?user_id=eq.${encodeURIComponent(user.id)}&select=id,listing_id,voted_at&order=voted_at.desc`),
      { headers: sbHeaders(), cache: 'no-store' }
    );
    if (!votesRes.ok) {
      console.error('Failed to fetch votes from Supabase:', votesRes.status, await votesRes.text());
      return NextResponse.json({ votes: [] }, { status: 200 });
    }
    const userVotes: UserVoteRow[] = await votesRes.json();

    // Every voted listing in one request (a deleted listing simply comes back missing).
    const listings = new Map<string, ListingRow>();
    const ids = [...new Set(userVotes.map(v => String(v.listing_id)))];
    for (let i = 0; i < ids.length; i += 200) {
      const list = encodeURIComponent(ids.slice(i, i + 200).map(id => `"${id.replace(/"/g, '')}"`).join(','));
      const res = await fetch(
        sbUrl(`listings?id=in.(${list})&select=id,title,description,location,total_votes`),
        { headers: sbHeaders(), cache: 'no-store' }
      );
      if (!res.ok) {
        console.error('Failed to fetch voted listings:', res.status, await res.text());
        continue;
      }
      for (const row of (await res.json()) as ListingRow[]) listings.set(String(row.id), row);
    }

    const votes = userVotes.map(vote => {
      const l = listings.get(String(vote.listing_id));
      return {
        id: vote.id,
        listingId: vote.listing_id,
        votedAt: vote.voted_at,
        listing: l
          ? { id: l.id, title: l.title, description: l.description, url: l.location, totalVotes: l.total_votes || 0 }
          : null,
      };
    });

    return NextResponse.json({ votes }, { status: 200 });
  } catch (error) {
    console.error('Error fetching user votes:', error);
    return NextResponse.json({ error: 'Failed to fetch votes', votes: [] }, { status: 500 });
  }
}
