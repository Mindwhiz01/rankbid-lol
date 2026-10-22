import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID required', product: null },
        { status: 400 }
      );
    }

    // Fetch specific product by ID
    const res = await fetch(
      `${supabaseUrl}/rest/v1/listings?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        headers: {
          'apikey': supabaseKey as string,
          'Authorization': `Bearer ${supabaseKey as string}`,
        } as HeadersInit,
      }
    );

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
      updatedAt: product.updated_at || product.created_at,
    };

    // Also fetch all listings for ranking and "more in this category".
    const allRes = await fetch(
      `${supabaseUrl}/rest/v1/listings?select=*&order=total_votes.desc,created_at.asc`,
      {
        headers: {
          'apikey': supabaseKey as string,
          'Authorization': `Bearer ${supabaseKey as string}`,
        } as HeadersInit,
      }
    );

    // Map to the same camelCase shape as `product` (the page ranks on totalVotes, then updatedAt).
    let allListings: Record<string, unknown>[] = [];
    if (allRes.ok) {
      const rows: {
        id: string; title: string; description?: string; url?: string; location?: string;
        category?: string; platform?: string; total_votes?: number; day_votes?: number; created_at: string; updated_at?: string;
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
