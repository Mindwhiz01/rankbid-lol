import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_EMAILS, MAX_TEAM_ADMINS, getTeamAdminEmails, isAdminRequest, isOwnerRequest, setTeamAdminEmails,
} from '@/lib/server/admin';
import { getSessionUser } from '@/lib/server/session';
import { sendAdminInviteEmail } from '@/lib/email';

const prisma = new PrismaClient();

// GET: the admin team. Any admin can see it; only the owner can change it (canManage).
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const emails = await getTeamAdminEmails();
  const users = emails.length
    ? await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true, name: true } })
    : [];
  const names = new Map(users.map((u) => [u.email, u.name]));
  return NextResponse.json({
    owners: ADMIN_EMAILS,
    team: emails.map((email) => ({ email, name: names.get(email) ?? null })),
    max: MAX_TEAM_ADMINS,
    canManage: await isOwnerRequest(req),
  });
}

// POST { email, password, name? }: give someone admin access. Creates their account with that
// password, or, when the email already has an account, grants access and keeps their password.
export async function POST(req: NextRequest) {
  if (!(await isOwnerRequest(req))) {
    return NextResponse.json({ error: 'Only the owner can add admins' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
  }
  if (ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: 'That is the owner account' }, { status: 400 });
  }
  const team = await getTeamAdminEmails();
  if (team.includes(email)) {
    return NextResponse.json({ error: 'Already an admin' }, { status: 400 });
  }
  if (team.length >= MAX_TEAM_ADMINS) {
    return NextResponse.json({ error: `You can share access with up to ${MAX_TEAM_ADMINS} admins. Remove one first.` }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      if (password.length < 8 || password.length > 200) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      await prisma.user.create({
        data: { email, password: await bcryptjs.hash(password, 10), name: name || undefined },
      });
    }
    await setTeamAdminEmails([...team, email]);
    const invite = await sendAdminInviteEmail({
      to: email,
      name: name || existing?.name,
      password: existing ? undefined : password,
      invitedBy: await ownerName(req),
    });
    return NextResponse.json({ email, existingAccount: Boolean(existing), emailSent: invite.sent, emailError: invite.sent ? undefined : invite.error });
  } catch (e) {
    console.error('Add admin failed:', e);
    return NextResponse.json({ error: 'Could not add the admin' }, { status: 500 });
  }
}

// PATCH { email }: email a team admin their invite again (without a password, which isn't stored).
export async function PATCH(req: NextRequest) {
  if (!(await isOwnerRequest(req))) {
    return NextResponse.json({ error: 'Only the owner can send invites' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!(await getTeamAdminEmails()).includes(email)) {
    return NextResponse.json({ error: 'Not an admin' }, { status: 404 });
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { name: true } });
  const invite = await sendAdminInviteEmail({ to: email, name: user?.name, password: null, invitedBy: await ownerName(req) });
  if (!invite.sent) {
    return NextResponse.json({ error: `Email not sent: ${invite.error}` }, { status: 502 });
  }
  return NextResponse.json({ emailSent: true });
}

/** Who to name as the inviter: the signed-in owner's name or email, else nothing (admin key). */
async function ownerName(req: NextRequest): Promise<string | null> {
  const user = await getSessionUser(req);
  return user ? user.name || user.email : null;
}

// DELETE { email }: take admin access away. Their account stays; open sessions lose admin within ~15s (team cache).
export async function DELETE(req: NextRequest) {
  if (!(await isOwnerRequest(req))) {
    return NextResponse.json({ error: 'Only the owner can remove admins' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const team = await getTeamAdminEmails();
  if (!team.includes(email)) {
    return NextResponse.json({ error: 'Not an admin' }, { status: 404 });
  }
  try {
    await setTeamAdminEmails(team.filter((e) => e !== email));
    return NextResponse.json({ removed: email });
  } catch (e) {
    console.error('Remove admin failed:', e);
    return NextResponse.json({ error: 'Could not remove the admin' }, { status: 500 });
  }
}
