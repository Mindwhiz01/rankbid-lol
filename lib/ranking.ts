import { prisma } from './prisma';
import { Category } from '@prisma/client';

export interface RankedListing {
  id: string;
  title: string;
  description: string;
  url: string;
  handle?: string;
  category: Category;
  favicon?: string;
  logo?: string;
  totalVotes: number;
  dayVotes: number;
  clickCount: number;
  createdAt: Date;
  rank: number;
  votesToOutrank: number;
}

export async function getRankedListings(
  category: Category | 'All' = 'All',
  timeWindow: 'alltime' | 'today' | 'daily' = 'alltime',
  dailyDate?: Date
): Promise<RankedListing[]> {
  let listings;

  if (timeWindow === 'alltime') {
    listings = await prisma.listing.findMany({
      where: category !== 'All' ? { category } : {},
      orderBy: { totalVotes: 'desc' },
    });

    return listings.map((listing, index) => ({
      ...listing,
      handle: listing.handle || undefined,
      rank: index + 1,
      votesToOutrank: listing.totalVotes + 1,
    }));
  }

  if (timeWindow === 'today') {
    listings = await prisma.listing.findMany({
      where: category !== 'All' ? { category } : {},
      orderBy: { dayVotes: 'desc' },
    });

    return listings.map((listing, index) => ({
      ...listing,
      handle: listing.handle || undefined,
      rank: index + 1,
      votesToOutrank: listing.dayVotes + 1,
    }));
  }

  return [];
}

export async function calculateDayVotes(listingId: string): Promise<number> {
  // Calculate dayVotes as the count of all votes from today (UTC midnight to now)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const count = await prisma.vote.count({
    where: {
      listingId,
      votedAt: { gte: today },
    },
  });

  return count;
}

export async function getTotalVotes(listingId: string): Promise<number> {
  const count = await prisma.vote.count({
    where: {
      listingId,
    },
  });

  return count;
}

export async function updateRankingCache() {
  // This runs periodically to update vote counts
  const listings = await prisma.listing.findMany();

  for (const listing of listings) {
    const dayVotes = await calculateDayVotes(listing.id);
    const totalVotes = await getTotalVotes(listing.id);

    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        dayVotes,
        totalVotes,
      },
    });
  }
}
