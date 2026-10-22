'use client';

import { useEffect, useRef } from 'react';

/** How often open ranking pages pick up other people's votes. */
export const LIVE_REFRESH_MS = 15_000;

/**
 * Calls `refresh` every `ms` while the tab is visible, and right away when the visitor comes back to it,
 * so votes cast by other people show up without a reload.
 */
export function useLiveRefresh(refresh: () => void, ms = LIVE_REFRESH_MS) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    const timer = setInterval(run, ms);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
    };
  }, [ms]);
}
