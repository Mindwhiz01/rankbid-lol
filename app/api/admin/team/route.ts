import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_EMAILS, MAX_TEAM_ADMINS, getTeamAdminEmails, isAdminRequest, isOwnerRequest, setTeamAdminEmails,
} from '@/lib/server/admin';
import { INVITE_PLACEHOLDER, createPasswordLink } from '@/lib/server/account';
import { logAdminActivity } from '@/lib/server/admin-activity';
import { getSessionUser } from '@/lib/server/session';
import { sendAdminInviteEmail } from '@/lib/email';

/** How long an invite's "set your password" link works. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// GET: the admin team. Any admin can see it; only the owner can change it (canManage).
// `pending` means the invite hasn't been accepted: they haven't set a password yet.
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const emails = await getTeamAdminEmails();
  const users = emails.length
    ? await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true, name: true, password: true } })
    : [];
  const byEmail = new Map(users.map((u) => [u.email, u]));
  return NextResponse.json({
    owners: ADMIN_EMAILS,
    team: emails.map((email) => ({
      email,
      name: byEmail.get(email)?.name ?? null,
      pending: byEmail.get(email)?.password === INVITE_PLACEHOLDER,
    })),
    max: MAX_TEAM_ADMINS,
    canManage: await isOwnerRequest(req),
  });
}

// POST { email, name? }: give someone admin access. The owner never chooses the password: the invite
// email always carries a one-time link where the admin sets their own (new accounts start without one).
export async function POST(req: NextRequest) {
  if (!(await isOwnerRequest(req))) {
    return NextResponse.json({ error: 'Only the owner can add admins' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
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
    const user = existing ?? await prisma.user.create({
      data: { email, password: INVITE_PLACEHOLDER, name: name || undefined },
    });
    await setTeamAdminEmails([...team, email]);
    const invite = await sendAdminInviteEmail({
      to: email,
      name: name || user.name,
      setPasswordUrl: await inviteLink(req, user.id),
      invitedBy: await ownerName(req),
    });
    await logAdminActivity(req, 'team.add', email, { name: name || user.name || null, existingAccount: Boolean(existing), emailSent: invite.sent });
    return NextResponse.json({ email, existingAccount: Boolean(existing), emailSent: invite.sent, emailError: invite.sent ? undefined : invite.error });
  } catch (e) {
    console.error('Add admin failed:', e);
    return NextResponse.json({ error: 'Could not add the admin' }, { status: 500 });
  }
}

// PATCH { email }: email a team admin their invite again with a fresh set-password link (earlier
// links stop working). Also how an admin who forgot their password gets back in.
export async function PATCH(req: NextRequest) {
  if (!(await isOwnerRequest(req))) {
    return NextResponse.json({ error: 'Only the owner can send invites' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!(await getTeamAdminEmails()).includes(email)) {
    return NextResponse.json({ error: 'Not an admin' }, { status: 404 });
  }
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, password: true } });
  if (!user) return NextResponse.json({ error: 'That admin has no account' }, { status: 404 });
  const pending = user.password === INVITE_PLACEHOLDER;
  const invite = await sendAdminInviteEmail({
    to: email,
    name: user.name,
    setPasswordUrl: await inviteLink(req, user.id),
    invitedBy: await ownerName(req),
  });
  if (!invite.sent) {
    return NextResponse.json({ error: `Email not sent: ${invite.error}` }, { status: 502 });
  }
  await logAdminActivity(req, 'team.resend_invite', email, { pending });
  return NextResponse.json({ emailSent: true });
}

/** A fresh one-time link for an invited admin to choose their password; older links stop working. */
function inviteLink(req: NextRequest, userId: string): Promise<string> {
  return createPasswordLink(userId, INVITE_TTL_MS, process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin, { invite: true, replaceUnused: true });
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
    await logAdminActivity(req, 'team.remove', email);
    return NextResponse.json({ removed: email });
  } catch (e) {
    console.error('Remove admin failed:', e);
    return NextResponse.json({ error: 'Could not remove the admin' }, { status: 500 });
  }
}
