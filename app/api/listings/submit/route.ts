import { NextRequest, NextResponse } from 'next/server';
import { selfHostedImage } from '@/lib/logo';
import { extractMetadata } from '@/lib/metadata';
import { extractSocialHandle, formatSocialMediaUrl, isSocialMediaUrl } from '@/lib/social-utils';
import { sendNewSubmissionEmail, sendSubmissionConfirmation } from '@/lib/email';
import { getActiveHolders, type PremiumHolder } from '@/lib/server/premium';
import { CATEGORIES, LEGACY_CATEGORIES } from '@/lib/categories';
import { addCustomCategory, getCustomCategories } from '@/lib/server/custom-categories';
import { detectPlatform, looksLikeUrl, normalizePlatform, platformUrlProblem } from '@/lib/platform-url';
import { getSessionUser } from '@/lib/server/session';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';
import { accessibilityProblem, isFlaggedBySafeBrowsing, staticUrlProblem } from '@/lib/server/url-safety';
import { findDuplicateListing } from '@/lib/server/duplicate-listing';
import { badgeZip } from '@/lib/server/badges';
import { sbHeaders, sbUrl } from '@/lib/server/votes';

export async function POST(req: NextRequest) {
  try {
    // Submissions are tied to the signed-in account (never to a user id sent by the browser).
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to submit', listings: [] }, { status: 401 });
    }

    // Attempts per network, so the link checks below can't be hammered. Rejected attempts (duplicates, bad
    // links) count here but not toward the per-account limits, which only count listings that get saved.
    if (!(await rateLimit(`submit-ip:${ipHash(req)}`, 30, 60 * 60))) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.', listings: [] },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { url, handle, customCategory } = body;
    let { category, platform } = body;

    if (
      (url !== undefined && typeof url !== 'string') ||
      (handle !== undefined && typeof handle !== 'string') ||
      (platform !== undefined && typeof platform !== 'string') ||
      (customCategory !== undefined && typeof customCategory !== 'string')
    ) {
      return NextResponse.json({ error: 'Invalid submission', listings: [] }, { status: 400 });
    }

    if (!url && !handle) {
      return NextResponse.json(
        { error: 'URL or handle required', listings: [] },
        { status: 400 }
      );
    }

    // The link must belong to the platform tab picked on the form. Without a platform (the
    // sponsor checkout's "add a product" box) it's taken from the link itself.
    const linkText = (url || handle || '').trim();
    if (platform) {
      const problem = platformUrlProblem(platform, linkText);
      if (problem) return NextResponse.json({ error: problem, listings: [] }, { status: 400 });
      platform = normalizePlatform(platform);
    } else {
      platform = detectPlatform(linkText);
      if (!platform) return NextResponse.json({ error: 'Enter a valid link', listings: [] }, { status: 400 });
    }

    // "Other" plus a typed name adds that name as a category everyone can pick from then on.
    if (customCategory?.trim()) {
      try {
        category = await addCustomCategory(customCategory);
      } catch (e) {
        console.error('Saving custom category failed:', e);
        category = null;
      }
      if (!category) {
        return NextResponse.json(
          { error: "That category name can't be used. Use 2-30 letters or numbers.", listings: [] },
          { status: 400 }
        );
      }
    } else if (!category || ![...CATEGORIES, ...LEGACY_CATEGORIES, ...(await getCustomCategories())].includes(category)) {
      return NextResponse.json(
        { error: 'Category required', listings: [] },
        { status: 400 }
      );
    }

    if ((url || '').length > 500) {
      return NextResponse.json({ error: 'Link is too long (500 characters max)', listings: [] }, { status: 400 });
    }
    if ((handle || '').length > 200) {
      return NextResponse.json({ error: 'Handle is too long (200 characters max)', listings: [] }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Database not configured', listings: [] },
        { status: 500 }
      );
    }

    // A social link typed without https:// ("instagram.com/name") is a URL, not a handle.
    const typedLink = handle && looksLikeUrl(handle) && !/^https?:\/\//i.test(handle) ? `https://${handle.trim()}` : handle;
    let normalizedUrl = url || getPlatformUrl(platform, typedLink);
    let displayHandle = handle;

    if (normalizedUrl && !/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    // Store a tidy link: "HTTP://WWW.Example.COM" → "http://www.example.com/" (URL lowercases scheme and host).
    try { if (normalizedUrl) normalizedUrl = new URL(normalizedUrl).href; } catch { /* checked below */ }

    // Malware, phishing, adult, gambling, shorteners, downloads.
    const urlProblem = staticUrlProblem(normalizedUrl);
    if (urlProblem) {
      return NextResponse.json({ error: urlProblem, listings: [] }, { status: 400 });
    }
    if (await isFlaggedBySafeBrowsing(normalizedUrl)) {
      console.warn('Submission blocked by Safe Browsing:', normalizedUrl, 'user', user.id);
      return NextResponse.json(
        { error: 'This site is flagged as unsafe (malware or phishing) and cannot be listed.', listings: [] },
        { status: 400 }
      );
    }

    if (['facebook', 'instagram', 'tiktok', 'twitter', 'x'].includes(platform)) {
      const extracted = extractSocialHandle(normalizedUrl, platform);
      if (extracted) {
        displayHandle = extracted;
      }
    }

    // Same link however it's typed (http/https, www, case, trailing slash).
    if (await findDuplicateListing(normalizedUrl)) {
      return NextResponse.json(
        { error: 'URL already listed. No duplicate submissions allowed.' },
        { status: 409 }
      );
    }

    const accessProblem = await accessibilityProblem(normalizedUrl);
    if (accessProblem) {
      return NextResponse.json({ error: accessProblem }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    let imageUrl: string | null = null;
    let metaTitle = normalizedUrl;
    // Always from the site itself (or the URL): a description sent by the browser is ignored.
    let metaDescription = normalizedUrl;
    let metaPlatform = platform || 'website';

    try {
      const metadata = await extractMetadata(normalizedUrl);
      imageUrl = metadata.image;
      metaTitle = metadata.title || normalizedUrl;
      metaDescription = metadata.description || metaDescription;
      metaPlatform = metadata.platform || platform || 'website';

      if (platform === 'website' || !isSocialMediaUrl(normalizedUrl)) {
        // Relaxed validation for websites - just ensure we have some title
        if (!metaTitle || metaTitle.length < 2) {
          metaTitle = new URL(normalizedUrl).hostname;
        }
        if (!metaDescription || metaDescription.length < 3) {
          metaDescription = 'Website';
        }
      }
    } catch (err) {
      console.error('Metadata extraction failed:', err);
      try {
        const urlObj = new URL(normalizedUrl);
        metaTitle = urlObj.hostname;
        metaDescription = 'Website';
        // Preserve the platform field even if metadata extraction fails
        const hostname = urlObj.hostname.toLowerCase();
        if (hostname.includes('linkedin.com')) {
          metaPlatform = 'linkedin';
        } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
          metaPlatform = 'twitter';
        } else if (hostname.includes('facebook.com')) {
          metaPlatform = 'facebook';
        } else if (hostname.includes('instagram.com')) {
          metaPlatform = 'instagram';
        } else if (hostname.includes('tiktok.com')) {
          metaPlatform = 'tiktok';
        } else {
          metaPlatform = platform || 'website';
        }
      } catch {
        metaTitle = 'Listing';
        metaDescription = 'Website listing';
        metaPlatform = platform || 'website';
      }
    }

    const titleLower = metaTitle.toLowerCase();
    const descLower = metaDescription.toLowerCase();
    const spamKeywords = [
      'viagra', 'cialis', 'casino', 'lottery', 'prize', 'click here', 'buy now', 'porn', 'xxx', 'escort',
      'betting', 'jackpot', 'free money', 'crack download', 'keygen', 'giveaway', 'airdrop', 'seed phrase',
    ];
    if (spamKeywords.some(keyword => titleLower.includes(keyword) || descLower.includes(keyword))) {
      return NextResponse.json(
        { error: 'Submission rejected: Content appears to be spam or promotional.' },
        { status: 400 }
      );
    }

    if (metaTitle === normalizedUrl || metaTitle.includes('https://') || metaTitle.includes('http://')) {
      return NextResponse.json(
        { error: 'Website must have a proper title. Please check that the URL is valid.' },
        { status: 400 }
      );
    }

    if (isSocialMediaUrl(normalizedUrl)) {
      // Validate that title exists and is reasonable length
      if (!metaTitle || metaTitle.length < 1) {
        metaTitle = new URL(normalizedUrl).pathname.split('/').filter(p => p)[0] || 'Account';
      }

      // Check for explicit deleted/suspended indicators
      const badIndicators = ['not found', 'deleted', 'suspended', 'unavailable', 'account suspended'];
      if (metaTitle && badIndicators.some(indicator => metaTitle.toLowerCase().includes(indicator))) {
        return NextResponse.json(
          { error: 'Social media account is deleted, suspended, or unavailable.' },
          { status: 400 }
        );
      }

      // Allow submission even if description is minimal (some profiles don't have bios)
      if (!metaDescription || metaDescription === normalizedUrl) {
        metaDescription = 'Social Media Profile';
      }

      // Use favicon if profile image not found
      if (!imageUrl) {
        const urlObj = new URL(normalizedUrl);
        imageUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=256`;
      }
    }

    // Per-account limits, checked once the submission has passed every check, so only saved listings count.
    if (
      !(await rateLimit(`submit-saved:${user.id}`, 5, 60 * 60)) ||
      !(await rateLimit(`submit-saved-day:${user.id}`, 20, 24 * 60 * 60))
    ) {
      return NextResponse.json(
        { error: 'You can submit up to 5 products an hour and 20 a day. Please try again later.', listings: [] },
        { status: 429 }
      );
    }

    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/listings`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        id,
        user_id: user.id,
        title: metaTitle,
        description: metaDescription,
        category: category || 'Other',
        platform: metaPlatform,
        status: 'active',
        location: normalizedUrl,
        price: 0,
        views: 0,
        image_url: imageUrl || null,
        created_at: now,
        updated_at: now,
      }),
    });

    if (!insertResponse.ok) {
      const error = await insertResponse.json();
      console.error('Supabase insert error:', error);
      throw new Error(error.message || 'Failed to create listing');
    }

    const listing = await insertResponse.json();
    const responseData = listing[0] || listing;

    // Its rank right after submitting (queue order: no votes yet, so it follows every listing ahead of it),
    // and the "#N Ranked on RankBid" cards for that rank. Neither may hold back the confirmation.
    const rank = await submissionRank(responseData.id, responseData.rank_reached_at || now);
    const badges = rank
      ? await badgeZip(responseData.id, rank, 'ranked')
          .then(zip => ({ filename: `rankbid-rank-${rank}.zip`, content: Buffer.from(zip) }))
          .catch(err => { console.error('Rank card zip failed:', err); return undefined; })
      : undefined;

    await Promise.all([
      sendNewSubmissionEmail({
        id: responseData.id,
        title: metaTitle,
        description: metaDescription,
        category: category || 'Other',
        platform: metaPlatform,
        url: normalizedUrl,
        imageUrl: imageUrl || undefined,
      }),
      user.email ? sendSubmissionConfirmation({ to: user.email, listingId: responseData.id, productTitle: metaTitle, rank, badges }) : null,
    ]);

    return NextResponse.json(
      {
        id: responseData.id,
        listing: responseData,
        isNew: true,
        listings: [],
        displayHandle: displayHandle,
        platform: platform
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error submitting listing:', error);

    return NextResponse.json(
      {
        error: 'Failed to submit listing. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
        listings: []
      },
      { status: 500 }
    );
  }
}

/** Overall position of a listing that has no votes yet: everything with votes, then the 0-vote listings ahead of it. */
async function submissionRank(listingId: string, reachedAt: string): Promise<number | undefined> {
  try {
    const reached = encodeURIComponent(`"${reachedAt}"`);
    const res = await fetch(
      sbUrl(`listings?select=id&id=neq.${encodeURIComponent(listingId)}&or=(total_votes.gt.0,and(total_votes.eq.0,rank_reached_at.lte.${reached}))`),
      { method: 'HEAD', headers: sbHeaders({ Prefer: 'count=exact' }), cache: 'no-store' }
    );
    if (!res.ok) return undefined;
    return (parseInt(res.headers.get('content-range')?.split('/')[1] || '0') || 0) + 1;
  } catch {
    return undefined;
  }
}

function getPlatformUrl(platform: string, handle: string | undefined): string {
  if (handle && (handle.startsWith('http://') || handle.startsWith('https://'))) {
    return handle;
  }

  const baseUrls: { [key: string]: (handle: string) => string } = {
    twitter: (h) => `https://twitter.com/${h.replace('@', '')}`,
    x: (h) => `https://x.com/${h.replace('@', '')}`,
    facebook: (h) => `https://facebook.com/${h.replace('@', '')}`,
    instagram: (h) => `https://instagram.com/${h.replace('@', '')}`,
    tiktok: (h) => `https://www.tiktok.com/@${h.replace('@', '')}`,
    linkedin: (h) => `https://linkedin.com/in/${h.replace('@', '').replace(/\//g, '')}`,
  };

  if (platform && handle && baseUrls[platform]) {
    return baseUrls[platform](handle);
  }

  return handle ? `https://twitter.com/${handle}` : 'https://example.com';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '15') || 15));
    const sort = searchParams.get('sort') || 'totalVotes';
    const category = searchParams.get('category') || '';
    const platforms = searchParams.getAll('platform') || [];
    const timeFilter = searchParams.get('timeFilter') || '';
    // ?activeToday=1: any listing that got votes today, however old (the /today trending view).
    const activeToday = searchParams.get('activeToday') === '1';
    // An explicit ?limit= returns that many rows (non-paged views); otherwise return one page of pageSize.
    const limitParam = searchParams.get('limit');
    const rowLimit = limitParam ? Math.min(1000, Math.max(1, parseInt(limitParam) || pageSize)) : pageSize;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { listings: [], listing: null, error: 'Database not configured' },
        { status: 500 }
      );
    }

    const orderColumn = sort === 'dayVotes' ? 'day_votes' : 'total_votes';
    const offset = (page - 1) * pageSize;

    // Ties go to whichever listing reached that count first (rank_reached_at), like a queue.
    let queryUrl = `${supabaseUrl}/rest/v1/listings?order=${orderColumn}.desc,rank_reached_at.asc&limit=${rowLimit}&offset=${offset}`;

    // Filter by time - only today's submissions for daily page
    if (timeFilter === 'today') {
      const now = new Date();
      const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
      const today = new Date(utcNow.getFullYear(), utcNow.getMonth(), utcNow.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayISO = today.toISOString();
      const tomorrowISO = tomorrow.toISOString();

      // Use AND filter syntax for multiple conditions
      queryUrl += `&created_at=gte.${encodeURIComponent(todayISO)}&created_at=lt.${encodeURIComponent(tomorrowISO)}`;
    }

    if (activeToday) {
      queryUrl += '&day_votes=gt.0';
    }

    if (category && category !== 'All') {
      queryUrl += `&category=eq.${encodeURIComponent(category)}`;
    }

    if (platforms.length > 0) {
      const platformFilter = platforms.map(p => `platform.eq.${encodeURIComponent(p)}`).join(',');
      queryUrl += `&or=(${platformFilter})`;
    }

    const response = await fetch(queryUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'count=exact',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase fetch failed:', response.status, errorText);
      return NextResponse.json(
        { listings: [], listing: null, error: 'Failed to fetch listings' },
        { status: 500 }
      );
    }

    const listings = await response.json();

    const mapListing = (item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      url: item.location,
      handle: item.handle,
      category: item.category || 'Other',
      platform: item.platform || 'website',
      totalVotes: item.total_votes || 0,
      dayVotes: item.day_votes || 0,
      clickCount: item.click_count || 0,
      createdAt: item.created_at,
      rankReachedAt: item.rank_reached_at || item.created_at,
      updatedAt: item.updated_at || item.created_at,
      imageUrl: selfHostedImage(item.image_url),
      isPremium: false,
      premiumPosition: null as number | null,
    });
    const mappedListings = listings.map(mapListing);

    // Live sponsored listings, ranked by price. Votes still order the main list; these also come back as `premium`
    // so the sponsored strip shows every holder, whichever page they fall on.
    // Founder email/phone stay server-side: they are for the admin, not the public page.
    const holders = await getActiveHolders();
    const withPremium = (listing: ReturnType<typeof mapListing>, holder: PremiumHolder) => ({
      ...listing,
      isPremium: true,
      premiumPosition: holder.position,
      premiumBidUsd: holder.bidUsd,
      premiumActivatedAt: holder.activatedAt,
      founderName: holder.founderName,
      founderWebsite: holder.founderWebsite,
      founderTwitter: holder.founderTwitter,
      founderLinkedin: holder.founderLinkedin,
      founderInstagram: holder.founderInstagram,
      founderFacebook: holder.founderFacebook,
      founderTiktok: holder.founderTiktok,
      founderYoutube: holder.founderYoutube,
      founderGithub: holder.founderGithub,
    });
    const holderByListing = new Map(holders.map(h => [h.listingId, h]));
    const pageListings = mappedListings.map((l: ReturnType<typeof mapListing>) => {
      const holder = holderByListing.get(l.id);
      return holder ? withPremium(l, holder) : l;
    });

    let premium: ReturnType<typeof withPremium>[] = [];
    if (holders.length > 0) {
      const ids = encodeURIComponent(holders.map(h => `"${h.listingId.replace(/"/g, '')}"`).join(','));
      const premiumRes = await fetch(`${supabaseUrl}/rest/v1/listings?id=in.(${ids})`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      });
      const rows: any[] = premiumRes.ok ? await premiumRes.json() : [];
      premium = holders.flatMap(h => {
        const row = rows.find(r => r.id === h.listingId);
        return row ? [withPremium(mapListing(row), h)] : [];
      });
    }

    // Get total from the content-range header of the main response
    let total = 0;
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      if (parts[1]) {
        total = parseInt(parts[1]) || 0;
      }
    }

    const totalPages = Math.ceil(total / pageSize);

    // Many pages poll this; the CDN serves repeats for a few seconds so the function (and Supabase)
    // isn't hit per visitor. ?fresh=1 (right after a vote or submit) always reads the database.
    const fresh = searchParams.has('fresh');
    return NextResponse.json(
      { listings: pageListings, premium, listing: null, pagination: { page, pageSize, total, totalPages } },
      {
        headers: fresh
          ? { 'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0', 'Pragma': 'no-cache', 'Expires': '0' }
          : { 'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=30' },
      }
    );
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { listings: [], listing: null, error: 'Database error' },
      { status: 500 }
    );
  }
}
