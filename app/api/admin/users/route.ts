import { NextRequest, NextResponse } from 'next/server';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { ADMIN_EMAILS, getTeamAdminEmails, isAdminEmail, isAdminRequest, isOwnerRequest, sbSelect, submissionCountsByUser, toAdminUser } from '@/lib/server/admin';
import { endSessions, getAccount, passwordProblem, setPassword } from '@/lib/server/account';
import { sendAccountUpdatedEmail } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{6,19}$/;
/** Free-text profile fields an admin may set, with their length limits. Empty clears the field. */
const TEXT_FIELDS = { name: 80, city: 80, country: 80, bio: 500 } as const;

const cleanSearch = (s: string) => s.replace(/[,()*\\]/g, ' ').trim();

// GET ?page&limit&search — users, newest first, with how many listings each submitted.
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const search = cleanSearch(searchParams.get('search') || '');

    let path = `users?select=*&order=created_at.desc&limit=${limit}&offset=${(page - 1) * limit}`;
    if (search) {
      const q = encodeURIComponent(`*${search}*`);
      path += `&or=(email.ilike.${q},name.ilike.${q})`;
    }

    const [{ rows, total }, counts, team] = await Promise.all([
      sbSelect<Record<string, unknown>>(path),
      submissionCountsByUser(),
      getTeamAdminEmails(),
    ]);
    const adminEmails = [...ADMIN_EMAILS, ...team];

    return NextResponse.json({
      users: rows.map((row) => toAdminUser(row, counts.get(String(row.id)), adminEmails)),
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// DELETE { userId } — deletes the account, its sessions and its votes. Their listings stay.
export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Team admins can't remove the owner or each other.
    const target = await getAccount({ id: String(userId) });
    if (target && (await isAdminEmail(target.email)) && !(await isOwnerRequest(req))) {
      return NextResponse.json({ error: 'Only the owner can delete an admin account' }, { status: 403 });
    }

    const id = encodeURIComponent(userId);
    const del = (path: string) => fetch(sbUrl(path), { method: 'DELETE', headers: sbHeaders() });
    await Promise.all([del(`user_votes?user_id=eq.${id}`), del(`sessions?user_id=eq.${id}`)]);
    const res = await del(`users?id=eq.${id}`);
    if (!res.ok) throw new Error(await res.text());

    return NextResponse.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}

/**
 * PATCH { userId, name?, email?, password?, phone?, city?, country?, bio?, signOut? }: edits any account.
 * A new email or password signs the user out everywhere and is emailed to them. Admin accounts (the owner
 * and the team) can only be edited by the owner, and only the owner can give an account an admin address.
 */
export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const target = userId ? await getAccount({ id: userId }) : null;
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const owner = await isOwnerRequest(req);
    if (!owner && (await isAdminEmail(target.email))) {
      return NextResponse.json({ error: 'Only the owner can edit an admin account' }, { status: 403 });
    }

    const changes: Record<string, string | null> = {};
    for (const [field, max] of Object.entries(TEXT_FIELDS)) {
      if (body[field] === undefined) continue;
      if (typeof body[field] !== 'string' || body[field].length > max) {
        return NextResponse.json({ error: `${field[0].toUpperCase()}${field.slice(1)} must be ${max} characters or fewer` }, { status: 400 });
      }
      changes[field] = body[field].trim() || null;
    }
    if (body.phone !== undefined) {
      const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
      if (phone && !PHONE_RE.test(phone)) return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 });
      changes.phone = phone || null;
    }

    let newEmail: string | null = null;
    if (body.email !== undefined) {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
      if (email !== target.email.toLowerCase()) {
        if (!owner && (await isAdminEmail(email))) {
          return NextResponse.json({ error: 'Only the owner can give an account an admin address' }, { status: 403 });
        }
        if (await getAccount({ email })) return NextResponse.json({ error: 'Another account already uses that email' }, { status: 409 });
        changes.email = email;
        newEmail = email;
      }
    }

    let newPassword: string | null = null;
    if (body.password !== undefined && body.password !== '') {
      const problem = passwordProblem(body.password);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      newPassword = body.password;
    }

    if (!Object.keys(changes).length && !newPassword && !body.signOut) {
      return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
    }

    if (Object.keys(changes).length) {
      const res = await fetch(sbUrl(`users?id=eq.${encodeURIComponent(target.id)}`), {
        method: 'PATCH',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ ...changes, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`User update failed: ${res.status} ${await res.text()}`);
    }
    if (newPassword) await setPassword(target.id, newPassword);
    // New sign-in details (or an explicit request) end every session the account had.
    const signedOut = Boolean(newEmail || newPassword || body.signOut);
    if (signedOut) await endSessions(target.id);

    // The owner of the account hears about it, at the old address and the new one.
    if (newEmail || newPassword) {
      const what = { email: newEmail, password: Boolean(newPassword) };
      await Promise.all([...new Set([target.email, newEmail].filter((e): e is string => Boolean(e)))]
        .map(to => sendAccountUpdatedEmail({ to, name: changes.name ?? target.name, ...what })));
    }
    console.log('[admin] user updated', target.id, { fields: Object.keys(changes), password: Boolean(newPassword), signedOut });

    return NextResponse.json({ success: true, signedOut });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
