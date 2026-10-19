import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/site';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const revalidate = 0; // Don't cache

type SnapshotEntry = { rank: number; listing: { id: string; title: string; url: string }; votes: number };

/**
 * Saved days keep a copy of that day's rankings, so a listing deleted later would still show.
 * Keep only entries whose listing still exists and renumber the ranks; the stored copy is untouched.
 */
function withoutDeletedListings(entries: SnapshotEntry[], existing: Set<string>): SnapshotEntry[] {
  return entries
    .filter(e => existing.has(String(e.listing?.id)))
    .sort((a, b) => a.rank - b.rank)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

/** Which of these listing ids still exist. */
async function existingListingIds(ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await supabase.from('listings').select('id').in('id', unique.slice(i, i + 200));
    for (const row of data || []) found.add(String(row.id));
  }
  return found;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysBack = Math.min(3650, Math.max(1, parseInt(searchParams.get('daysBack') || '30') || 30));

    let snapshots: any[] = [];

    // Get today's date and start date
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    try {
      // Fetch historical snapshots from database
      const { data: historicalSnapshots, error: dbError } = await supabase
        .from('daily_snapshots')
        .select('*')
        .gte('date', startDateStr)
        .order('date', { ascending: false });

      if (!dbError && historicalSnapshots) {
        const allEntries: SnapshotEntry[] = historicalSnapshots.flatMap((snapshot: any) => snapshot.snapshot_data || []);
        const existing = await existingListingIds(allEntries.map(e => String(e.listing?.id)));
        const cleaned = historicalSnapshots.map((snapshot: any) => ({
          id: snapshot.id,
          date: snapshot.date,
          data: withoutDeletedListings(snapshot.snapshot_data || [], existing),
          frozen: true,
        }));
        // Days whose every listing was deleted have nothing left to show.
        snapshots = cleaned.filter(s => s.data.length > 0);
      }

      // Fetch today's live data
      const origin = new URL(request.url).origin;
      const listingsRes = await fetch(
        `${origin}/api/listings/submit?limit=1000&sort=dayVotes&activeToday=1`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (listingsRes.ok) {
        const data = await listingsRes.json();
        const listings = data.listings || [];

        // Filter listings with day_votes > 0 and sort by day_votes descending
        const topListingsToday = listings
          .filter((l: any) => (l.dayVotes || 0) > 0)
          .sort((a: any, b: any) => (b.dayVotes || 0) - (a.dayVotes || 0))
          .slice(0, 100);

        // If there are listings with votes, create today's snapshot
        if (topListingsToday && topListingsToday.length > 0) {
          const todaySnapshotData = {
            id: 'today-live',
            date: todayStr,
            data: topListingsToday.map((listing: any, idx: number) => ({
              rank: idx + 1,
              listing: {
                id: listing.id,
                title: listing.title,
                url: listing.url || `${SITE_URL}/product/${listing.id}`,
              },
              votes: listing.dayVotes || 0,
            })),
            frozen: false,
          };

          // Check if today's snapshot already exists in DB
          const todayExists = snapshots.some(s => s.date === todayStr);

          if (!todayExists) {
            // Add today's live snapshot at the beginning
            snapshots.unshift(todaySnapshotData);
          } else {
            // Replace the stored today's snapshot with fresh data
            snapshots = snapshots.map(s =>
              s.date === todayStr ? todaySnapshotData : s
            );
          }
        }
      }
    } catch (error) {
      console.error('Error fetching snapshots:', error);
    }

    return NextResponse.json({
      snapshots: snapshots,
      totalDays: snapshots.length,
    });
  } catch (error) {
    console.error('Error fetching daily snapshots:', error);
    return NextResponse.json(
      {
        snapshots: [],
        error: 'Failed to fetch daily snapshots'
      },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // This endpoint could be used by a cron job to create permanent snapshots
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const origin = new URL(request.url).origin;

    try {
      // Get today's top listings
      const listingsRes = await fetch(
        `${origin}/api/listings/submit?limit=1000&sort=dayVotes`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!listingsRes.ok) {
        return NextResponse.json({ message: 'Could not fetch listings' }, { status: 200 });
      }

      const data = await listingsRes.json();
      const listings = data.listings || [];
      const topListings = listings
        .filter((l: any) => (l.dayVotes || 0) > 0)
        .sort((a: any, b: any) => (b.dayVotes || 0) - (a.dayVotes || 0))
        .slice(0, 100);

      return NextResponse.json({
        message: 'Daily snapshot data available',
        count: topListings.length
      });
    } catch (error) {
      console.error('Error creating snapshot:', error);
      return NextResponse.json({ message: 'Could not create snapshot' }, { status: 200 });
    }
  } catch (error) {
    console.error('Error in POST daily snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to create daily snapshot' },
      { status: 500 }
    );
  }
}
