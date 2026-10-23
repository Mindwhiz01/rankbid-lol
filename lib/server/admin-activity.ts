// Server-only: the admin activity log (supabase/migrations/admin_activity.sql). Every admin write
// records who did it, what changed and, for deletions, a full copy of what was removed.
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE, isValidAdminCookie, isValidAdminKey } from '@/lib/server/admin';
import { getSessionUser } from '@/lib/server/session';
import { ipHash } from '@/lib/server/rate-limit';
import { sbHeaders, sbUrl } from '@/lib/server/votes';

/** Shown as the actor when the owner used the admin key instead of signing in with an account. */
export const ADMIN_KEY_ACTOR = 'Owner (admin key)';

/** Human labels for each action, shared with the dashboard's Activity tab. */
export const ACTIVITY_ACTIONS = {
  'listing.update': 'Edited submission',
  'listing.delete': 'Deleted submission',
  'user.update': 'Edited user',
  'user.delete': 'Deleted user',
  'premium.approve': 'Approved payment',
  'premium.reject': 'Rejected payment',
  'settings.coming_soon': 'Changed coming soon page',
  'team.add': 'Added admin',
  'team.remove': 'Removed admin',
  'team.resend_invite': 'Resent admin invite',
  'team.invite_accepted': 'Accepted admin invite',
  'email.verify_domain': 'Re-checked email domain',
  'email.test': 'Sent test email',
  'session.key_sign_in': 'Signed in with admin key',
} as const;

export type ActivityAction = keyof typeof ACTIVITY_ACTIONS;

/** The email of whoever is making this admin request, or ADMIN_KEY_ACTOR. */
export async function activityActor(req: NextRequest): Promise<string> {
  const user = await getSessionUser(req);
  if (user) return user.email;
  if (isValidAdminKey(req.headers.get('x-admin-key')) || isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return ADMIN_KEY_ACTOR;
  }
  return 'unknown';
}

/**
 * Records one admin action. Never throws: a logging failure must not undo or block the change,
 * but it is reported in the server logs. `actor` defaults to whoever made `req`.
 */
export async function logAdminActivity(
  req: NextRequest,
  action: ActivityAction,
  target: string | null,
  details?: Record<string, unknown>,
  actor?: string,
): Promise<void> {
  try {
    const res = await fetch(sbUrl('admin_activity'), {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({
        actor: actor ?? (await activityActor(req)),
        action,
        target,
        details: details ?? null,
        ip_hash: ipHash(req),
      }),
    });
    if (!res.ok) console.error(`Admin activity not logged (${action}): ${res.status} ${await res.text()}`);
  } catch (e) {
    console.error(`Admin activity not logged (${action}):`, e);
  }
}

/** A user row safe to keep in the log: never the password hash. */
export function withoutSecrets(row: Record<string, unknown>): Record<string, unknown> {
  const { password, ...rest } = row;
  return { ...rest, signIn: password === 'google_oauth' ? 'google' : 'password' };
}
