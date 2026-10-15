'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BadgeDollarSign, ChevronDown, CreditCard, FileText, Heart, LayoutGrid, LogOut, Search, ShieldCheck, UserRound, Users } from 'lucide-react';

/** Dashboard tabs (on /admin, switched with ?tab=) plus the payment approval page. */
export const ADMIN_TABS = [
  ['live', 'Overview', LayoutGrid],
  ['submissions', 'Submissions', FileText],
  ['users', 'Users', Users],
  ['votes', 'Votes', Heart],
  ['sponsored', 'Sponsored', BadgeDollarSign],
  ['team', 'Admin team', ShieldCheck],
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number][0];
type Active = AdminTab | 'payments';

const SIDE_ITEMS: readonly (readonly [Active, string, typeof LayoutGrid])[] = [...ADMIN_TABS, ['payments', 'Approve payments', CreditCard]];

/**
 * Admin frame shared by /admin and /admin/premium: dark icon rail, rounded light canvas,
 * greeting bar with search and an account menu. On /admin the rail switches tabs in place
 * (onSelect); elsewhere it links back to /admin?tab=….
 */
export default function AdminShell({
  active,
  onSelect,
  onSignOut,
  onSearch,
  status,
  accountMenu,
  children,
}: {
  active: Active;
  onSelect?: (tab: AdminTab) => void;
  onSignOut: () => void;
  /** Search submissions; without it the box sends you to the Submissions tab on /admin. */
  onSearch?: (query: string) => void;
  /** Small badge next to the greeting (e.g. live connection). */
  status?: ReactNode;
  /** Extra controls inside the "My account" menu. */
  accountMenu?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (onSearch) onSearch(q);
    else router.push(`/admin?tab=submissions${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  };

  const railItem = (key: Active, label: string, Icon: typeof LayoutGrid) => {
    const on = active === key;
    const cls = `group relative flex items-center justify-center w-11 h-11 rounded-2xl transition-colors ${
      on ? 'text-white bg-white/10' : 'text-white/35 hover:text-white/80 hover:bg-white/5'
    }`;
    const inner = (
      <>
        {on && <span className="absolute -left-[22px] top-1/2 -translate-y-1/2 w-1.5 h-7 rounded-r-full bg-amber-400" aria-hidden />}
        <Icon className="w-5 h-5" />
        <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-[#0B2545] px-2.5 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
          {label}
        </span>
      </>
    );
    if (key === 'payments') {
      return <Link key={key} href="/admin/premium" aria-label={label} aria-current={on ? 'page' : undefined} className={cls}>{inner}</Link>;
    }
    return onSelect ? (
      <button key={key} type="button" onClick={() => onSelect(key)} aria-label={label} aria-current={on ? 'page' : undefined} className={cls}>{inner}</button>
    ) : (
      <Link key={key} href={`/admin?tab=${key}`} aria-label={label} className={cls}>{inner}</Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B2545] to-[#0F3460] text-[#1F2937] md:flex">
      {/* Icon rail (top bar on phones) */}
      <aside className="md:sticky md:top-0 md:h-screen md:w-[88px] flex-shrink-0 flex md:flex-col items-center gap-2 md:gap-0 px-4 md:px-0 py-3 md:py-7">
        <Link href="/admin" aria-label="RankBid admin" className="md:mb-12 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark-white.png" alt="RankBid" className="w-9 h-9 object-contain" />
        </Link>
        <nav className="flex md:flex-col items-center gap-1 md:gap-3 overflow-x-auto">
          {SIDE_ITEMS.map(([key, label, Icon]) => railItem(key, label, Icon))}
        </nav>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className="ml-auto md:ml-0 md:mt-auto flex items-center justify-center w-11 h-11 rounded-2xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </aside>

      {/* Canvas */}
      <div className="flex-1 min-w-0 md:py-3 md:pr-3">
        <div className="min-h-screen md:min-h-[calc(100vh-1.5rem)] bg-[#F4F6FA] md:rounded-[32px] px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          <header className="flex flex-wrap items-center gap-4 mb-8">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-[#0F3460] flex items-center justify-center text-2xl shadow-sm" aria-hidden>
                👋
              </span>
              <div className="min-w-0">
                <p className="text-lg font-black leading-tight flex items-center gap-2">Greetings! {status}</p>
                <p className="text-sm text-[#1F2937]/55">Start your day with RankBid</p>
              </div>
            </div>

            <form onSubmit={submitSearch} className="order-3 lg:order-none w-full lg:w-auto lg:flex-1 lg:max-w-xl lg:mx-auto">
              <label className="flex items-center gap-3 rounded-full bg-white border border-gray-200 px-5 h-12 focus-within:ring-2 focus-within:ring-[#0F3460]/25 focus-within:border-[#0F3460]">
                <Search className="w-5 h-5 text-[#1F2937]/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search submissions"
                  aria-label="Search submissions"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#1F2937]/40"
                />
              </label>
            </form>

            <div ref={menuRef} className="relative ml-auto lg:ml-0">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                className="flex items-center gap-2 h-12 px-5 rounded-full bg-[#0F3460] text-white text-sm font-bold hover:bg-[#0B2545] transition-colors shadow-lg shadow-[#0F3460]/20"
              >
                <UserRound className="w-5 h-5" /> My account <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white shadow-xl border border-black/5 p-2 z-40">
                  {accountMenu && <div className="p-2 border-b border-gray-100 mb-1">{accountMenu}</div>}
                  <Link href="/" className="block px-3 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50">View site ↗</Link>
                  <button type="button" onClick={onSignOut} className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}
