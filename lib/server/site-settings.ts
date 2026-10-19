// Server-only site switches stored in the `site_settings` table (see supabase/migrations/add_site_settings.sql).
import { sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';

// The proxy reads this on every page request, so keep it in memory briefly.
// Other server instances pick up a change within this window.
const CACHE_MS = 60_000;
let cached: { value: boolean; at: number } | null = null;

/**
 * True when every visitor (except admins) should see the coming soon page.
 * Defaults to on when the setting can't be read, so the site never opens by accident.
 */
export async function isComingSoonEnabled(): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  let value = true;
  if (supabaseConfigured()) {
    try {
      const res = await fetch(sbUrl('site_settings?key=eq.coming_soon&select=value'), {
        headers: sbHeaders(),
        cache: 'no-store',
      });
      if (res.ok) {
        const [row] = await res.json();
        if (row) value = row.value !== false;
      }
    } catch (e) {
      console.error('Failed to read coming_soon setting:', e);
    }
  }
  cached = { value, at: Date.now() };
  return value;
}

export async function setComingSoonEnabled(enabled: boolean): Promise<void> {
  const res = await fetch(sbUrl('site_settings?on_conflict=key'), {
    method: 'POST',
    headers: sbHeaders({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify({ key: 'coming_soon', value: enabled, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Failed to save setting: ${await res.text()}`);
  cached = { value: enabled, at: Date.now() };
}
