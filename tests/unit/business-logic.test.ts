import { describe, expect, it } from 'vitest';
import { bidForRank, rankForBid } from '@/lib/premiumSpots';
import { detectPlatform, listingUrlKey, platformUrlProblem } from '@/lib/platform-url';
import { canonicalEmail, isDisposableEmail } from '@/lib/server/guest-email';

describe('sponsored ranking by price', () => {
  it('ranks a bid below every bid that is at least as high (earlier bids win ties)', () => {
    expect(rankForBid(50, [])).toBe(1);
    expect(rankForBid(50, [100, 20])).toBe(2);
    expect(rankForBid(50, [50])).toBe(2);
    expect(rankForBid(1000, [100, 50, 20])).toBe(1);
  });

  it('prices a rank so the bid lands on it', () => {
    const bids = [100, 50, 20];
    for (const rank of [1, 2, 3, 4]) {
      expect(rankForBid(bidForRank(rank, bids), bids)).toBeLessThanOrEqual(rank);
    }
  });
});

describe('duplicate-link detection', () => {
  it('treats one link typed different ways as the same', () => {
    const key = listingUrlKey('https://mindwhiz.com/');
    expect(key).toBeTruthy();
    expect(listingUrlKey('http://www.MindWhiz.com')).toBe(key);
    expect(listingUrlKey('mindwhiz.com/')).toBe(key);
  });

  it('keeps different pages apart', () => {
    expect(listingUrlKey('https://example.com/a')).not.toBe(listingUrlKey('https://example.com/b'));
  });
});

describe('platform checks on submit', () => {
  it('detects the platform from the link', () => {
    expect(detectPlatform('https://www.linkedin.com/in/someone')).toBe('linkedin');
    expect(detectPlatform('https://x.com/someone')).toBe('twitter');
    expect(detectPlatform('https://mindwhiz.com')).toBe('website');
  });

  it('refuses a link from another platform than the tab picked', () => {
    expect(platformUrlProblem('instagram', 'https://www.linkedin.com/in/someone')).toBeTruthy();
    expect(platformUrlProblem('linkedin', 'https://www.linkedin.com/in/someone')).toBeNull();
  });
});

describe('guest voter emails (one vote per inbox)', () => {
  it('folds Gmail aliases and +tags into one inbox', () => {
    expect(canonicalEmail('Jo.Doe+vote2@googlemail.com')).toBe('jodoe@gmail.com');
    expect(canonicalEmail('jo.doe@gmail.com')).toBe('jodoe@gmail.com');
    expect(canonicalEmail('jo.doe+x@company.com')).toBe('jo.doe@company.com');
  });

  it('flags throwaway and reserved domains', () => {
    expect(isDisposableEmail('a@mailinator.com')).toBe(true);
    expect(isDisposableEmail('a@x.mailinator.com')).toBe(true);
    expect(isDisposableEmail('a@example.com')).toBe(true);
    expect(isDisposableEmail('a@site.test')).toBe(true);
    expect(isDisposableEmail('a@gmail.com')).toBe(false);
  });
});
