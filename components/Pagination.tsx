import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Every list of submissions on the site shows this many per page. */
export const PAGE_SIZE = 15;

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** Client lists: called with the page to show. */
  onPageChange?: (page: number) => void;
  /** Server-rendered lists: the URL of each page, so every page is a real link crawlers can follow. */
  hrefFor?: (page: number) => string;
  className?: string;
}

/** 1 … 4 5 6 … 12: the first and last page, the current one and its neighbours. */
function pageNumbers(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(current - 1, total - 4));
  const end = Math.min(total - 1, Math.max(current + 1, 5));
  const out: (number | 'gap')[] = [1];
  if (start > 2) out.push('gap');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push('gap');
  out.push(total);
  return out;
}

const BASE = 'h-9 sm:h-10 inline-flex items-center justify-center rounded-lg text-xs sm:text-sm font-bold transition-all';
const NUMBER = `${BASE} min-w-9 sm:min-w-10 px-2 border`;
const IDLE = 'border-gray-200 bg-white text-[#1F2937] hover:border-[#0F3460] hover:text-[#0F3460] active:scale-95';
const ACTIVE = 'border-[#0F3460] bg-[#0F3460] text-white shadow-sm';
const STEP = `${BASE} gap-1 px-2.5 sm:px-3.5 border border-gray-200 bg-white text-[#0F3460] hover:border-[#0F3460] active:scale-95`;
const STEP_OFF = `${BASE} gap-1 px-2.5 sm:px-3.5 border border-gray-100 bg-white text-[#1F2937]/30 cursor-not-allowed`;

export default function Pagination({ currentPage, totalPages, onPageChange, hrefFor, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const control = (page: number, cls: string, children: React.ReactNode, label: string, current = false) =>
    hrefFor ? (
      <Link key={label} href={hrefFor(page)} scroll className={cls} aria-label={label} aria-current={current ? 'page' : undefined}>
        {children}
      </Link>
    ) : (
      <button key={label} type="button" onClick={() => onPageChange?.(page)} className={cls} aria-label={label} aria-current={current ? 'page' : undefined}>
        {children}
      </button>
    );

  const prev = currentPage > 1;
  const next = currentPage < totalPages;

  return (
    <nav aria-label="Pagination" className={`flex items-center justify-center gap-1.5 sm:gap-2 mt-6 sm:mt-10 flex-wrap ${className}`}>
      {prev
        ? control(currentPage - 1, STEP, <><ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Prev</span></>, 'Previous page')
        : <span className={STEP_OFF} aria-hidden="true"><ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Prev</span></span>}

      {pageNumbers(currentPage, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="w-5 text-center text-[#1F2937]/40 font-bold" aria-hidden="true">…</span>
        ) : (
          control(p, `${NUMBER} ${p === currentPage ? ACTIVE : IDLE}`, p, `Page ${p}`, p === currentPage)
        )
      )}

      {next
        ? control(currentPage + 1, STEP, <><span className="hidden sm:inline">Next</span><ChevronRight className="w-4 h-4" /></>, 'Next page')
        : <span className={STEP_OFF} aria-hidden="true"><span className="hidden sm:inline">Next</span><ChevronRight className="w-4 h-4" /></span>}
    </nav>
  );
}
