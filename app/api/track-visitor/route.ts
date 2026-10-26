import { trackVisitor } from '@/lib/visitor-tracking';
import { NextRequest, NextResponse } from 'next/server';
import { ipHash, rateLimit } from '@/lib/server/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // A script could otherwise post endless made-up session ids, inflating the visitor counts and the table.
    // Generous, since every page view posts once and offices share one network.
    if (!(await rateLimit(`track-ip:${ipHash(request)}`, 300, 60 * 60))) {
      return NextResponse.json({ success: false }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 100) : '';
    const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 500) : '';
    if (!sessionId) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const userAgent = (request.headers.get('user-agent') || '').slice(0, 300);
    // A salted hash, not the raw IP: enough to tell visitors apart, without storing personal data.
    const ipAddress = ipHash(request);

    const result = await trackVisitor(sessionId, userAgent, ipAddress, pageUrl);

    return NextResponse.json({ success: result.success });
  } catch (error) {
    console.error('Tracking error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
