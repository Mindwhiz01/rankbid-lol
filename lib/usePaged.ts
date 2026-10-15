'use client';

import { useId, useState } from 'react';
import { PAGE_SIZE } from '@/components/Pagination';

/**
 * Splits an already-loaded list into pages of PAGE_SIZE for <Pagination>.
 * Goes back to page 1 when `resetKey` changes (a new tab or filter), and stays in range when a live
 * refresh shrinks the list. Put `anchorId` on the list so changing page scrolls back to its top.
 */
export function usePaged<T>(items: T[], resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const [key, setKey] = useState(resetKey);
  const anchorId = useId();
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  // Reset during render (not in an effect) so the old page never flashes for the new list.
  if (key !== resetKey) {
    setKey(resetKey);
    setPage(1);
  }

  const current = Math.min(page, totalPages);
  const offset = (current - 1) * PAGE_SIZE;

  const goTo = (p: number) => {
    setPage(p);
    document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return { page: current, totalPages, offset, pageItems: items.slice(offset, offset + PAGE_SIZE), goTo, anchorId };
}
