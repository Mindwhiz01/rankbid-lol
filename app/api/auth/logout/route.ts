import { NextRequest, NextResponse } from 'next/server';
import { sbHeaders, sbUrl } from '@/lib/server/votes';

// POST: sign out. Ends the session on the server (deletes the row) and drops the httpOnly cookie,
// so the API stops treating this browser as signed in.
export async function POST(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;
  if (token) {
    await fetch(sbUrl(`sessions?token=eq.${encodeURIComponent(token)}`), { method: 'DELETE', headers: sbHeaders() })
      .catch(err => console.error('Logout: failed to delete session', err));
  }
  const res = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.cookies.delete('auth_token');
  return res;
}
