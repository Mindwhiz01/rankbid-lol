import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const revalidate = 0;

interface TimeStats {
  period: string;
  visitors: number;
  pageViews: number;
  averageVisitorsPerDay?: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily'; // daily, weekly, monthly

    const now = new Date();
    let startDate = new Date();
    let label = '';

    switch (period) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        label = 'Today';
        break;
      case 'weekly':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        label = 'This Week';
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        label = 'This Month';
        break;
      case 'all':
        startDate = new Date(0);
        label = 'All Time';
        break;
    }

    const startIso = startDate.toISOString();
    const dateStr = startDate.toISOString().split('T')[0];

    console.log(`[FILTERED STATS] Period: ${period}, StartDate: ${startIso}`);

    // Get visitors for the period - try both ways
    let visitorsCount = 0;

    // Method 1: Try to get count with exact count
    const { count, error: countError } = await supabase
      .from('visitor_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startIso);

    if (count !== null && count !== undefined) {
      visitorsCount = count;
      console.log(`[FILTERED STATS] Got visitor count: ${visitorsCount}`);
    } else if (!countError) {
      // If count query worked but returned null/undefined, try to fetch and count
      const { data: sessions, error: sessionsError } = await supabase
        .from('visitor_sessions')
        .select('id')
        .gte('created_at', startIso);

      if (sessionsError) {
        console.error('[FILTERED STATS] Sessions error:', sessionsError);
        throw sessionsError;
      }

      visitorsCount = sessions?.length || 0;
      console.log(`[FILTERED STATS] Counted sessions: ${visitorsCount}`);
    } else {
      console.error('[FILTERED STATS] Count error:', countError);
      throw countError;
    }

    // Get analytics data for the period to calculate page views
    const { data: analyticsData, error: analyticsError } = await supabase
      .from('visitor_analytics')
      .select('total_visitors, page_views, date')
      .gte('date', dateStr);

    if (analyticsError) {
      console.error('[FILTERED STATS] Analytics error:', analyticsError);
      throw analyticsError;
    }

    const visitors = visitorsCount;
    const pageViews = analyticsData?.reduce((sum, day) => sum + (day.page_views || 0), 0) || 0;

    console.log(`[FILTERED STATS] Calculated: visitors=${visitors}, pageViews=${pageViews}`);

    // Calculate average visitors per day for longer periods
    let averageVisitorsPerDay = visitors;
    if (period === 'weekly') {
      averageVisitorsPerDay = Math.round(visitors / 7);
    } else if (period === 'monthly') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      averageVisitorsPerDay = Math.round(visitors / daysInMonth);
    }

    const result: TimeStats = {
      period,
      visitors,
      pageViews,
      ...(period !== 'daily' && { averageVisitorsPerDay }),
    };

    console.log(`[FILTERED STATS] ${period}:`, result);

    return NextResponse.json(result);
  } catch (error) {
    // Database details stay in the server log; this endpoint is public.
    console.error('[FILTERED STATS] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch filtered stats',
        period: 'unknown',
        visitors: 0,
        pageViews: 0,
      },
      { status: 500 }
    );
  }
}
