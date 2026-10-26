import { updateAccount } from '@/lib/server/account';
import { getSessionUser } from '@/lib/server/session';
import { NextRequest, NextResponse } from 'next/server';

// The profile is always the signed-in user's own, identified by the session cookie.

export async function GET(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(session);
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json().catch(() => ({}));
    if (name !== undefined && (typeof name !== 'string' || name.length > 80)) {
      return NextResponse.json({ error: 'Name must be 80 characters or fewer' }, { status: 400 });
    }

    if (name === undefined) return NextResponse.json(session);
    const user = await updateAccount(session.id, { name: name.trim() || null });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
