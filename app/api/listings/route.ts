import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** The listings columns this route returns. */
type ListingRow = {
  id: string; title: string; description: string | null; location: string | null; url?: string | null;
  category: string | null; platform: string | null; total_votes: number | null; day_votes: number | null;
  click_count: number | null; created_at: string; updated_at: string | null;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || 'All';
  const timeWindow = searchParams.get('window') || 'alltime';
  const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '100') || 100));
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

  try {
    const sb = getSupabase();
    let query = sb.from('listings').select('*');

    // Filter by category
    if (category !== 'All') {
      query = query.eq('category', category);
    }

    // Order by appropriate field
    if (timeWindow === 'today') {
      query = query.order('day_votes', { ascending: false }).order('rank_reached_at', { ascending: true });
    } else if (timeWindow === 'alltime') {
      query = query.order('total_votes', { ascending: false }).order('rank_reached_at', { ascending: true });
    } else {
      return NextResponse.json({ error: 'Invalid time window' }, { status: 400 });
    }

    // Paginate
    query = query.range(offset, offset + limit - 1);

    const { data: listings, error } = await query;

    if (error) throw error;

    const rankedListings = ((listings || []) as ListingRow[]).map((listing, index) => ({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      url: listing.location || listing.url,
      category: listing.category,
      platform: listing.platform || 'website',
      totalVotes: listing.total_votes || 0,
      dayVotes: listing.day_votes || 0,
      clickCount: listing.click_count || 0,
      createdAt: listing.created_at,
      updatedAt: listing.updated_at,
      rank: offset + index + 1,
      votesToOutrank: (timeWindow === 'today' ? (listing.day_votes || 0) : (listing.total_votes || 0)) + 1,
    }));

    return NextResponse.json(rankedListings);
  } catch (error) {
    console.error('Error fetching listings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
