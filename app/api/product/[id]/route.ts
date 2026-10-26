import { NextRequest, NextResponse } from 'next/server';

import { sbHeaders, sbUrl, supabaseConfigured } from '@/lib/server/votes';

// Only the columns the product page reads: every listing is sent for its rank and "more in this category".
const RANK_COLUMNS = 'id,title,description,location,category,platform,total_votes,day_votes,created_at,updated_at,rank_reached_at';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured', product: null }, { status: 500 });
  }
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID required', product: null },
        { status: 400 }
      );
    }

    // Fetch specific product by ID
    const res = await fetch(sbUrl(`listings?id=eq.${encodeURIComponent(id)}&select=*`), { headers: sbHeaders() });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch product', product: null },
        { status: res.status }
      );
    }

    const listings = await res.json();
    const product = listings[0] || null;

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found', product: null },
        { status: 404 }
      );
    }

    // Map database schema to expected schema
    const mappedProduct = {
      id: product.id,
      title: product.title,
      description: product.description,
      url: product.location || product.url,
      category: product.category || 'Other',
      platform: product.platform || 'website',
      totalVotes: product.total_votes || 0,
      dayVotes: product.day_votes || 0,
      clickCount: product.click_count || 0,
      createdAt: product.created_at,
      rankReachedAt: product.rank_reached_at || product.created_at,
      updatedAt: product.updated_at || product.created_at,
    };

    // Also fetch all listings for ranking and "more in this category".
    const allRes = await fetch(sbUrl(`listings?select=${RANK_COLUMNS}&order=total_votes.desc,rank_reached_at.asc`), { headers: sbHeaders() });

    // Map to the same camelCase shape as `product` (the page ranks on totalVotes, then rankReachedAt).
    let allListings: Record<string, unknown>[] = [];
    if (allRes.ok) {
      const rows: {
        id: string; title: string; description?: string; url?: string; location?: string;
        category?: string; platform?: string; total_votes?: number; day_votes?: number; created_at: string; updated_at?: string; rank_reached_at?: string;
      }[] = await allRes.json();
      allListings = rows.map(l => ({
        id: l.id,
        title: l.title,
        description: l.description || '',
        url: l.location || l.url || '',
        category: l.category || 'Other',
        platform: l.platform || 'website',
        totalVotes: l.total_votes || 0,
        dayVotes: l.day_votes || 0,
        createdAt: l.created_at,
        rankReachedAt: l.rank_reached_at || l.created_at,
        updatedAt: l.updated_at || l.created_at,
      }));
    } else {
      console.error('Failed to fetch listings for ranking:', allRes.status, await allRes.text());
    }

    return NextResponse.json({
      product: mappedProduct,
      allListings: allListings,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Internal server error', product: null },
      { status: 500 }
    );
  }
}
