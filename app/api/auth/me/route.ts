import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

// Same session lookup as the submit and profile APIs, so the submit modal never asks a
// signed-in user to sign in while the API would accept them.
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
