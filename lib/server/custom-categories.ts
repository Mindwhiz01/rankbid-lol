// Server-only: categories people added by picking "Other" and typing a name on the submit form.
// Stored as a list of names in site_settings (key 'custom_categories'); listings store the name itself.
import { unstable_rethrow } from 'next/navigation';
import { CATEGORIES, categorySlug, cleanCustomCategory } from '@/lib/categories';
import { sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';

const KEY = 'custom_categories';
const CACHE_MS = 30_000;
const MAX_CUSTOM = 200;
let cache: { names: string[]; at: number } | null = null;

export async function getCustomCategories(): Promise<string[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.names;
  let names: string[] = [];
  if (supabaseConfigured()) {
    try {
      const res = await fetch(sbUrl(`site_settings?key=eq.${KEY}&select=value`), { headers: sbHeaders(), cache: 'no-store' });
      if (res.ok) {
        const [row] = await res.json();
        if (Array.isArray(row?.value)) names = row.value.filter((n: unknown): n is string => typeof n === 'string');
      }
    } catch (e) {
      // Next.js signals "render this page dynamically" by throwing from fetch; let that through.
      unstable_rethrow(e);
      console.error('Failed to read custom categories:', e);
    }
  }
  cache = { names, at: Date.now() };
  return names;
}

/**
 * Resolves a typed category name to the value to store, saving it for everyone when it's new.
 * Returns null when the name isn't allowed (see cleanCustomCategory).
 */
export async function addCustomCategory(raw: string): Promise<string | null> {
  const name = cleanCustomCategory(raw);
  if (!name) return null;
  // A name matching a built-in category came back as that category; nothing to save.
  if (CATEGORIES.includes(name)) return name;
  cache = null;
  const names = await getCustomCategories();
  const existing = names.find(n => categorySlug(n) === categorySlug(name));
  if (existing) return existing;
  if (names.length >= MAX_CUSTOM) return null;
  const next = [...names, name].sort((a, b) => a.localeCompare(b));
  const res = await fetch(sbUrl('site_settings?on_conflict=key'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ key: KEY, value: next, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Failed to save category: ${await res.text()}`);
  cache = { names: next, at: Date.now() };
  return name;
}
