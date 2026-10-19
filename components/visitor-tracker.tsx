'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// "Live" means active in the last 30 minutes (see /api/analytics/live-viewers), so one ping
// every 5 minutes of visible time is plenty.
const PING_MS = 5 * 60 * 1000;
let lastPing = 0;

function getSessionId(): string {
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

async function trackVisit(pageUrl: string) {
  lastPing = Date.now();
  try {
    await fetch('/api/track-visitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: getSessionId(), pageUrl }),
    });
  } catch (error) {
    console.error('[CLIENT] Failed to track visitor:', error);
  }
}

export function VisitorTracker() {
  const pathname = usePathname();

  // Track every page navigation
  useEffect(() => {
    trackVisit(pathname);
  }, [pathname]);

  // Keep the session live while the tab is open and visible
  useEffect(() => {
    const pingIfDue = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastPing >= PING_MS) trackVisit(pathname);
    };
    const interval = setInterval(pingIfDue, PING_MS);
    document.addEventListener('visibilitychange', pingIfDue);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', pingIfDue);
    };
  }, [pathname]);

  return null;
}
