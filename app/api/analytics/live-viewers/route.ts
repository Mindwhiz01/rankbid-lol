import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

// Every open page polls this; let the CDN answer repeats so the function runs about twice a minute.
const CDN_CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' };

export async function GET() {
  try {
    // Get active sessions in the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from('visitor_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_activity', thirtyMinutesAgo)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching live viewers:', error);
      throw error;
    }

    const liveCount = count || 0;

    return NextResponse.json({
      liveViewers: liveCount,
      timestamp: new Date().toISOString(),
    }, { headers: CDN_CACHE });
  } catch (error) {
    console.error('Error fetching live viewers:', error);
    return NextResponse.json(
      { liveViewers: 0 },
      { status: 500 }
    );
  }
}
