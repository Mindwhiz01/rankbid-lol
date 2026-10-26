import { after, NextRequest, NextResponse } from 'next/server';
import { getListing, recordVote, sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';
import { notifyVote, snapshotListing } from '@/lib/server/vote-notify';
import { clientIp, ipHash, rateLimitedUntil, recordHit } from '@/lib/server/rate-limit';
import { canonicalEmail, domainAcceptsMail, isDisposableEmail } from '@/lib/server/guest-email';
import { verifyTurnstile } from '@/lib/server/turnstile';

// Guest voting from a shared /support/<id> link: name + email + how they support the maker.
// One vote per email per listing (voter_id = "email:<email>").

const SUPPORT_TYPES = ['founder', 'friend', 'supporter'] as const;
type SupportType = (typeof SUPPORT_TYPES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// PostgREST answers 404 / PGRST205 when the supporters table hasn't been created yet.
function isMissingTable(status: number, body: string) {
  return status === 404 || body.includes('PGRST205') || body.includes('does not exist');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const listingId = String(body.listingId || '').trim();
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    const email = String(body.email || '').trim().toLowerCase();
    const supportType = String(body.supportType || '') as SupportType;

    // Honeypot: real visitors never see or fill this field.
    if (body.company) {
      return NextResponse.json({ success: true }, { status: 201 });
    }

    if (!listingId || listingId.length > 100) return NextResponse.json({ error: 'Missing product' }, { status: 400 });
    if (name.length < 2 || name.length > 60) return NextResponse.json({ error: 'Please enter your name (2–60 characters)' }, { status: 400 });
    if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    if (isDisposableEmail(email)) return NextResponse.json({ error: 'Please use your real email address, not a temporary one' }, { status: 400 });
    if (!SUPPORT_TYPES.includes(supportType)) return NextResponse.json({ error: 'Please choose how you support this maker' }, { status: 400 });
    if (!supabaseConfigured()) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    // Bot check (Cloudflare Turnstile), when it's configured.
    if (!(await verifyTurnstile(body.turnstileToken, clientIp(req)))) {
      return NextResponse.json({ error: 'Please complete the "I am human" check and try again', retryCaptcha: true }, { status: 400 });
    }

    // Flood guard per network. Turnstile and one vote per inbox are the real protection, and offices and
    // mobile carriers put many people behind one IP, so the caps are generous and only counted votes count
    // towards them: typos and refused emails never block the next person on the network.
    const ip = ipHash(req);
    const limits = [
      { key: `support-ip-listing:${ip}:${listingId}`, limit: 15, windowSec: 24 * 60 * 60 },
      { key: `support-ip:${ip}`, limit: 30, windowSec: 60 * 60 },
      { key: `support-ip-day:${ip}`, limit: 100, windowSec: 24 * 60 * 60 },
    ];
    const blockedUntil = (await Promise.all(limits.map(l => rateLimitedUntil(l.key, l.limit, l.windowSec))))
      .reduce<Date | null>((latest, d) => (d && (!latest || d > latest) ? d : latest), null);
    if (blockedUntil) {
      return NextResponse.json(
        { error: 'Too many votes from your network. Please try again later.', retryAt: blockedUntil.toISOString() },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / 1000))) } }
      );
    }

    // A made-up domain can't receive mail, so it can't be a real voter.
    if (!(await domainAcceptsMail(email))) {
      return NextResponse.json({ error: 'That email domain can’t receive mail. Please use your real email address' }, { status: 400 });
    }

    const listing = await getListing(listingId);
    if (!listing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // One vote per inbox: "jo.doe+2@gmail.com" and "jodoe@gmail.com" are the same voter.
    const voter = `email:${canonicalEmail(email)}`;
    const before = await snapshotListing(listing.id);
    const result = await recordVote(listing.id, voter);
    if (result.status === 'duplicate') {
      return NextResponse.json({ error: 'This email has already voted for this product', alreadyVoted: true }, { status: 409 });
    }
    await Promise.all(limits.map(l => recordHit(l.key)));
    if (before) after(() => notifyVote(before, result.totalVotes, voter));

    // Supporter details are best-effort: the vote above already counts even if this table is missing.
    const supporterRes = await fetch(sbUrl('supporters'), {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ listing_id: listing.id, name, email, support_type: supportType }),
    });
    if (!supporterRes.ok) {
      const text = await supporterRes.text();
      if (isMissingTable(supporterRes.status, text)) {
        console.warn('[support-vote] supporters table missing; run supabase/migrations/add_supporters.sql');
      } else {
        console.error('[support-vote] failed to save supporter:', supporterRes.status, text);
      }
    }

    return NextResponse.json({ success: true, totalVotes: result.totalVotes }, { status: 201 });
  } catch (error) {
    console.error('[support-vote] error:', error);
    return NextResponse.json({ error: 'Could not record your vote. Please try again.' }, { status: 500 });
  }
}

// Public summary for the support page: counts per type and recent first names (never emails).
export async function GET(req: NextRequest) {
  const listingId = req.nextUrl.searchParams.get('listingId');
  const empty = { counts: { founder: 0, friend: 0, supporter: 0 }, recent: [] as { name: string; type: SupportType }[] };
  if (!listingId || !supabaseConfigured()) return NextResponse.json(empty);

  try {
    const res = await fetch(
      sbUrl(`supporters?listing_id=eq.${encodeURIComponent(listingId)}&select=name,support_type,created_at&order=created_at.desc&limit=500`),
      { headers: sbHeaders(), cache: 'no-store' }
    );
    if (!res.ok) return NextResponse.json(empty);

    const rows: { name: string; support_type: SupportType }[] = await res.json();
    const counts = { ...empty.counts };
    for (const r of rows) if (r.support_type in counts) counts[r.support_type]++;
    const recent = rows.slice(0, 8).map(r => ({ name: r.name.split(' ')[0], type: r.support_type }));

    return NextResponse.json({ counts, recent });
  } catch {
    return NextResponse.json(empty);
  }
}
