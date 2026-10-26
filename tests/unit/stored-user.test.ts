import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStoredUser, setStoredUser } from '@/lib/storedUser';

// A minimal browser: localStorage plus window events.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', new EventTarget());
});

describe('stored user', () => {
  it('reads what login saved, and returns the same object while nothing changed', () => {
    store.set('user', JSON.stringify({ id: 'u1', email: 'a@b.co', name: 'A' }));
    const first = readStoredUser();
    expect(first).toEqual({ id: 'u1', email: 'a@b.co', name: 'A' });
    // useSyncExternalStore re-renders forever if each read returns a new object.
    expect(readStoredUser()).toBe(first);
  });

  it('treats a missing, corrupt or wrong-shaped value as signed out', () => {
    expect(readStoredUser()).toBeNull();
    store.set('user', '{not json');
    expect(readStoredUser()).toBeNull();
    store.set('user', JSON.stringify({ email: 'no-id@b.co' }));
    expect(readStoredUser()).toBeNull();
    store.set('user', '"just a string"');
    expect(readStoredUser()).toBeNull();
  });

  it('treats blocked storage as signed out', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('SecurityError'); } });
    expect(readStoredUser()).toBeNull();
  });

  it('setStoredUser saves or clears, and tells subscribers', () => {
    const changed = vi.fn();
    window.addEventListener('rankbid:user-change', changed);
    setStoredUser({ id: 'u2', email: 'c@d.co' });
    expect(readStoredUser()).toEqual({ id: 'u2', email: 'c@d.co' });
    setStoredUser(null);
    expect(readStoredUser()).toBeNull();
    expect(store.has('user')).toBe(false);
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
