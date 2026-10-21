import { prisma } from '@/lib/prisma';
import { OAuth2Client } from 'google-auth-library';
import { createSessionToken } from '@/lib/server/session';
import { NextRequest, NextResponse } from 'next/server';

const client = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Only trust addresses Google has verified; otherwise anyone could claim an existing account's email.
    if (!payload || !payload.email || payload.email_verified !== true) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    if (!user) {
      // Create new user with Google profile info
      user = await prisma.user.create({
        data: {
          email: payload.email.toLowerCase(),
          name: payload.name || undefined,
          password: 'google_oauth', // Placeholder for OAuth users
        },
      });
    }

    // Create session
    const sessionToken = createSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt,
      },
    });

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      },
      { status: 200 }
    );

    response.cookies.set('auth_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Google OAuth error:', error);
    return NextResponse.json(
      { error: 'Google authentication failed' },
      { status: 500 }
    );
  }
}
