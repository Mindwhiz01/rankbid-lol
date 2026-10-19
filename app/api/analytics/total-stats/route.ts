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
    // Get all historical stats
    const { data: stats, error } = await supabase
      .from('visitor_analytics')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }

    const totalPageViews = stats?.reduce((sum, day) => sum + (day.page_views || 0), 0) || 0;

    // For unique visitors, count unique session IDs instead of summing daily counts
    // head: true returns no rows, only the count, so read `count` rather than data.length.
    const { count: sessionCount, error: sessionError } = await supabase
      .from('visitor_sessions')
      .select('session_id', { count: 'exact', head: true });

    if (sessionError) {
      console.error('Error fetching unique sessions:', sessionError);
    }

    const totalVisitors = sessionCount || 0;

    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const { data: todayStats } = await supabase
      .from('visitor_analytics')
      .select('*')
      .eq('date', today)
      .single();

    const result = {
      totalVisitors,
      totalPageViews,
      todayVisitors: todayStats?.total_visitors || 0,
      todayPageViews: todayStats?.page_views || 0,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result, { headers: CDN_CACHE });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({
      totalVisitors: 0,
      totalPageViews: 0,
      todayVisitors: 0,
      todayPageViews: 0,
    }, { status: 500 });
  }
}
