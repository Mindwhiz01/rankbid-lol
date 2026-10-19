import Link from 'next/link';
import { getTimeAgo, formatCurrency, extractDomain } from '@/lib/utils';
import { Category } from '@prisma/client';

interface ListingCardProps {
  id: string;
  title: string;
  description: string;
  url: string;
  category: Category;
  favicon?: string;
  logo?: string;
  totalPaid: number;
  dayPaid: number;
  clickCount: number;
  createdAt: Date;
  lastRaisedAt: Date;
  rank: number;
  amountToOutrank: number;
}

export default function ListingCard({
  id,
  title,
  description,
  url,
  category,
  favicon,
  logo,
  totalPaid,
  clickCount,
  createdAt,
  rank,
  amountToOutrank,
}: ListingCardProps) {
  const domain = extractDomain(url);

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-lg transition-shadow">
      <div className="flex gap-4">
        {/* Rank Badge */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center font-bold text-orange-600 dark:text-orange-400">
            #{rank}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white truncate">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{domain}</p>
            </div>
            <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded whitespace-nowrap">
              {category}
            </span>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">{description}</p>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
            <span>👁 {clickCount.toLocaleString('en-US')} clicks</span>
            <span>📅 Listed {getTimeAgo(createdAt)}</span>
          </div>
        </div>

        {/* Price & CTA */}
        <div className="flex-shrink-0 text-right">
          <div className="text-sm font-bold text-orange-600 dark:text-orange-400 mb-2">{formatCurrency(totalPaid)}</div>
          <Link
            href="/#submit"
            className="inline-block px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors"
          >
            Claim
          </Link>
        </div>
      </div>
    </div>
  );
}
