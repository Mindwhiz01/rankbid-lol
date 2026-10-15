// Server-only admin helpers: who counts as an admin, and the data the admin dashboard reads.
import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { getSessionUser } from '@/lib/server/session';

// Only list addresses that already have an account: signups aren't email-verified, so an unregistered
// address here would let anyone register it and become admin.
export const ADMIN_EMAILS = [
  'assadullahnouman@gmail.com',
];

export const ADMIN_COOKIE = 'adminKey';

// Listings submitted without a signed-in user get this placeholder user_id (see /api/listings/submit).
export const ANONYMOUS_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** True when `key` matches ADMIN_KEY. There is no fallback key: an unset ADMIN_KEY disables key access. */
export function isValidAdminKey(key: string | null | undefined): boolean {
  const expected = process.env.ADMIN_KEY;
  return Boolean(expected && key && safeEqual(key, expected));
}

/**
 * Value stored in the adminKey cookie: derived from ADMIN_KEY so the cookie never holds the key itself.
 * Changing ADMIN_KEY signs every admin browser out.
 */
export function adminCookieValue(): string | null {
  const key = process.env.ADMIN_KEY;
  return key ? createHmac('sha256', key).update('rankbid-admin-session').digest('hex') : null;
}

export function isValidAdminCookie(value: string | null | undefined): boolean {
  const expected = adminCookieValue();
  return Boolean(expected && value && safeEqual(value, expected));
}

// ---- Team admins ----
// Up to MAX_TEAM_ADMINS extra people the owner shares the dashboard with, stored as an email list
// in site_settings (key 'admin_team'). Their accounts are created by the owner with a password,
// so nobody can claim one of these addresses by signing up first.

export const MAX_TEAM_ADMINS = 3;
const TEAM_KEY = 'admin_team';
const TEAM_CACHE_MS = 15_000;
let teamCache: { emails: string[]; at: number } | null = null;

export async function getTeamAdminEmails(): Promise<string[]> {
  if (teamCache && Date.now() - teamCache.at < TEAM_CACHE_MS) return teamCache.emails;
  let emails: string[] = [];
  try {
    const res = await fetch(sbUrl(`site_settings?key=eq.${TEAM_KEY}&select=value`), { headers: sbHeaders(), cache: 'no-store' });
    if (res.ok) {
      const [row] = await res.json();
      if (Array.isArray(row?.value)) emails = row.value.filter((e: unknown): e is string => typeof e === 'string');
    }
  } catch (e) {
    console.error('Failed to read admin team:', e);
  }
  teamCache = { emails, at: Date.now() };
  return emails;
}

export async function setTeamAdminEmails(emails: string[]): Promise<void> {
  const res = await fetch(sbUrl('site_settings?on_conflict=key'), {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ key: TEAM_KEY, value: emails, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Failed to save admin team: ${await res.text()}`);
  teamCache = { emails, at: Date.now() };
}

/**
 * The owner: holds the admin key (header or cookie) or is signed in with an ADMIN_EMAILS address.
 * Only the owner can add or remove team admins.
 */
export async function isOwnerRequest(req: NextRequest): Promise<boolean> {
  if (isValidAdminKey(req.headers.get('x-admin-key')) || isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return true;
  }
  const user = await getSessionUser(req);
  return Boolean(user && ADMIN_EMAILS.includes(user.email));
}

/**
 * An admin request comes from the owner (see isOwnerRequest) or from a signed-in user whose
 * email is on the admin team.
 */
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  if (isValidAdminKey(req.headers.get('x-admin-key')) || isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return true;
  }
  const user = await getSessionUser(req);
  if (!user) return false;
  return ADMIN_EMAILS.includes(user.email) || (await getTeamAdminEmails()).includes(user.email);
}

// ---- Data ----

export interface AdminListing {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  platform: string;
  imageUrl: string | null;
  totalVotes: number;
  dayVotes: number;
  views: number;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  submissions: number;
  submissionVotes: number;
}

type ListingRow = {
  id: string; title: string; description?: string | null; location?: string | null; url?: string | null;
  category?: string | null; platform?: string | null; image_url?: string | null;
  total_votes?: number | null; day_votes?: number | null; views?: number | null;
  user_id?: string | null; created_at: string; updated_at?: string | null;
};

export function toAdminListing(row: ListingRow): AdminListing {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    url: row.location || row.url || '',
    category: row.category || 'Other',
    platform: row.platform || 'website',
    imageUrl: row.image_url || null,
    totalVotes: row.total_votes || 0,
    dayVotes: row.day_votes || 0,
    views: row.views || 0,
    userId: row.user_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

/** GET a PostgREST path; returns rows plus the exact total from content-range. */
export async function sbSelect<T>(path: string): Promise<{ rows: T[]; total: number }> {
  const res = await fetch(sbUrl(path), { headers: sbHeaders({ Prefer: 'count=exact' }), cache: 'no-store' });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const rows: T[] = await res.json();
  const total = parseInt(res.headers.get('content-range')?.split('/')[1] || '') || rows.length;
  return { rows, total };
}

async function sbCount(path: string): Promise<number> {
  const res = await fetch(sbUrl(path), {
    method: 'HEAD',
    headers: sbHeaders({ Prefer: 'count=exact' }),
    cache: 'no-store',
  });
  if (!res.ok) return 0;
  return parseInt(res.headers.get('content-range')?.split('/')[1] || '0') || 0;
}

/** Strips anything that isn't a public profile field (never send password hashes to the browser). */
export function toAdminUser(row: Record<string, unknown>, counts?: { submissions: number; votes: number }): AdminUser {
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    name: (row.name ?? row.full_name ?? row.username ?? null) as string | null,
    createdAt: String(row.created_at ?? ''),
    submissions: counts?.submissions ?? 0,
    submissionVotes: counts?.votes ?? 0,
  };
}

/** Submission count and votes received, per user_id, across all listings. */
export async function submissionCountsByUser(): Promise<Map<string, { submissions: number; votes: number }>> {
  const { rows } = await sbSelect<{ user_id: string | null; total_votes: number | null }>(
    'listings?select=user_id,total_votes'
  );
  const counts = new Map<string, { submissions: number; votes: number }>();
  for (const row of rows) {
    if (!row.user_id) continue;
    const c = counts.get(row.user_id) ?? { submissions: 0, votes: 0 };
    c.submissions += 1;
    c.votes += row.total_votes || 0;
    counts.set(row.user_id, c);
  }
  return counts;
}

export interface LiveSnapshot {
  generatedAt: string;
  stats: {
    totalUsers: number;
    totalListings: number;
    totalVotes: number;
    submissionsToday: number;
    votesToday: number;
    usersToday: number;
  };
  leaderboard: AdminListing[];
  todayLeaderboard: AdminListing[];
  recentSubmissions: AdminListing[];
}

// Same order as the public rankings: most votes first, ties go to whoever reached the count most recently.
const RANK_ORDER = 'total_votes.desc,updated_at.desc.nullslast';
const LISTING_COLUMNS = 'id,title,description,location,category,platform,image_url,total_votes,day_votes,views,user_id,created_at,updated_at';

/** Everything the live dashboard shows: headline counts, both leaderboards and the newest submissions. */
export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const since = encodeURIComponent(today.toISOString());

  const [totalUsers, totalListings, totalVotes, submissionsToday, votesToday, usersToday, top, topToday, recent] =
    await Promise.all([
      sbCount('users?select=id'),
      sbCount('listings?select=id'),
      sbCount('votes?select=id'),
      sbCount(`listings?select=id&created_at=gte.${since}`),
      sbCount(`votes?select=id&voted_at=gte.${since}`),
      sbCount(`users?select=id&created_at=gte.${since}`),
      sbSelect<ListingRow>(`listings?select=${LISTING_COLUMNS}&order=${RANK_ORDER}&limit=10`),
      sbSelect<ListingRow>(`listings?select=${LISTING_COLUMNS}&day_votes=gt.0&order=day_votes.desc,updated_at.desc.nullslast&limit=10`),
      sbSelect<ListingRow>(`listings?select=${LISTING_COLUMNS}&order=created_at.desc&limit=15`),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    stats: { totalUsers, totalListings, totalVotes, submissionsToday, votesToday, usersToday },
    leaderboard: top.rows.map(toAdminListing),
    todayLeaderboard: topToday.rows.map(toAdminListing),
    recentSubmissions: recent.rows.map(toAdminListing),
  };
}

/** Removes a submission and every vote cast on it. Returns false when no listing had that id. */
export async function removeListing(listingId: string): Promise<boolean> {
  const id = encodeURIComponent(listingId);
  const del = (path: string) =>
    fetch(sbUrl(path), { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=representation' }) });

  await Promise.all([del(`votes?listing_id=eq.${id}`), del(`user_votes?listing_id=eq.${id}`)]);
  const res = await del(`listings?id=eq.${id}`);
  if (!res.ok) throw new Error(`Failed to delete listing: ${await res.text()}`);
  const deleted = await res.json();
  return Array.isArray(deleted) && deleted.length > 0;
}
