import { afterEach, beforeEach, vi } from 'vitest';

// Any fetch a test hasn't mocked fails loudly, so a test can never reach a real service.
// Live tests (tests/live) talk to a deployed site and keep the real fetch.
const realFetch = globalThis.fetch;
const isLive = Boolean(process.env.BASE_URL);

beforeEach(() => {
  if (isLive) return;
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    throw new Error(`Unmocked fetch in test: ${String(input)}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (isLive) globalThis.fetch = realFetch;
});
