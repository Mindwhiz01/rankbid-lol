import { NextRequest, NextResponse } from 'next/server';
import { getAccount, GOOGLE_PLACEHOLDER, passwordMatches } from '@/lib/server/account';
import { removeListing } from '@/lib/server/admin';
import { getActiveHolders } from '@/lib/server/premium';
import { rateLimit } from '@/lib/server/rate-limit';
import { getSessionUser } from '@/lib/server/session';
import { sbHeaders, sbUrl } from '@/lib/server/votes';

// DELETE { confirm: "DELETE", password? }: permanently deletes the signed-in account, its
// submissions (with their votes) and its sessions. Accounts with a password must re-enter it.
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { confirm, password } = await req.json().catch(() => ({}));
    if (confirm !== 'DELETE') {
      return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 });
    }
    if (!(await rateLimit(`account-delete:${user.id}`, 10, 60 * 60))) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const account = await getAccount({ id: user.id });
    if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (account.password !== GOOGLE_PLACEHOLDER && !(await passwordMatches(account, password))) {
      return NextResponse.json({ error: 'Your password is incorrect' }, { status: 400 });
    }

    const listingsRes = await fetch(sbUrl(`listings?user_id=eq.${encodeURIComponent(user.id)}&select=id`), { headers: sbHeaders(), cache: 'no-store' });
    if (!listingsRes.ok) throw new Error(`Listing lookup failed: ${listingsRes.status}`);
    const listingIds: string[] = (await listingsRes.json()).map((l: { id: string }) => String(l.id));

    // Paid sponsorships are kept on record; support handles those accounts by hand.
    const holders = await getActiveHolders();
    if (holders.some(h => listingIds.includes(h.listingId))) {
      return NextResponse.json(
        { error: 'One of your products has a paid sponsored listing, so the account can’t be deleted here. Please contact support and we’ll handle it.' },
        { status: 409 }
      );
    }

    for (const id of listingIds) await removeListing(id);
    // Sessions, reset links and the rest go with the user row (ON DELETE CASCADE).
    const del = await fetch(sbUrl(`users?id=eq.${encodeURIComponent(user.id)}`), { method: 'DELETE', headers: sbHeaders() });
    if (!del.ok) throw new Error(`Account delete failed: ${del.status} ${await del.text()}`);
    console.log('Account deleted:', user.id, `(${listingIds.length} listings)`);

    const res = NextResponse.json({ success: true });
    res.cookies.delete('auth_token');
    return res;
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: 'Could not delete the account. Please try again.' }, { status: 500 });
  }
}
