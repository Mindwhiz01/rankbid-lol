import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { pruneRateLimits } from '@/lib/server/rate-limit';

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without the secret set, the route stays locked. */
function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(req.headers.get('authorization') || '');
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get yesterday's date (since this runs at midnight)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Save yesterday's snapshot before resetting
    try {
      // Fetch yesterday's top listings
      const { data: allListings } = await supabase
        .from('listings')
        .select('id, title, location, day_votes')
        .order('day_votes', { ascending: false })
        .limit(100);

      if (allListings && allListings.length > 0) {
        const snapshotData = allListings
          .filter(l => (l.day_votes || 0) > 0)
          .map((listing, idx) => ({
            rank: idx + 1,
            listing: {
              id: listing.id,
              title: listing.title,
              url: listing.location,
            },
            votes: listing.day_votes || 0,
          }));

        if (snapshotData.length > 0) {
          // Check if snapshot already exists for this date
          const { data: existing } = await supabase
            .from('daily_snapshots')
            .select('id')
            .eq('date', yesterdayStr)
            .single();

          if (!existing) {
            // Insert new snapshot
            const { error: insertError } = await supabase
              .from('daily_snapshots')
              .insert({
                date: yesterdayStr,
                snapshot_data: snapshotData,
              });

            if (insertError) {
              console.error('Error saving snapshot:', insertError);
            } else {
              console.log(`Saved snapshot for ${yesterdayStr}`);
            }
          }
        }
      }
    } catch (snapshotError) {
      console.error('Error creating snapshot:', snapshotError);
    }

    // Reset day_votes to 0 for all listings
    const response = await fetch(
      `${supabaseUrl}/rest/v1/listings?day_votes=gt.-1`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          day_votes: 0,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Supabase update error:', error);
      throw new Error(error.message || 'Failed to reset daily votes');
    }

    const result = await response.json();
    const updatedCount = Array.isArray(result) ? result.length : 0;

    await pruneRateLimits();

    console.log(`Cron job: Reset day_votes for ${updatedCount} listings at ${new Date().toISOString()}`);

    return NextResponse.json(
      {
        success: true,
        message: `Saved snapshot for ${yesterdayStr} and reset day_votes for ${updatedCount} listings`,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset daily votes',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
