import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/site';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const revalidate = 0; // Don't cache

type SnapshotEntry = { rank: number; listing: { id: string; title: string; url: string }; votes: number };
type Snapshot = { id: string; date: string; data: SnapshotEntry[]; frozen: boolean };
type SnapshotRow = { id: string; date: string; snapshot_data: SnapshotEntry[] | null };

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

    let snapshots: Snapshot[] = [];

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
        const rows = historicalSnapshots as SnapshotRow[];
        const allEntries = rows.flatMap(snapshot => snapshot.snapshot_data || []);
        const existing = await existingListingIds(allEntries.map(e => String(e.listing?.id)));
        const cleaned = rows.map(snapshot => ({
          id: snapshot.id,
          date: snapshot.date,
          data: withoutDeletedListings(snapshot.snapshot_data || [], existing),
          frozen: true,
        }));
        // Days whose every listing was deleted have nothing left to show.
        snapshots = cleaned.filter(s => s.data.length > 0);
      }

      // Today's live rankings: the top 100 listings by today's votes, ties to whoever got there first.
      const { data: topListingsToday, error: todayError } = await supabase
        .from('listings')
        .select('id, title, location, day_votes')
        .gt('day_votes', 0)
        .order('day_votes', { ascending: false })
        .order('rank_reached_at', { ascending: true })
        .limit(100);
      if (todayError) console.error('Error fetching today\'s rankings:', todayError);

      if (topListingsToday && topListingsToday.length > 0) {
        const todaySnapshotData: Snapshot = {
          id: 'today-live',
          date: todayStr,
          data: topListingsToday.map((listing, idx) => ({
            rank: idx + 1,
            listing: {
              id: listing.id,
              title: listing.title,
              url: listing.location || `${SITE_URL}/product/${listing.id}`,
            },
            votes: listing.day_votes || 0,
          })),
          frozen: false,
        };

        // Live data replaces a stored copy of today; otherwise it goes first.
        if (snapshots.some(s => s.date === todayStr)) {
          snapshots = snapshots.map(s => (s.date === todayStr ? todaySnapshotData : s));
        } else {
          snapshots.unshift(todaySnapshotData);
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
