import Image from 'next/image';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SupportVoteForm from '@/components/SupportVoteForm';
import { getListing } from '@/lib/server/votes';

// Public page behind a maker's shareable link: anyone can vote with just a name + email.

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: { absolute: 'Support a maker on RankBid' }, robots: { index: false } };

  const title = `Support ${listing.title} on RankBid`;
  const description = `Vote for ${listing.title} in under 10 seconds. No account needed.`;
  // The share card is the product's; the indexable page for this listing is /product/:id.
  const images = [`/product/${listing.id}/opengraph-image`];
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, type: 'website', images },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

export default async function SupportPage({ params }: Props) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal brand bar: guests land here from a shared link */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/brand/logo-horizontal.png" alt="RankBid" width={823} height={194} preload sizes="140px" className="h-8 w-auto" />
          </Link>
          <span className="text-xs font-semibold text-[#1F2937]/70">Community-voted rankings</span>
        </div>
      </div>

      <SupportVoteForm listing={listing} />
    </div>
  );
}
