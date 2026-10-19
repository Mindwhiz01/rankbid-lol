import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, type SessionUser } from '@/lib/server/session';
import { sbHeaders, sbUrl } from '@/lib/server/votes';
import { removeListing } from '@/lib/server/admin';
import { getActiveHolders } from '@/lib/server/premium';
import { CATEGORIES, LEGACY_CATEGORIES } from '@/lib/categories';
import { addCustomCategory, getCustomCategories } from '@/lib/server/custom-categories';
import { accessibilityProblem, isFlaggedBySafeBrowsing, staticUrlProblem } from '@/lib/server/url-safety';
import { findDuplicateListing } from '@/lib/server/duplicate-listing';
import { extractMetadata } from '@/lib/metadata';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';

/** Platform of a link, from its host (same buckets the submit form uses). */
function platformOf(url: string): string {
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  if (host.endsWith('linkedin.com')) return 'linkedin';
  if (host.endsWith('twitter.com') || host === 'x.com') return 'twitter';
  if (host.endsWith('facebook.com')) return 'facebook';
  if (host.endsWith('instagram.com')) return 'instagram';
  if (host.endsWith('tiktok.com')) return 'tiktok';
  return 'website';
}

/** True if the listing exists and belongs to the signed-in user. */
async function ownsListing(user: SessionUser, listingId: string): Promise<boolean> {
  const res = await fetch(
    sbUrl(`listings?id=eq.${encodeURIComponent(listingId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id`),
    { headers: sbHeaders(), cache: 'no-store' }
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

// PATCH { listingId, url?, title?, description?, category? } — edit one of your own submissions.
// Votes, clicks and sponsorships belong to the listing, so they stay when the link changes;
// a new link goes through the same safety, duplicate and reachability checks as a new submission.
export async function PATCH(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { listingId, url, title, description, category, customCategory } = await request.json();
    if (typeof listingId !== 'string' || !listingId) {
      return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });
    }

    const changes: Record<string, string> = {};
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
        return NextResponse.json({ error: 'Title must be 1–120 characters' }, { status: 400 });
      }
      changes.title = title.trim();
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length > 500) {
        return NextResponse.json({ error: 'Description is too long (500 characters max)' }, { status: 400 });
      }
      changes.description = description.trim();
    }
    if (category !== undefined) {
      if (typeof category !== 'string') {
        return NextResponse.json({ error: 'Pick a valid category' }, { status: 400 });
      }
      if (typeof customCategory === 'string' && customCategory.trim()) {
        // "Other" with a typed name: save it as a new category (same rules as on submit).
        const added = await addCustomCategory(customCategory).catch(() => null);
        if (!added) return NextResponse.json({ error: "That category name can't be used. Use 2-30 letters or numbers." }, { status: 400 });
        changes.category = added;
      } else if (![...CATEGORIES, ...LEGACY_CATEGORIES, ...(await getCustomCategories())].includes(category)) {
        return NextResponse.json({ error: 'Pick a valid category' }, { status: 400 });
      } else {
        changes.category = category;
      }
    }
    if (url !== undefined) {
      if (typeof url !== 'string' || !url.trim() || url.trim().length > 500) {
        return NextResponse.json({ error: 'Enter a valid link' }, { status: 400 });
      }
      let next = url.trim();
      if (!/^https?:\/\//i.test(next)) next = `https://${next}`;
      try {
        new URL(next);
      } catch {
        return NextResponse.json({ error: 'Enter a valid link' }, { status: 400 });
      }

      const currentRes = await fetch(
        sbUrl(`listings?id=eq.${encodeURIComponent(listingId)}&user_id=eq.${encodeURIComponent(user.id)}&select=location`),
        { headers: sbHeaders(), cache: 'no-store' }
      );
      const [current] = currentRes.ok ? await currentRes.json() : [];
      if (!current) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

      if (next !== current.location) {
        // Link changes fetch the new site, so keep them occasional.
        if (!(await rateLimit(`link-edit:${user.id}`, 10, 60 * 60)) || !(await rateLimit(`link-edit-ip:${ipHash(request)}`, 20, 60 * 60))) {
          return NextResponse.json({ error: 'Too many link changes. Please try again later.' }, { status: 429 });
        }
        const problem = staticUrlProblem(next);
        if (problem) return NextResponse.json({ error: problem }, { status: 400 });
        if (await isFlaggedBySafeBrowsing(next)) {
          console.warn('Link edit blocked by Safe Browsing:', next, 'user', user.id);
          return NextResponse.json({ error: 'This site is flagged as unsafe (malware or phishing) and cannot be listed.' }, { status: 400 });
        }
        if (await findDuplicateListing(next, listingId)) {
          return NextResponse.json({ error: 'That link is already listed on RankBid.' }, { status: 409 });
        }
        const access = await accessibilityProblem(next);
        if (access) return NextResponse.json({ error: access }, { status: 400 });

        changes.location = next;
        changes.platform = platformOf(next);
        // Fresh preview image for the new site; keep the old one if the page can't be read.
        try {
          const meta = await extractMetadata(next);
          if (meta.image) changes.image_url = meta.image;
        } catch {
          // Not fatal: the listing falls back to the site's favicon.
        }
      }
    }
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    // Filtering on user_id too means another user's listing simply doesn't match.
    // updated_at is left alone: it doubles as "last voted at" for ranking ties.
    const res = await fetch(
      sbUrl(`listings?id=eq.${encodeURIComponent(listingId)}&user_id=eq.${encodeURIComponent(user.id)}`),
      {
        method: 'PATCH',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(changes),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    const [row] = await res.json();
    if (!row) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

    return NextResponse.json({
      success: true,
      listing: { id: row.id, title: row.title, description: row.description, category: row.category, url: row.location, platform: row.platform },
    });
  } catch (error) {
    console.error('Error updating submission:', error);
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
  }
}

// DELETE { listingId } — remove one of your own submissions and its votes.
export async function DELETE(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { listingId } = await request.json();
    if (typeof listingId !== 'string' || !listingId) {
      return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });
    }
    if (!(await ownsListing(user, listingId))) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }
    // A paid sponsorship is attached to this listing; don't let it vanish mid-term.
    const holders = await getActiveHolders();
    if (holders.some(h => h.listingId === listingId)) {
      return NextResponse.json(
        { error: 'This submission is currently sponsored and can be deleted once the sponsorship ends. Contact support if you need it removed sooner.' },
        { status: 409 }
      );
    }

    await removeListing(listingId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting submission:', error);
    return NextResponse.json({ error: 'Failed to delete submission' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Only ever the signed-in user's own data.
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = encodeURIComponent(user.id);

    // Query Supabase listings table for user's submissions
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Try to fetch with user_id filter - if the column doesn't exist, fall back to all listings
    let listings: any[] = [];

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/listings?user_id=eq.${userId}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );

      if (response.ok) {
        listings = await response.json();
      } else if (response.status === 400) {
        // user_id column might not exist yet (migration not applied)
        // For now, return empty array with helpful message
        console.log('Note: user_id column may not exist yet. Please apply database migration.');
        listings = [];
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
      listings = [];
    }

    // Transform Supabase response to match expected format
    const transformedListings = listings.map((listing: any) => ({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      url: listing.location,
      handle: listing.handle,
      platform: listing.platform || 'website',
      totalVotes: listing.total_votes || 0,
      dayVotes: listing.day_votes || 0,
      category: listing.category,
      createdAt: listing.created_at,
    }));

    return NextResponse.json(
      { listings: transformedListings },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching user submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions', listings: [] },
      { status: 500 }
    );
  }
}
