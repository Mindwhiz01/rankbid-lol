import { NextRequest, NextResponse } from 'next/server';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { ADMIN_EMAILS, isAdminEmail, isAdminRequest, isOwnerRequest } from '@/lib/server/admin';
import { endSessions, getAccount } from '@/lib/server/account';
import { logAdminActivity } from '@/lib/server/admin-activity';

// POST { userId, blocked: boolean, reason? }: block an account (it can't sign in, and every session
// it has ends now) or unblock it. Only the owner can block an admin, and the owner can't be blocked.
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === 'string' ? body.userId : '';
    if (typeof body.blocked !== 'boolean') {
      return NextResponse.json({ error: 'blocked must be true or false' }, { status: 400 });
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
    const target = userId ? await getAccount({ id: userId }) : null;
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (ADMIN_EMAILS.includes(target.email.toLowerCase())) {
      return NextResponse.json({ error: 'The owner account can’t be blocked' }, { status: 403 });
    }
    if ((await isAdminEmail(target.email)) && !(await isOwnerRequest(req))) {
      return NextResponse.json({ error: 'Only the owner can block an admin account' }, { status: 403 });
    }

    const res = await fetch(sbUrl(`users?id=eq.${encodeURIComponent(target.id)}`), {
      method: 'PATCH',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(body.blocked
        ? { blocked_at: new Date().toISOString(), blocked_reason: reason || null }
        : { blocked_at: null, blocked_reason: null }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (text.includes('blocked_at')) {
        return NextResponse.json({ error: 'Blocking isn’t set up yet. Run block_users.sql in Supabase first.' }, { status: 500 });
      }
      throw new Error(`Block update failed: ${res.status} ${text}`);
    }
    if (body.blocked) await endSessions(target.id);

    await logAdminActivity(req, body.blocked ? 'user.block' : 'user.unblock', target.email, {
      userId: target.id,
      ...(body.blocked && reason ? { reason } : {}),
    });
    return NextResponse.json({ success: true, blocked: body.blocked });
  } catch (error) {
    console.error('Error blocking user:', error);
    return NextResponse.json({ error: 'Failed to update the block' }, { status: 500 });
  }
}
