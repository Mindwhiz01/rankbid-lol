import { NextRequest, NextResponse } from 'next/server';
import { getListing, recordVote, sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { canonicalEmail, isDisposableEmail } from '@/lib/server/guest-email';

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

    // Emails aren't verified, so cap how many guest votes one network can cast: a few per product
    // (households and offices share an IP) and a modest total per hour and per day.
    const ip = ipHash(req);
    if (
      !(await rateLimit(`support-ip-listing:${ip}:${listingId}`, 3, 24 * 60 * 60)) ||
      !(await rateLimit(`support-ip:${ip}`, 10, 60 * 60)) ||
      !(await rateLimit(`support-ip-day:${ip}`, 20, 24 * 60 * 60))
    ) {
      return NextResponse.json({ error: 'Too many votes from your network. Please try again later.' }, { status: 429 });
    }

    const listing = await getListing(listingId);
    if (!listing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // One vote per inbox: "jo.doe+2@gmail.com" and "jodoe@gmail.com" are the same voter.
    const result = await recordVote(listing.id, `email:${canonicalEmail(email)}`);
    if (result.status === 'duplicate') {
      return NextResponse.json({ error: 'This email has already voted for this product', alreadyVoted: true }, { status: 409 });
    }

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
