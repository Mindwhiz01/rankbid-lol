// Server-only admin helpers: who counts as an admin, and the data the admin dashboard reads.
import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { getSessionUser, isCrossSiteWrite, type SessionUser } from '@/lib/server/session';
import { hasAdminSecondFactor } from '@/lib/server/admin-2fa';

// Only list addresses that already have an account: signups aren't email-verified, so an unregistered
// address here would let anyone register it and become admin.
export const ADMIN_EMAILS = [
  'assadullahnouman@gmail.com',
];

// Listings submitted without a signed-in user get this placeholder user_id (see /api/listings/submit).
export const ANONYMOUS_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

// ---- Team admins ----
// Up to MAX_TEAM_ADMINS extra people the owner shares the dashboard with, stored as an email list
// in site_settings (key 'admin_team'). Their accounts are created when the owner invites them (the
// invitee then sets a password from the emailed link), so nobody can claim one by signing up first.

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
 * The signed-in user when their account is the owner's or a team admin's, whether or not they have
 * entered this sign-in's emailed code yet. Use isAdminRequest to authorize admin actions.
 */
export async function adminAccount(req: NextRequest): Promise<SessionUser | null> {
  if (isCrossSiteWrite(req)) return null;
  const user = await getSessionUser(req);
  return user && (await isAdminEmail(user.email)) ? user : null;
}

/**
 * The owner: signed in with an ADMIN_EMAILS account and past the emailed-code step.
 * Only the owner can add or remove team admins and switch the coming soon page.
 */
export async function isOwnerRequest(req: NextRequest): Promise<boolean> {
  if (isCrossSiteWrite(req) || !hasAdminSecondFactor(req)) return false;
  const user = await getSessionUser(req);
  return Boolean(user && ADMIN_EMAILS.includes(user.email));
}

/**
 * An admin request comes from the owner or a team admin, signed in with their own account and past
 * the emailed-code step. There is no shared admin password.
 */
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  if (!hasAdminSecondFactor(req)) return false;
  return Boolean(await adminAccount(req));
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
  phone: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  /** How the account signs in: a password, or Google only (no password set yet). */
  signIn: 'password' | 'google';
  /** The owner or a team admin: only the owner may edit these accounts. */
  isAdmin: boolean;
  /** When an admin blocked the account (it can't sign in), else null. */
  blockedAt: string | null;
  blockedReason: string | null;
  /** False for an email signup that hasn't opened its confirmation link yet. */
  emailVerified: boolean;
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
/** True for the owner's address or a team admin's. */
export async function isAdminEmail(email: string): Promise<boolean> {
  const e = email.toLowerCase();
  return ADMIN_EMAILS.includes(e) || (await getTeamAdminEmails()).includes(e);
}

/** Never includes the password hash. */
export function toAdminUser(row: Record<string, unknown>, counts?: { submissions: number; votes: number }, adminEmails: string[] = []): AdminUser {
  const email = String(row.email ?? '');
  const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {
    id: String(row.id),
    email,
    name: (row.name ?? row.full_name ?? row.username ?? null) as string | null,
    phone: text(row.phone),
    city: text(row.city),
    country: text(row.country),
    bio: text(row.bio),
    signIn: row.password === 'google_oauth' ? 'google' : 'password',
    isAdmin: adminEmails.includes(email.toLowerCase()),
    blockedAt: text(row.blocked_at),
    blockedReason: text(row.blocked_reason),
    emailVerified: !('email_verified_at' in row) || Boolean(row.email_verified_at),
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

// Same order as the public rankings: most votes first, ties go to whichever reached that count first (queue order).
const RANK_ORDER = 'total_votes.desc,rank_reached_at.asc';
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
      sbSelect<ListingRow>(`listings?select=${LISTING_COLUMNS}&day_votes=gt.0&order=day_votes.desc,rank_reached_at.asc&limit=10`),
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

/** Removes a submission and every vote cast on it. Returns the deleted row, or null when no listing had that id. */
export async function removeListing(listingId: string): Promise<Record<string, unknown> | null> {
  const id = encodeURIComponent(listingId);
  const del = (path: string) =>
    fetch(sbUrl(path), { method: 'DELETE', headers: sbHeaders({ Prefer: 'return=representation' }) });

  await Promise.all([del(`votes?listing_id=eq.${id}`), del(`user_votes?listing_id=eq.${id}`)]);
  const res = await del(`listings?id=eq.${id}`);
  if (!res.ok) throw new Error(`Failed to delete listing: ${await res.text()}`);
  const deleted = await res.json();
  // Drop the cached pages that showed it, so its URL 404s and it leaves the sitemap right away.
  revalidatePath(`/product/${listingId}`);
  revalidatePath('/categories/[slug]', 'page');
  revalidatePath('/');
  revalidatePath('/sitemap.xml');
  return Array.isArray(deleted) && deleted.length > 0 ? deleted[0] : null;
}
