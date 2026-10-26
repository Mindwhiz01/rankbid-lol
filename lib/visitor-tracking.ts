import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Records one page view: refreshes (or starts) the visitor session and bumps today's counts.
 * One database call through track_visit (supabase/migrations/perf_rpc_indexes.sql).
 */
export async function trackVisitor(sessionId: string, userAgent: string, ipAddress: string, pageUrl: string) {
  const { error } = await supabase.rpc('track_visit', {
    p_session_id: sessionId,
    p_user_agent: userAgent,
    p_ip: ipAddress,
    p_page_url: pageUrl,
  });
  if (!error) return { success: true };
  // PGRST202: the function isn't installed yet.
  if (error.code !== 'PGRST202') {
    console.error('track_visit failed:', error);
    return { success: false, error };
  }
  return trackVisitorLegacy(sessionId, userAgent, ipAddress, pageUrl);
}

/** The same counts in four requests, for a database without track_visit. */
async function trackVisitorLegacy(sessionId: string, userAgent: string, ipAddress: string, pageUrl: string) {
  try {
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    const { data: existingSession } = await supabase
      .from('visitor_sessions')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle();

    const isNewSession = !existingSession;
    const { error: sessionError } = isNewSession
      ? await supabase.from('visitor_sessions').insert({
          session_id: sessionId,
          user_agent: userAgent,
          ip_address: ipAddress,
          page_url: pageUrl,
          last_activity: now,
          is_active: true,
        })
      : await supabase.from('visitor_sessions').update({ last_activity: now, page_url: pageUrl, is_active: true }).eq('session_id', sessionId);
    if (sessionError) console.error('Error saving visitor session:', sessionError);

    const { data: existing, error: getError } = await supabase
      .from('visitor_analytics')
      .select('total_visitors, page_views')
      .eq('date', today)
      .maybeSingle();
    if (getError) throw getError;

    // No updated_at here: the production visitor_analytics table doesn't have that column (PGRST204).
    const { error: countError } = existing
      ? await supabase
          .from('visitor_analytics')
          .update({
            page_views: existing.page_views + 1,
            ...(isNewSession ? { total_visitors: existing.total_visitors + 1 } : {}),
          })
          .eq('date', today)
      : await supabase.from('visitor_analytics').insert({
          date: today,
          total_visitors: isNewSession ? 1 : 0,
          unique_visitors: isNewSession ? 1 : 0,
          page_views: 1,
        });
    if (countError) console.error('Error saving visitor analytics:', countError);

    return { success: true };
  } catch (error) {
    console.error('Visitor tracking error:', error);
    return { success: false, error };
  }
}
