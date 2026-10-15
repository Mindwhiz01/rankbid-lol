'use client';

// The server counts one click per visitor per listing every CLICK_WINDOW_MS (see /api/click).
// Rows mirror that here so the number on screen only goes up when the click will really count.
const KEY = 'rankbid_clicked';
const CLICK_WINDOW_MS = 30 * 60 * 1000;

/** True if a click on this listing now would be counted; records it if so. */
export function claimClick(listingId: string): boolean {
  try {
    const now = Date.now();
    const seen: Record<string, number> = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const id of Object.keys(seen)) if (now - seen[id] > CLICK_WINDOW_MS) delete seen[id];
    if (seen[listingId]) return false;
    seen[listingId] = now;
    localStorage.setItem(KEY, JSON.stringify(seen));
    return true;
  } catch {
    return false;
  }
}
