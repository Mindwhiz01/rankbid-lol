import { NextResponse } from 'next/server';
import { getCustomCategories } from '@/lib/server/custom-categories';

// GET: categories people added under "Other", offered in every category picker.
export async function GET() {
  return NextResponse.json(
    { custom: await getCustomCategories() },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' } }
  );
}
