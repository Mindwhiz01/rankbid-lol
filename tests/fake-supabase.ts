import { vi } from 'vitest';

export const OWNER = { id: 'u-owner', email: 'assadullahnouman@gmail.com', name: 'Owner' };
export const TEAM_ADMIN = { id: 'u-team', email: 'team-admin@example.com', name: 'Team' };
export const MEMBER = { id: 'u-member', email: 'member@example.com', name: 'Member' };
export const OTHER = { id: 'u-other', email: 'other@example.com', name: 'Other' };

const USERS = [OWNER, TEAM_ADMIN, MEMBER, OTHER];

/** Session cookie value for each fake account. */
export const tokenFor = (user: { id: string }) => `session_${user.id}`;

export interface Call {
  method: string;
  table: string;
  url: string;
  body?: string;
}

type Override = (call: Call) => Response | undefined;

/**
 * Stands in for Supabase's REST API: answers session, user and admin-team lookups for the accounts
 * above, returns empty results for everything else, and records every call so tests can assert
 * that a refused request touched nothing. `override` answers specific calls first.
 */
export function fakeSupabase(override?: Override) {
  const calls: Call[] = [];
  const json = (rows: unknown, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json', 'content-range': `0-0/${Array.isArray(rows) ? rows.length : 0}`, ...extra } });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = (init.method || 'GET').toUpperCase();
    const path = url.split('/rest/v1/')[1] ?? '';
    const call: Call = { method, table: path.split(/[?/]/)[0], url: decodeURIComponent(url), body: typeof init.body === 'string' ? init.body : undefined };
    calls.push(call);

    if (!url.startsWith('https://supabase.test.invalid/')) throw new Error(`Unexpected outbound fetch: ${url}`);
    const answered = override?.(call);
    if (answered) return answered;

    if (call.table === 'sessions' && method === 'GET') {
      const user = USERS.find(u => call.url.includes(`token=eq.${tokenFor(u)}`));
      const expires_at = new Date(Date.now() + 3600_000).toISOString();
      return json(user ? [{ user_id: user.id, expires_at, user: { ...user, blocked_at: null } }] : []);
    }
    if (call.table === 'users' && method === 'GET') {
      const user = USERS.find(u => call.url.includes(`id=eq.${u.id}`));
      return json(user ? [{ ...user, blocked_at: null }] : []);
    }
    if (call.table === 'site_settings' && call.url.includes('admin_team')) {
      return json([{ value: [TEAM_ADMIN.email] }]);
    }
    if (call.table === 'rate_limits' && method === 'POST') return json([{ id: 1 }]);
    if (call.table.startsWith('rpc')) return json(true);
    return json([]);
  });

  vi.stubGlobal('fetch', fetchMock);
  return {
    calls,
    /** Calls beyond the sign-in checks (sessions, users, admin team, rate limits). */
    dataCalls: () => calls.filter(c => !['sessions', 'users', 'site_settings', 'rate_limits', 'rpc'].includes(c.table) && !c.table.startsWith('rpc/rate_limit')),
    writes: () => calls.filter(c => c.method !== 'GET' && c.method !== 'HEAD' && !['rate_limits', 'rpc'].includes(c.table) && !c.table.startsWith('rpc/rate_limit')),
  };
}
