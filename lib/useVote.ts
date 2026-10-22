'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const VOTED_KEY = 'rankbid_voted_listings';

function readVoted(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(VOTED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

// Same-tab change notifications (the browser 'storage' event only fires for other tabs).
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function getUser(): { id: string } | null {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

/**
 * Vote state for one listing, shared by ranking rows and the product page.
 * Clicks flip the button and count at once; the server is brought in line in the background,
 * and the button only flips back if the server refuses. Clicking "Voted" again takes the vote back.
 * Logged-out visitors are sent to /login and brought back afterwards.
 * `baseVotes` is the count on screen before this visitor's clicks: when a live refresh brings a new one,
 * it already includes their synced vote, so the optimistic +1 is dropped.
 */
export function useVote(listingId: string, baseVotes?: number) {
  const voted = useSyncExternalStore(subscribe, () => readVoted().has(listingId), () => false);
  const [extraVotes, setExtraVotes] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  // What the server has for this user (null until the first click), and whether a request is running.
  const serverVoted = useRef<boolean | null>(null);
  const syncing = useRef(false);

  // A fresh server count replaces the optimistic one.
  useEffect(() => {
    if (!syncing.current) setExtraVotes(0);
  }, [baseVotes]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  };

  const rememberVoted = (on: boolean) => {
    const set = readVoted();
    if (on) set.add(listingId);
    else set.delete(listingId);
    localStorage.setItem(VOTED_KEY, JSON.stringify([...set]));
    listeners.forEach(l => l());
  };

  const toLogin = () => {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  };

  // Sends votes / unvotes until the server matches what's on screen. Fast double clicks
  // just change the target, so they never wait on each other.
  const sync = async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      while (readVoted().has(listingId) !== serverVoted.current) {
        const want = readVoted().has(listingId);
        let res: Response | null = null;
        let data: { success?: boolean; error?: string } = {};
        try {
          res = await fetch('/api/votes', {
            method: want ? 'POST' : 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listingId }),
          });
          data = await res.json().catch(() => ({}));
        } catch {
          res = null;
        }

        if (res?.ok && data.success) {
          serverVoted.current = want;
          continue;
        }
        if (want && data.error === 'Already voted') {
          // It was already counted, so the extra +1 on screen goes.
          serverVoted.current = true;
          setExtraVotes(n => n - 1);
          continue;
        }

        // Refused: put the button and count back to what the server has.
        rememberVoted(!want);
        setExtraVotes(n => n + (want ? -1 : 1));
        if (res?.status === 401) {
          toLogin();
        } else {
          flash(data.error || (want ? 'Vote failed, try again' : 'Could not remove vote, try again'));
        }
        break;
      }
    } finally {
      syncing.current = false;
    }
  };

  const vote = () => {
    if (!getUser()) {
      toLogin();
      return;
    }
    if (serverVoted.current === null) serverVoted.current = voted;
    const next = !voted;
    rememberVoted(next);
    setExtraVotes(n => n + (next ? 1 : -1));
    flash(next ? 'Vote recorded!' : 'Vote removed');
    void sync();
  };

  return { voted, extraVotes, message, vote };
}
