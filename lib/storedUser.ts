// The signed-in user's public details, cached in localStorage ('user') by login, signup and email
// confirmation so pages can show them without a request. The auth cookie is what the API trusts; this is
// display state only. Read it with useStoredUser (not an effect + setState), write it with setStoredUser.
import { useSyncExternalStore } from 'react';

const KEY = 'user';
/** Same-tab writes; other tabs fire the browser's own 'storage' event. */
const CHANGE_EVENT = 'rankbid:user-change';

export interface StoredUser {
  id: string;
  email: string;
  name?: string | null;
}

// useSyncExternalStore needs the same object back while nothing changed, so parse once per stored string.
let cache: { raw: string | null; user: StoredUser | null } | null = null;

/** The stored user, or null (signed out, storage blocked, or unreadable). */
export function readStoredUser<T extends StoredUser = StoredUser>(): T | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage blocked (private mode, sandboxed frame): treat as signed out.
  }
  if (cache?.raw !== raw) {
    let user: StoredUser | null = null;
    try {
      user = raw ? JSON.parse(raw) : null;
    } catch {
      user = null;
    }
    cache = { raw, user: user && typeof user === 'object' && typeof user.id === 'string' ? user : null };
  }
  return cache.user as T | null;
}

/** Saves (or, with null, clears) the stored user and updates every component reading it. */
export function setStoredUser(user: StoredUser | null): void {
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: components still update below from what they can read.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * The stored user, kept current. Null on the server and during hydration, so the server HTML and the
 * first client render match; pair with useHydrated to tell "signed out" from "not read yet".
 */
export function useStoredUser<T extends StoredUser = StoredUser>(): T | null {
  return useSyncExternalStore(subscribe, readStoredUser, () => null) as T | null;
}

const noSubscription = () => () => {};

/** False on the server and during hydration, true after: for values only the browser knows. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}
