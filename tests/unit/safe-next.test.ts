import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/safe-next';

describe('safeNextPath (post sign-in redirect target)', () => {
  it.each([
    '/\\evil.com',
    '/\\/evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    '//evil.com',
    '///evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    'evil.com',
    '',
  ])('refuses off-site target %j', raw => {
    expect(safeNextPath(raw, '/')).toBe('/');
  });

  it('refuses a missing value', () => {
    expect(safeNextPath(null, '/fallback')).toBe('/fallback');
    expect(safeNextPath(undefined, '/fallback')).toBe('/fallback');
  });

  it.each([
    ['/profile', '/profile'],
    ['/sponsor?listing=abc&cancelled=1', '/sponsor?listing=abc&cancelled=1'],
    ['/#submit', '/#submit'],
    ['/product/123#votes', '/product/123#votes'],
  ])('keeps same-site path %j', (raw, want) => {
    expect(safeNextPath(raw, '/')).toBe(want);
  });
});
