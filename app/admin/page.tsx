'use client';

import { Fragment, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AdminShell, { ADMIN_TABS, type AdminTab } from '@/components/AdminShell';
import AdminPayments from '@/components/AdminPayments';
import PageNav, { PAGE_SIZE } from '@/components/Pagination';
import { PLATFORM_LABELS, normalizePlatform } from '@/lib/platform-url';
import { safeExternalUrl } from '@/lib/utils';
import {
  AlertTriangle, ArrowDown, ArrowUp, Ban, ChevronDown, ChevronRight, ExternalLink, Eye, FileText, Mail, Minus,
  Pencil, RefreshCw, Search, Trash2, TrendingUp, Trophy, UserCheck, UserPlus, Users, X, Zap,
} from 'lucide-react';
import { logoUrl } from '@/lib/logo';

// ---- Types (mirror lib/server/admin.ts) ----

interface AdminListing {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  platform: string;
  imageUrl: string | null;
  totalVotes: number;
  dayVotes: number;
  views: number;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: { email: string; name: string | null } | null;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  signIn: 'password' | 'google';
  isAdmin: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  emailVerified: boolean;
  createdAt: string;
  submissions: number;
  submissionVotes: number;
}

interface LiveSnapshot {
  generatedAt: string;
  stats: {
    totalUsers: number;
    totalListings: number;
    totalVotes: number;
    submissionsToday: number;
    votesToday: number;
    usersToday: number;
  };
  leaderboard: AdminListing[];
  todayLeaderboard: AdminListing[];
  recentSubmissions: AdminListing[];
}

interface Pagination { total: number; page: number; limit: number; pages: number }

type Tab = AdminTab;
type ConnState = 'connecting' | 'live' | 'reconnecting';
type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };
/** typeToConfirm: a word the admin must type before the confirm button works (for actions that can't be taken back quietly). */
type ConfirmOptions = { title: string; message: React.ReactNode; confirmLabel: string; typeToConfirm?: string };
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

// ---- Helpers ----

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

const fmt = (n: number) => n.toLocaleString();

async function removeListings(ids: string[]): Promise<string[]> {
  const res = await fetch('/api/admin/listings', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingIds: ids }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to remove');
  return (await res.json()).removed as string[];
}

// ---- Live feed hook ----

/** Subscribes to /api/admin/live and tracks rank movement + newly arrived submissions. */
function useLiveFeed(enabled: boolean, onNewSubmissions: (listings: AdminListing[]) => void) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [conn, setConn] = useState<ConnState>('connecting');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [rankDelta, setRankDelta] = useState<Record<string, number | 'new'>>({});
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const prev = useRef<LiveSnapshot | null>(null);
  const onNew = useRef(onNewSubmissions);
  useEffect(() => { onNew.current = onNewSubmissions; });

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource('/api/admin/live');

    es.addEventListener('open', () => setConn('live'));
    es.addEventListener('error', () => setConn('reconnecting'));
    es.addEventListener('ping', (e) => {
      setConn('live');
      setLastUpdate(JSON.parse((e as MessageEvent).data).generatedAt);
    });
    es.addEventListener('snapshot', (e) => {
      const next: LiveSnapshot = JSON.parse((e as MessageEvent).data);
      const before = prev.current;
      setConn('live');
      setLastUpdate(next.generatedAt);

      if (before) {
        // Rank movement on the all-time board: positive = moved up.
        const oldRank = new Map(before.leaderboard.map((l, i) => [l.id, i]));
        const deltas: Record<string, number | 'new'> = {};
        next.leaderboard.forEach((l, i) => {
          const was = oldRank.get(l.id);
          deltas[l.id] = was === undefined ? 'new' : was - i;
        });
        setRankDelta((d) => {
          // Keep the last real movement until the listing moves again.
          const merged = { ...d };
          for (const [id, v] of Object.entries(deltas)) if (v !== 0) merged[id] = v;
          return merged;
        });

        // New = not in the previous list and created around/after the previous check (an older
        // listing can slide into the list when a newer one is removed; that isn't a new submission).
        const seen = new Set(before.recentSubmissions.map((l) => l.id));
        const cutoff = new Date(before.generatedAt).getTime() - 60_000;
        const arrived = next.recentSubmissions.filter((l) => !seen.has(l.id) && new Date(l.createdAt).getTime() > cutoff);
        if (arrived.length > 0) {
          onNew.current(arrived);
          setFreshIds((s) => new Set([...s, ...arrived.map((l) => l.id)]));
          setTimeout(() => {
            setFreshIds((s) => {
              const copy = new Set(s);
              arrived.forEach((l) => copy.delete(l.id));
              return copy;
            });
          }, 15_000);
        }
      }
      prev.current = next;
      setSnapshot(next);
    });

    return () => es.close();
  }, [enabled]);

  /** Drop removed listings from the current view right away instead of waiting for the next push. */
  const dropListings = useCallback((ids: string[]) => {
    const gone = new Set(ids);
    setSnapshot((s) => {
      if (!s) return s;
      const next = {
        ...s,
        leaderboard: s.leaderboard.filter((l) => !gone.has(l.id)),
        todayLeaderboard: s.todayLeaderboard.filter((l) => !gone.has(l.id)),
        recentSubmissions: s.recentSubmissions.filter((l) => !gone.has(l.id)),
      };
      prev.current = next;
      return next;
    });
  }, []);

  return { snapshot, conn, lastUpdate, rankDelta, freshIds, dropListings };
}

// ---- Confirm dialog ----

/** Themed replacement for window.confirm(): `await confirmAction({...})` resolves true on confirm. */
function useConfirm() {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirmAction = useCallback<ConfirmFn>(
    (options) => new Promise((resolve) => setPending({ ...options, resolve })),
    []
  );
  const close = useCallback((ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  }, [pending]);

  const dialog = pending ? <ConfirmDialog {...pending} onClose={close} /> : null;
  return { confirmAction, dialog };
}

function ConfirmDialog({ title, message, confirmLabel, typeToConfirm, onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState('');
  const confirmable = !typeToConfirm || typed.trim() === typeToConfirm;

  useEffect(() => {
    // Focus Cancel, so pressing Enter by reflex never deletes anything.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0F3460]/40 backdrop-blur-sm" onClick={() => onClose(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="relative w-full max-w-md bg-white rounded-3xl-2xl overflow-hidden"
      >
        <div className="p-6 flex gap-4">
          <div className="shrink-0 w-11 h-11 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-black text-[#1F2937]">{title}</h2>
            <div id="confirm-message" className="mt-1.5 text-sm text-gray-600 break-words">{message}</div>
            {typeToConfirm && (
              <label className="mt-3 block text-sm font-semibold text-[#1F2937]">
                Type <span className="font-mono font-black">{typeToConfirm}</span> to confirm
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0F3460] font-mono"
                />
              </label>
            )}
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={() => onClose(false)}
            className="px-4 py-2 rounded-lg text-sm font-bold text-[#1F2937] bg-white border border-gray-300 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F3460]/40"
          >
            Cancel
          </button>
          <button
            onClick={() => onClose(true)}
            disabled={!confirmable}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-red-600/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Page ----

export default function AdminPage() {
  // useSearchParams needs a Suspense boundary; the fallback matches the session check screen.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B2545]" />}>
      <AdminDashboard />
    </Suspense>
  );
}

function AdminDashboard() {
  const params = useSearchParams();
  const [authState, setAuthState] = useState<'checking' | 'signed-out' | 'needs-code' | 'admin'>('checking');
  // Links from /admin/premium open a specific tab (?tab=sponsored), optionally with a search (&q=).
  const [tab, setTab] = useState<Tab>(() => ADMIN_TABS.find(([key]) => key === params.get('tab'))?.[0] ?? 'live');
  // Search from the top bar; changing it remounts the Submissions tab with that search.
  const [search, setSearch] = useState(() => params.get('q') ?? '');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { confirmAction, dialog } = useConfirm();

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => {
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then((d) => setAuthState(d.admin ? 'admin' : d.needsCode ? 'needs-code' : 'signed-out'))
      .catch(() => setAuthState('signed-out'));
  }, []);

  const live = useLiveFeed(authState === 'admin', (arrived) => {
    arrived.forEach((l) => toast(`New submission: ${l.title}`, 'info'));
  });

  const handleRemove = useCallback(async (ids: string[], label: string): Promise<boolean> => {
    const ok = await confirmAction({
      title: ids.length === 1 ? 'Remove submission?' : `Remove ${ids.length} submissions?`,
      message: (
        <>
          <span className="font-semibold text-[#1F2937]">{label}</span> will be deleted along with all of {ids.length === 1 ? 'its' : 'their'} votes. This cannot be undone.
        </>
      ),
      confirmLabel: 'Remove',
    });
    if (!ok) return false;
    try {
      const removed = await removeListings(ids);
      live.dropListings(removed);
      toast(removed.length === 1 ? 'Submission removed' : `${removed.length} submissions removed`, 'success');
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to remove', 'error');
      return false;
    }
  }, [live, toast, confirmAction]);

  const signOut = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setAuthState('signed-out');
  };

  if (authState === 'checking') {
    return <div className="min-h-screen bg-[#0B2545] flex items-center justify-center text-white/60">Checking access…</div>;
  }

  if (authState === 'signed-out' || authState === 'needs-code') {
    return <AdminLogin signedIn={authState === 'needs-code'} onSuccess={() => setAuthState('admin')} />;
  }

  return (
    <>
      <AdminShell
        active={tab}
        onSelect={setTab}
        onSignOut={signOut}
        onSearch={(q) => { setSearch(q); setTab('submissions'); }}
        status={<ConnectionBadge conn={live.conn} lastUpdate={live.lastUpdate} />}
        accountMenu={<ComingSoonToggle toast={toast} confirmAction={confirmAction} />}
      >
        {tab === 'live' && (
          <OverviewTab
            live={live}
            onRemove={handleRemove}
            onOpen={setTab}
            toast={toast}
            panels={{
              submissions: <SubmissionsTab compact onRemove={handleRemove} liveVersion={live.snapshot?.generatedAt} toast={toast} />,
              users: <UsersTab onRemove={handleRemove} liveVersion={live.snapshot?.generatedAt} toast={toast} confirmAction={confirmAction} />,
              sponsored: <SponsoredTab toast={toast} />,
              payments: <AdminPayments title={null} />,
            }}
          />
        )}
        {tab === 'submissions' && (
          <SubmissionsTab key={search} initialSearch={search} onRemove={handleRemove} liveVersion={live.snapshot?.generatedAt} toast={toast} />
        )}
        {tab === 'users' && (
          <UsersTab onRemove={handleRemove} liveVersion={live.snapshot?.generatedAt} toast={toast} confirmAction={confirmAction} />
        )}
        {tab === 'votes' && <VotesTab liveVersion={live.snapshot?.generatedAt} toast={toast} confirmAction={confirmAction} />}
        {tab === 'sponsored' && <SponsoredTab toast={toast} />}
        {tab === 'team' && <TeamTab toast={toast} confirmAction={confirmAction} />}
        {tab === 'activity' && <ActivityTab />}
      </AdminShell>

      {dialog}

      <div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg font-bold text-sm shadow-lg ${
              t.type === 'success' ? 'bg-green-100 text-green-800' : t.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}

// ---- Coming soon switch ----

function ComingSoonToggle({ toast, confirmAction }: { toast: (m: string, t?: Toast['type']) => void; confirmAction: ConfirmFn }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [site, setSite] = useState('rankbid.click');
  // Only the owner, on the live domain's admin, may flip it (the sandbox shares the live database).
  const [lockedReason, setLockedReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/site-settings')
      .then((r) => r.json())
      .then((d) => {
        setOn(typeof d.comingSoon === 'boolean' ? d.comingSoon : null);
        if (d.site) setSite(d.site);
        setLockedReason(d.canChange === false ? d.lockedReason || 'You can’t change this here.' : null);
      })
      .catch(() => setOn(null));
  }, []);

  const flip = async () => {
    if (on === null) return;
    if (lockedReason) return toast(lockedReason, 'info');
    const next = !on;
    const ok = await confirmAction(next
      ? { title: `Turn on the coming soon page for ${site}?`, message: `Every visitor to ${site} except admins will be sent to the coming soon page.`, confirmLabel: 'Turn on' }
      : {
          title: `Launch ${site} to the public?`,
          message: `The coming soon page goes away on ${site} and everyone can use RankBid. Check the go-live list first: Stripe live keys, test data wiped, support email working.`,
          confirmLabel: 'Launch',
          typeToConfirm: 'LAUNCH',
        });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comingSoon: next, ...(next ? {} : { confirm: 'LAUNCH' }) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setOn(data.comingSoon);
      toast(data.comingSoon ? `Coming soon page is on for ${site}` : `${site} is open to everyone`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={flip}
      disabled={on === null || busy}
      role="switch"
      aria-checked={on ?? false}
      aria-disabled={Boolean(lockedReason)}
      title={lockedReason ?? undefined}
      className={`w-full px-3 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-60 ${lockedReason ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <span className={`shrink-0 relative inline-block w-9 h-5 rounded-full transition-colors ${on ? 'bg-amber-400' : 'bg-green-500'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <span className="text-left leading-tight">
        Live site {site}
        <span className="block text-xs font-semibold text-[#1F2937]/60">
          {on === null ? 'Loading…' : on ? 'Showing: Coming soon (waitlist)' : 'Showing: full site (public)'}
          {lockedReason && ' · view only'}
        </span>
      </span>
    </button>
  );
}

// ---- Login ----

function AdminLogin({ signedIn, onSuccess }: { signedIn: boolean; onSuccess: () => void }) {
  // Admins sign in with their own email and password, then enter a code emailed to them. There is no shared admin password.
  const [step, setStep] = useState<'account' | 'code'>(signedIn ? 'code' : 'account');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = useCallback(async () => {
    setError('');
    const res = await fetch('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setCodeSentTo(data.email);
    else setError(data.error || 'Could not send the code');
  }, []);

  // Already signed in with an admin account (e.g. from the site's login): go straight to the code.
  // Only once: each new code replaces the last, so a second send would void the first email.
  const autoSent = useRef(false);
  useEffect(() => {
    if (signedIn && !autoSent.current) {
      autoSent.current = true;
      sendCode();
    }
  }, [signedIn, sendCode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (step === 'code') {
        const res = await fetch('/api/admin/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (res.ok) onSuccess();
        else setError((await res.json().catch(() => ({}))).error || 'That code is wrong');
        return;
      }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || 'Invalid email or password');
        return;
      }
      const session = await fetch('/api/admin/session').then((r) => r.json());
      if (!session.needsCode && !session.admin) {
        setError('This account doesn’t have admin access. Ask the owner to add you.');
        return;
      }
      setStep('code');
      await sendCode();
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0F3460] text-[#1F2937]';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F3460] to-[#1a5490] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-black text-[#1F2937] mb-2">Admin Access</h1>
        <p className="text-[#1F2937]/60 mb-6">
          {step === 'account'
            ? 'Sign in with your email and the password you set from your invite.'
            : codeSentTo ? `We emailed a 6-digit code to ${codeSentTo}. It expires in 10 minutes.` : 'Sending your sign-in code…'}
        </p>
        <form onSubmit={submit} className="space-y-4">
          {step === 'account' ? (
            <>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" className={input} required autoFocus />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" className={input} required />
            </>
          ) : (
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              className={`${input} tracking-[0.4em] font-mono text-center text-xl`}
              required
              autoFocus
            />
          )}
          {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full px-6 py-3 bg-[#0F3460] text-white font-bold rounded-lg hover:bg-[#0D2A50] transition-colors disabled:opacity-60"
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>
        </form>
        {step === 'code' && (
          <button
            type="button"
            onClick={() => { setCode(''); sendCode(); }}
            className="mt-4 w-full text-center text-sm font-semibold text-[#1F2937]/70 hover:text-[#0F3460]"
          >
            Send a new code
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Admin team ----

interface TeamData {
  owners: string[];
  team: { email: string; name: string | null; pending: boolean }[];
  max: number;
  canManage: boolean;
}

/** Share the dashboard: the owner invites up to `max` admins by email (they set their own password), and can remove them. */
function TeamTab({ toast, confirmAction }: { toast: (m: string, t?: Toast['type']) => void; confirmAction: ConfirmFn }) {
  const [data, setData] = useState<TeamData | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch('/api/admin/team')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => toast('Failed to load the admin team', 'error'));
  }, [toast]);
  useEffect(load, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not add the admin');
      if (!d.emailSent) {
        toast(`${d.email} was added, but the invite email failed (${d.emailError}). Try resending it.`, 'error');
      } else {
        toast(`Invite sent to ${d.email}. They'll set their own password from the email.`, 'success');
      }
      setEmail(''); setName('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add the admin', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (target: string) => {
    const ok = await confirmAction({
      title: 'Remove admin access?',
      message: <><span className="font-semibold text-[#1F2937]">{target}</span> will no longer be able to open the dashboard. Their account stays.</>,
      confirmLabel: 'Remove access',
    });
    if (!ok) return;
    const res = await fetch('/api/admin/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: target }),
    });
    if (res.ok) {
      toast('Admin access removed', 'success');
      load();
    } else {
      toast((await res.json().catch(() => ({}))).error || 'Failed to remove', 'error');
    }
  };

  const resend = async (target: string) => {
    const res = await fetch('/api/admin/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: target }),
    });
    if (res.ok) toast(`Invite sent again to ${target}`, 'success');
    else toast((await res.json().catch(() => ({}))).error || 'Failed to send the invite', 'error');
  };

  if (!data) return <div className="bg-white rounded-3xl p-6 text-gray-500">Loading…</div>;
  const full = data.team.length >= data.max;
  const input = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0F3460] text-sm';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] items-start">
      <section className="bg-white rounded-3xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-black">Admin team</h2>
          <span className="text-xs font-bold text-[#1F2937]/50 tabular-nums">{data.team.length} / {data.max} shared</span>
        </div>
        <ul className="divide-y divide-gray-100">
          {data.owners.map((o) => (
            <li key={o} className="flex items-center gap-3 py-3">
              <span className="w-10 h-10 rounded-full bg-[#0F3460] text-white flex items-center justify-center font-black uppercase">{o[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{o}</p>
                <p className="text-xs text-[#1F2937]/45">Owner</p>
              </div>
            </li>
          ))}
          {data.team.map((m) => (
            <li key={m.email} className="flex items-center gap-3 py-3">
              <span className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-black uppercase">{(m.name || m.email)[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{m.name || m.email}</p>
                <p className="text-xs text-[#1F2937]/45 truncate">
                  {m.name ? `${m.email} · ` : ''}Admin
                  {m.pending && <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold">Invite pending</span>}
                </p>
              </div>
              {data.canManage && (
                <button
                  onClick={() => resend(m.email)}
                  aria-label={`Resend invite to ${m.email}`}
                  title="Resend invite (sends a new set-password link)"
                  className="p-2 rounded-lg text-[#1F2937]/40 hover:text-[#0F3460] hover:bg-[#F4F6FA] transition-colors"
                >
                  <Mail className="w-4 h-4" />
                </button>
              )}
              {data.canManage && (
                <button
                  onClick={() => remove(m.email)}
                  aria-label={`Remove ${m.email}`}
                  className="p-2 rounded-lg text-[#1F2937]/40 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {data.team.length === 0 && (
          <p className="text-sm text-[#1F2937]/50 mt-2">You haven’t shared the dashboard with anyone yet.</p>
        )}
      </section>

      {data.canManage ? (
        <section className="bg-white rounded-3xl p-6">
          <h2 className="text-lg font-black mb-1">Share access</h2>
          <p className="text-sm text-[#1F2937]/55 mb-4">
            We email them an invite with a link to set their own password. Then they sign in at <span className="font-semibold text-[#1F2937]">/admin</span> and get the full dashboard.
          </p>
          {full ? (
            <p className="text-sm font-semibold text-amber-700 bg-amber-50 rounded-xl px-3 py-2.5">
              All {data.max} admin spots are used. Remove someone to add another.
            </p>
          ) : (
            <form onSubmit={add} className="space-y-3">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={input} required />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" maxLength={80} className={input} />
              <p className="text-xs text-[#1F2937]/45">The link expires in 7 days. You never see or choose their password.</p>
              <button
                type="submit"
                disabled={busy}
                className="w-full px-4 py-2.5 bg-[#0F3460] text-white text-sm font-bold rounded-lg hover:bg-[#0D2A50] transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" /> {busy ? 'Adding…' : 'Add admin'}
              </button>
            </form>
          )}
        </section>
      ) : (
        <section className="bg-white rounded-3xl p-6 text-sm text-[#1F2937]/55">Only the owner can add or remove admins.</section>
      )}
    </div>
  );
}

// ---- Activity log ----

interface ActivityEntry {
  id: number;
  actor: string;
  action: string;
  target: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface ActivityData {
  entries: ActivityEntry[];
  actors: string[];
  labels: Record<string, string>;
  pagination: Pagination;
}

const ACTIVITY_TONE: Record<string, string> = {
  delete: 'bg-red-50 text-red-700',
  remove: 'bg-red-50 text-red-700',
  reject: 'bg-red-50 text-red-700',
  add: 'bg-emerald-50 text-emerald-700',
  approve: 'bg-emerald-50 text-emerald-700',
  invite_accepted: 'bg-emerald-50 text-emerald-700',
};

/** Every change made from the dashboard: who did it, when, and the data (deleted rows are kept in full). Owner only. */
function ActivityTab() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);

  // New entries show up on their own: reload every 15 seconds while the tab is open.
  useEffect(() => {
    const id = setInterval(() => setRefresh((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (actor) params.set('actor', actor);
    if (action) params.set('action', action);
    let cancelled = false;
    fetch(`/api/admin/activity?${params}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Failed to load the activity log');
        return d;
      })
      .then((d) => { if (!cancelled) { setData(d); setError(''); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [page, actor, action, refresh]);

  if (error) return <div className="bg-white rounded-3xl p-6 text-sm text-[#1F2937]/55">{error}</div>;
  if (!data) return <div className="bg-white rounded-3xl p-6 text-gray-500">Loading…</div>;
  const select = 'px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0F3460]';
  const tone = (a: string) => ACTIVITY_TONE[a.split('.')[1]] ?? 'bg-[#F4F6FA] text-[#0F3460]';

  return (
    <section className="bg-white rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-black">Activity log</h2>
          <p className="text-sm text-[#1F2937]/55">Every change made from this dashboard, and by whom. Deleted data is kept here in full.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRefresh((n) => n + 1)}
            aria-label="Refresh the activity log"
            title="Refresh"
            className="px-3 py-2 border border-gray-300 rounded-lg text-[#1F2937]/60 hover:text-[#0F3460] hover:border-[#0F3460]"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <select value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} className={select} aria-label="Filter by admin">
            <option value="">All admins</option>
            {data.actors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={select} aria-label="Filter by action">
            <option value="">All actions</option>
            {Object.entries(data.labels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </div>

      {data.entries.length === 0 ? (
        <p className="text-sm text-[#1F2937]/50">Nothing logged yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {data.entries.map((e) => (
            <li key={e.id} className="py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${tone(e.action)}`}>{data.labels[e.action] ?? e.action}</span>
                <span className="font-semibold text-sm truncate min-w-0 max-w-full">{e.target || '—'}</span>
                <span className="text-xs text-[#1F2937]/50">by <span className="font-semibold text-[#1F2937]/70">{e.actor}</span></span>
                <span className="ml-auto text-xs text-[#1F2937]/45 tabular-nums" title={new Date(e.created_at).toLocaleString()}>{timeAgo(e.created_at)}</span>
                {e.details && (
                  <button
                    onClick={() => setOpen(open === e.id ? null : e.id)}
                    className="text-xs font-bold text-[#0F3460] hover:underline flex items-center gap-0.5"
                    aria-expanded={open === e.id}
                  >
                    {open === e.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} Details
                  </button>
                )}
              </div>
              {open === e.id && e.details && (
                <pre className="mt-2 p-3 rounded-xl bg-[#F4F6FA] text-xs text-[#1F2937]/80 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(e.details, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.pagination.pages > 1 && (
        <PageNav currentPage={page} totalPages={data.pagination.pages} onPageChange={setPage} className="mt-4" />
      )}
    </section>
  );
}

// ---- Shared bits ----

function ConnectionBadge({ conn, lastUpdate }: { conn: ConnState; lastUpdate: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const label = conn === 'live' ? 'Live' : conn === 'connecting' ? 'Connecting' : 'Reconnecting';
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-bold bg-white text-[#1F2937]/70 rounded-full px-2.5 py-0.5 shadow-sm">
      <span className="relative flex h-2.5 w-2.5">
        {conn === 'live' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${conn === 'live' ? 'bg-green-400' : 'bg-yellow-400'}`} />
      </span>
      {label}
      {lastUpdate && conn === 'live' && <span className="hidden sm:inline font-normal opacity-70">· {timeAgo(lastUpdate)}</span>}
    </span>
  );
}

function RankMove({ delta }: { delta: number | 'new' | undefined }) {
  if (delta === 'new') return <span className="text-[10px] font-black text-blue-600 bg-blue-50 rounded px-1">NEW</span>;
  if (!delta) return <Minus className="w-3.5 h-3.5 text-gray-300" />;
  return delta > 0 ? (
    <span className="flex items-center text-green-600 text-xs font-bold"><ArrowUp className="w-3.5 h-3.5" />{delta}</span>
  ) : (
    <span className="flex items-center text-red-500 text-xs font-bold"><ArrowDown className="w-3.5 h-3.5" />{-delta}</span>
  );
}

function RemoveButton({ onClick, label = 'Remove' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      title="Remove submission"
      className="px-2.5 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors text-xs font-bold flex items-center gap-1"
    >
      <Trash2 className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function ListingTitle({ listing }: { listing: AdminListing }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {listing.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={listing.imageUrl} alt="" className="w-7 h-7 rounded object-cover bg-gray-100 shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded bg-gray-100 shrink-0" />
      )}
      <div className="min-w-0">
        <Link href={`/product/${listing.id}`} target="_blank" className="font-semibold hover:underline line-clamp-1 break-all">
          {listing.title}
        </Link>
        <a href={safeExternalUrl(listing.url) ?? '#'} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:underline flex items-center gap-1 truncate">
          <span className="truncate">{listing.url}</span> <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      </div>
    </div>
  );
}

// ---- Overview tab ----

type OverviewPanel = 'submissions' | 'users' | 'sponsored' | 'payments';

/** RankBid amber (the colour of sponsored prices): live listings. Navy (#0F3460) is the dark counterpart. */
const ACCENT = '#F59E0B';
const NAVY = '#0F3460';

function faviconFor(url: string | null): string | null {
  if (!url) return null;
  try {
    return logoUrl(new URL(url).hostname, 64);
  } catch {
    return null;
  }
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

/** Payment state as the three pills on the overview: Success, Process, Failed. */
function salePill(status: string): { label: string; cls: string; dot: string } {
  if (status === 'active') return { label: 'Live', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
  if (['outbid', 'replaced'].includes(status)) return { label: 'Ended', cls: 'bg-[#E3EAF5] text-[#0F3460]', dot: 'bg-[#0F3460]' };
  if (status === 'pending') return { label: 'Process', cls: 'bg-[#EEF2F7] text-[#1F2937]/60', dot: 'bg-[#1F2937]/40' };
  return { label: status === 'needs_refund' ? 'Refund' : status === 'failed' ? 'Abandoned' : 'Failed', cls: 'bg-[#FADADD] text-[#C2414B]', dot: 'bg-[#C2414B]' };
}

/** Product logo, falling back to the payer's initials. */
function OrderAvatar({ order, dark = false, size = 'md' }: { order: SponsoredOrder; dark?: boolean; size?: 'md' | 'lg' }) {
  const [broken, setBroken] = useState(false);
  const icon = faviconFor(order.productUrl);
  const box = size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-11 h-11 rounded-full';
  return (
    <span className={`${box} flex-shrink-0 flex items-center justify-center overflow-hidden ${dark ? 'bg-[#0F3460] text-white' : 'text-white'}`} style={dark ? undefined : { background: ACCENT }}>
      {icon && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" onError={() => setBroken(true)} className="w-6 h-6 rounded bg-white object-contain p-0.5" />
      ) : (
        <span className="text-sm font-black">{initials(order.account?.name || order.founderName || order.productTitle || '?')}</span>
      )}
    </span>
  );
}

/**
 * Two-part ring: live listings (amber) vs ended ones (navy), with the total in the middle.
 * Flat-ended segments separated by a small gap; a tiny slice is held to a minimum arc so it
 * still reads as a segment. The ring draws itself in on mount and follows the legend filter.
 */
function RevenueDonut({ live, ended, focus }: { live: number; ended: number; focus: 'all' | 'live' | 'ended' }) {
  const total = live + ended;
  const r = 72;
  const sw = 14;
  const c = 2 * Math.PI * r;
  const both = live > 0 && ended > 0;
  const gap = both ? 4 : 0;
  const minArc = c * 0.03;
  let endedLen = total ? (ended / total) * c : 0;
  if (both) endedLen = Math.min(Math.max(endedLen, minArc), c - minArc);
  const liveLen = total ? (live > 0 ? c - endedLen : 0) : 0;

  // One continuous sweep from 12 o'clock: the fill runs through live, then straight on into ended.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    // Reduced motion: the first frame jumps straight to a full ring.
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1400;
    let start: number | null = null;
    let id = 0;
    const tick = (now: number) => {
      start ??= now;
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      setProgress(1 - Math.pow(1 - t, 3)); // ease-out cubic
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  const head = progress * c;

  const segments = [
    { key: 'live' as const, color: ACCENT, len: liveLen, start: 0 },
    { key: 'ended' as const, color: NAVY, len: endedLen, start: liveLen },
  ];
  const shown = focus === 'live' ? live : focus === 'ended' ? ended : total;
  const caption = focus === 'live' ? 'Live' : focus === 'ended' ? 'Ended' : 'Total';

  return (
    <div className="relative w-56 h-56 mx-auto">
      <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90" role="img" aria-label={`Live ${usd(live)}, ended ${usd(ended)}`}>
        <circle cx="90" cy="90" r={r} fill="none" stroke="#F1F4F9" strokeWidth={sw} />
        {segments.map(({ key, color, len, start }) => {
          const visible = Math.min(Math.max(0, head - start - gap / 2), Math.max(0, len - gap));
          return len > 0 ? (
            <circle
              key={key}
              cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth={sw}
              strokeDasharray={`${visible} ${c}`}
              strokeDashoffset={-(start + gap / 2)}
              className="transition-opacity duration-200"
              style={{ opacity: focus === 'all' || focus === key ? 1 : 0.2 }}
            />
          ) : null;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs font-semibold text-[#1F2937]/45">{caption}</span>
        <span className="text-2xl font-black tabular-nums">{usd(shown)}</span>
      </div>
    </div>
  );
}

/** Site traffic, the same numbers as the public header (live viewers, visitors, page views). */
function useSiteTraffic(intervalMs = 10_000) {
  const [traffic, setTraffic] = useState<{ live: number; visitors: number; views: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [liveRes, totalRes] = await Promise.all([fetch('/api/analytics/live-viewers'), fetch('/api/analytics/total-stats')]);
        if (!liveRes.ok || !totalRes.ok || cancelled) return;
        const [live, total] = await Promise.all([liveRes.json(), totalRes.json()]);
        if (!cancelled) setTraffic({ live: live.liveViewers || 0, visitors: total.totalVisitors || 0, views: total.totalPageViews || 0 });
      } catch {
        // Keep the last numbers; the next tick retries.
      }
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, intervalMs);
    return () => { cancelled = true; clearInterval(t); };
  }, [intervalMs]);
  return traffic;
}

function OverviewTab({
  live,
  onRemove,
  onOpen,
  toast,
  panels,
}: {
  live: ReturnType<typeof useLiveFeed>;
  onRemove: (ids: string[], label: string) => Promise<boolean>;
  onOpen: (tab: Tab) => void;
  toast: (m: string, t?: Toast['type']) => void;
  /** What each quick-action button opens in place of Recent Sales. */
  panels: Record<OverviewPanel, React.ReactNode>;
}) {
  // Quick actions open their section right here (null = Recent Sales).
  const [panel, setPanel] = useState<OverviewPanel | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const openPanel = (key: OverviewPanel) => {
    setPanel((p) => (p === key ? null : key));
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const traffic = useSiteTraffic();
  const { data } = useAdminData<{ summary: SponsoredSummary; orders: SponsoredOrder[] }>(
    '/api/admin/sponsored',
    live.snapshot?.generatedAt,
    () => toast('Failed to load sponsored payments', 'error')
  );
  const summary = data?.summary;
  const orders = data?.orders ?? [];
  const recent = orders.slice(0, 5);
  // Money we keep (live or ended), newest first; refunds and unpaid orders stay out of the income list.
  const earned = orders.filter((o) => o.paid && ['active', 'outbid', 'replaced'].includes(o.status));
  // The legend under the ring filters this list: live listings, ended ones, or both.
  const [statFilter, setStatFilter] = useState<'all' | 'live' | 'ended'>('all');
  const paid = earned
    .filter((o) => statFilter === 'all' || (statFilter === 'live' ? o.status === 'active' : o.status !== 'active'))
    .slice(0, 6);
  const liveUsd = summary?.activeUsd ?? 0;
  const endedUsd = Math.max(0, (summary?.totalEarnedUsd ?? 0) - liveUsd);
  const month = new Date().toLocaleDateString(undefined, { month: '2-digit', year: '2-digit' });

  const actions: { key: OverviewPanel; label: string; icon: typeof Users }[] = [
    { key: 'submissions', label: 'Submissions', icon: FileText },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'sponsored', label: 'Sponsored', icon: TrendingUp },
    { key: 'payments', label: 'Payments', icon: Zap },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-8">
        <div className="space-y-8 min-w-0">
          {/* Cards */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black">Cards</h2>
              <button onClick={() => onOpen('sponsored')} className="text-sm font-semibold text-[#1F2937]/50 hover:text-[#1F2937]">See all</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0B2545] via-[#0F3460] to-[#1a5490] text-white p-7 shadow-[0_24px_50px_-24px_rgba(11,37,69,0.7)] min-h-[200px] flex flex-col">
                <div aria-hidden className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:9px_9px] [mask-image:radial-gradient(circle_at_70%_60%,#000_10%,transparent_60%)]" />
                <p className="relative text-xs font-semibold text-white/55">Sponsored revenue</p>
                <p className="relative text-4xl font-black tabular-nums mt-1">{summary ? usd(summary.totalEarnedUsd) : '—'}</p>
                <p className="relative mt-3 text-sm font-semibold text-white/80">
                  <span className="tracking-widest">****</span> {summary ? `${fmt(summary.paidOrders)} paid · ${fmt(summary.payingCustomers)} customer${summary.payingCustomers === 1 ? '' : 's'}` : '…'}
                </p>
                <div className="relative mt-auto pt-6 flex items-end justify-between">
                  <span className="text-sm font-semibold">{month}</span>
                  <span className="text-xl font-black italic tracking-tight">stripe</span>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[28px] bg-white border border-gray-200 p-7 min-h-[200px] flex flex-col">
                <div aria-hidden className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(#0F3460_1px,transparent_1px)] [background-size:9px_9px] [mask-image:radial-gradient(circle_at_70%_60%,#000_10%,transparent_60%)]" />
                <div className="relative flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#1F2937]/45">Site stats</p>
                  <span className="text-[11px] font-semibold text-[#1F2937]/40">updates every 10s</span>
                </div>
                {/* Site traffic, the same numbers as the public header */}
                <div className="relative mt-auto pt-5 grid grid-cols-3 gap-3">
                  {([
                    ['Live', traffic?.live, <span key="d" className="relative flex w-2.5 h-2.5"><span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" /><span className="relative w-2.5 h-2.5 rounded-full bg-red-500" /></span>],
                    ['Visitors', traffic?.visitors, <Users key="u" className="w-4 h-4 text-[#1a5490]" />],
                    ['Views', traffic?.views, <Eye key="e" className="w-4 h-4 text-[#1F2937]/50" />],
                  ] as const).map(([label, value, icon]) => {
                    const text = value === undefined ? '—' : fmt(value);
                    // One size for all three, set by the longest number, so the tiles match.
                    const longest = Math.max(2, ...[traffic?.live, traffic?.visitors, traffic?.views].map(v => (v === undefined ? 1 : fmt(v).length)));
                    return (
                      <div key={label} className="min-w-0 rounded-2xl bg-[#F4F6FA] px-3 sm:px-4 py-4 [container-type:inline-size]">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#1F2937]/45 truncate">{icon}{label}</span>
                        {/* Shrinks with the tile so long numbers (10,919 or 1,250,000) stay inside it; all three share the size. */}
                        <span
                          className="block mt-1 font-black tabular-nums leading-tight whitespace-nowrap"
                          style={{ fontSize: `min(1.875rem, ${Math.floor(160 / longest)}cqw)` }}
                        >
                          {text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Quick actions */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" role="tablist" aria-label="Overview sections">
            {actions.map(({ key, label, icon: Icon }) => {
              const on = panel === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => openPanel(key)}
                  className={`flex items-center gap-3 rounded-[22px] px-4 py-3.5 font-bold transition-transform hover:-translate-y-0.5 ${
                    on ? 'text-white shadow-lg shadow-[#0F3460]/25' : 'bg-white border border-gray-200 text-[#1F2937]'
                  }`}
                  style={on ? { background: `linear-gradient(135deg, ${NAVY}, #1a5490)` } : undefined}
                >
                  <span className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${on ? 'bg-white text-[#0F3460]' : 'bg-[#0F3460] text-white'}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  {label}
                </button>
              );
            })}
          </section>

          {panel && (
            <section ref={panelRef} role="tabpanel" className="scroll-mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black">{actions.find((a) => a.key === panel)!.label}</h2>
                <button type="button" onClick={() => setPanel(null)} className="text-sm font-semibold text-[#1F2937]/50 hover:text-[#1F2937]">
                  ← Recent sales
                </button>
              </div>
              {panels[panel]}
            </section>
          )}

          {/* Recent sales (hidden while a quick-action section is open) */}
          <section hidden={panel !== null}>
            <h2 className="text-xl font-black mb-4">Recent Sales</h2>
            <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_1fr_1fr_auto] gap-4 px-5 pb-2 text-xs font-semibold text-[#1F2937]/45">
              <span>Sender</span><span>Date</span><span>Status</span><span className="w-20 text-right">Amount</span>
            </div>
            {!data ? (
              <p className="rounded-[22px] bg-white p-6 text-center text-sm text-[#1F2937]/50">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="rounded-[22px] bg-white p-6 text-center text-sm text-[#1F2937]/50">No sponsored orders yet.</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((o) => {
                  const pill = salePill(o.status);
                  return (
                    <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] items-center gap-4 rounded-[22px] bg-white px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <OrderAvatar order={o} />
                        <div className="min-w-0">
                          <p className="font-bold truncate">{o.account?.name || o.founderName || o.account?.email || 'Unknown'}</p>
                          <p className="text-xs text-[#1F2937]/45 truncate">{o.productTitle ?? 'Deleted product'}</p>
                        </div>
                      </div>
                      <span className="hidden sm:block text-sm text-[#1F2937]/55">
                        {new Date(o.paidAt ?? o.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="hidden sm:block">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold ${pill.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />{pill.label}
                        </span>
                      </span>
                      <span className="w-20 text-right font-black tabular-nums text-amber-600">+{usd(o.amountUsd)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Statistic */}
        <aside className="rounded-[32px] bg-white p-6 sm:p-7 h-fit">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black">Statistic</h2>
            <button
              type="button"
              onClick={() => setStatFilter('all')}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${statFilter === 'all' ? 'border-[#0F3460] text-[#0F3460]' : 'border-gray-200 text-[#1F2937]/50 hover:text-[#1F2937]'}`}
            >
              All time
            </button>
          </div>
          <RevenueDonut live={liveUsd} ended={endedUsd} focus={statFilter} />

          {/* Legend doubles as the filter for the payments list */}
          <div className="grid grid-cols-2 gap-2 mt-6">
            {([
              ['live', 'Live listings', ACCENT, liveUsd, summary?.activeCount],
              ['ended', 'Ended', NAVY, endedUsd, earned.filter((o) => o.status !== 'active').length],
            ] as const).map(([key, label, color, amount, count]) => {
              const on = statFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStatFilter(on ? 'all' : key)}
                  className={`text-left rounded-2xl border px-3 py-2.5 transition-colors ${on ? 'border-[#0F3460] bg-[#F4F6FA]' : 'border-gray-200 hover:bg-[#F4F6FA]'}`}
                >
                  <span className="flex items-center gap-2 text-xs font-semibold text-[#1F2937]/55">
                    <span className="w-3.5 h-3.5 rounded" style={{ background: color }} />{label}
                  </span>
                  <span className="block mt-1 text-lg font-black tabular-nums">{usd(amount)}</span>
                  <span className="block text-[11px] text-[#1F2937]/45">{count ?? 0} order{count === 1 ? '' : 's'}</span>
                </button>
              );
            })}
          </div>

          <ul className="mt-6 space-y-4">
            {paid.length === 0 && (
              <li className="text-sm text-center text-[#1F2937]/50">
                {statFilter === 'live' ? 'No live listings.' : statFilter === 'ended' ? 'No ended listings yet.' : 'No payments yet.'}
              </li>
            )}
            {paid.map((o) => (
              <li key={o.id} className="flex items-center gap-3">
                <OrderAvatar order={o} size="lg" dark={o.status !== 'active'} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{o.productTitle ?? 'Deleted product'}</p>
                  <p className="text-xs text-[#1F2937]/45">
                    <span className={o.status === 'active' ? 'font-bold text-amber-600' : 'font-bold text-[#0F3460]'}>
                      {o.status === 'active' ? `Live #${o.rank ?? '–'}` : 'Ended'}
                    </span>
                    {' · '}{timeAgo(o.paidAt ?? o.createdAt)}
                  </p>
                </div>
                <span className="font-black tabular-nums text-[#0F3460]">+{usd(o.amountUsd)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <LiveTab live={live} onRemove={onRemove} />
    </div>
  );
}

// ---- Live tab ----

function LiveTab({
  live,
  onRemove,
}: {
  live: ReturnType<typeof useLiveFeed>;
  onRemove: (ids: string[], label: string) => Promise<boolean>;
}) {
  const s = live.snapshot;

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-3xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Live ranking · all time</h2>
          {!s ? (
            <p className="text-gray-500 py-6 text-center">Loading…</p>
          ) : s.leaderboard.length === 0 ? (
            <p className="text-gray-500 py-6 text-center">No submissions yet</p>
          ) : (
            <ol className="divide-y">
              {s.leaderboard.map((l, i) => (
                <li key={l.id} className="py-2.5 flex items-center gap-3">
                  <span className="w-6 text-right font-black text-[#0F3460] tabular-nums">{i + 1}</span>
                  <span className="w-8 flex justify-center"><RankMove delta={live.rankDelta[l.id]} /></span>
                  <div className="flex-1 min-w-0"><ListingTitle listing={l} /></div>
                  <span className="text-right tabular-nums">
                    <span className="font-black">{fmt(l.totalVotes)}</span>
                    <span className="block text-[11px] text-gray-500">+{fmt(l.dayVotes)} today</span>
                  </span>
                  <RemoveButton label="" onClick={() => onRemove([l.id], l.title)} />
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="bg-white rounded-3xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-orange-500" /> Today&apos;s ranking</h2>
          {!s ? (
            <p className="text-gray-500 py-6 text-center">Loading…</p>
          ) : s.todayLeaderboard.length === 0 ? (
            <p className="text-gray-500 py-6 text-center">No votes yet today</p>
          ) : (
            <ol className="divide-y">
              {s.todayLeaderboard.map((l, i) => (
                <li key={l.id} className="py-2.5 flex items-center gap-3">
                  <span className="w-6 text-right font-black text-[#0F3460] tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0"><ListingTitle listing={l} /></div>
                  <span className="font-black tabular-nums">{fmt(l.dayVotes)}</span>
                  <RemoveButton label="" onClick={() => onRemove([l.id], l.title)} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="bg-white rounded-3xl p-6">
        <h2 className="text-lg font-bold mb-4">Latest submissions</h2>
        {!s ? (
          <p className="text-gray-500 py-6 text-center">Loading…</p>
        ) : s.recentSubmissions.length === 0 ? (
          <p className="text-gray-500 py-6 text-center">No submissions yet</p>
        ) : (
          <ul className="divide-y">
            {s.recentSubmissions.map((l) => (
              <li
                key={l.id}
                className={`py-2.5 px-2 -mx-2 rounded flex items-center gap-3 transition-colors duration-1000 ${
                  live.freshIds.has(l.id) ? 'bg-green-50' : ''
                }`}
              >
                <div className="flex-1 min-w-0"><ListingTitle listing={l} /></div>
                {live.freshIds.has(l.id) && <span className="text-[10px] font-black text-green-700 bg-green-100 rounded px-1.5 py-0.5">NEW</span>}
                <span className="hidden sm:inline text-xs text-gray-500">{PLATFORM_LABELS[normalizePlatform(l.platform)]}</span>
                <span className="text-xs text-gray-500 w-16 text-right">{timeAgo(l.createdAt)}</span>
                <span className="font-bold tabular-nums w-10 text-right">{fmt(l.totalVotes)}</span>
                <RemoveButton label="" onClick={() => onRemove([l.id], l.title)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---- Submissions tab ----

/** GETs `url` and refetches whenever it changes, a live push arrives, or reload() is called. */
function useAdminData<T>(url: string, liveVersion: string | undefined, onError: () => void) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const onErr = useRef(onError);
  useEffect(() => { onErr.current = onError; });

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: T) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) onErr.current(); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // Every live push means something changed (new submission, vote, removal), so refetch on it too.
  }, [url, liveVersion, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { data, loading, reload };
}

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function SubmissionsTab({
  onRemove,
  liveVersion,
  toast,
  userId,
  compact = false,
  initialSearch = '',
}: {
  onRemove: (ids: string[], label: string) => Promise<boolean>;
  liveVersion: string | undefined;
  toast: (m: string, t?: Toast['type']) => void;
  userId?: string;
  compact?: boolean;
  initialSearch?: string;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialSearch);
  const [platform, setPlatform] = useState('');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [votersOpen, setVotersOpen] = useState<string | null>(null);
  const debouncedSearch = useDebounced(search);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort });
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (platform) params.set('platform', platform);
  if (userId) params.set('userId', userId);
  const { data, loading, reload: load } = useAdminData<{ listings: AdminListing[]; pagination: Pagination }>(
    `/api/admin/listings?${params}`,
    liveVersion,
    () => toast('Failed to load submissions', 'error')
  );
  const listings = data?.listings ?? [];
  const pagination = data?.pagination ?? null;

  const toggle = (id: string) =>
    setSelected((s) => {
      const copy = new Set(s);
      if (copy.has(id)) copy.delete(id); else copy.add(id);
      return copy;
    });
  const allSelected = listings.length > 0 && listings.every((l) => selected.has(l.id));

  const remove = async (ids: string[], label: string) => {
    if (await onRemove(ids, label)) {
      setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))));
      load();
    }
  };

  return (
    <div className={compact ? '' : 'bg-white rounded-3xl p-6'}>
      {!compact && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search title, description or URL…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0F3460]"
            />
          </div>
          <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
            <option value="">All platforms</option>
            {['website', 'twitter', 'x', 'instagram', 'facebook', 'tiktok', 'linkedin', 'youtube'].map((p) => (
              <option key={p} value={p} className="capitalize">{p}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="votes">Most votes</option>
            <option value="today">Most votes today</option>
          </select>
          <button onClick={load} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
          <span className="font-bold">{selected.size} selected</span>
          <RemoveButton label="Remove selected" onClick={() => remove([...selected], `These ${selected.size} submissions`)} />
          <button onClick={() => setSelected(new Set())} className="text-gray-600 hover:underline">Clear</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b-2 border-gray-200 text-left">
            <tr>
              <th className="px-3 py-2.5 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(listings.map((l) => l.id)))}
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2.5 font-bold">Submission</th>
              {!userId && <th className="px-3 py-2.5 font-bold">Submitted by</th>}
              <th className="px-3 py-2.5 font-bold">Platform</th>
              <th className="px-3 py-2.5 font-bold text-right">Votes</th>
              <th className="px-3 py-2.5 font-bold text-right">Today</th>
              <th className="px-3 py-2.5 font-bold">Submitted</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <Fragment key={l.id}>
              <tr className={`border-b hover:bg-gray-50 ${selected.has(l.id) ? 'bg-red-50/50' : ''}`}>
                <td className="px-3 py-2.5">
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.title}`} />
                </td>
                <td className="px-3 py-2.5 max-w-xs"><ListingTitle listing={l} /></td>
                {!userId && (
                  <td className="px-3 py-2.5 text-gray-600">
                    {l.owner ? (
                      <span title={l.owner.name || undefined}>{l.owner.email}</span>
                    ) : (
                      <span className="text-gray-400 italic">Guest</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2.5 text-gray-600">{PLATFORM_LABELS[normalizePlatform(l.platform)]}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                  {l.totalVotes > 0 ? (
                    <button
                      onClick={() => setVotersOpen(votersOpen === l.id ? null : l.id)}
                      className="inline-flex items-center gap-1 text-[#0F3460] hover:underline"
                      title="See who voted"
                      aria-expanded={votersOpen === l.id}
                    >
                      {fmt(l.totalVotes)}
                      {votersOpen === l.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(l.dayVotes)}</td>
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap" title={new Date(l.createdAt).toLocaleString()}>
                  {timeAgo(l.createdAt)}
                </td>
                <td className="px-3 py-2.5">
                  <RemoveButton onClick={() => remove([l.id], l.title)} />
                </td>
              </tr>
              {votersOpen === l.id && (
                <tr className="border-b bg-gray-50">
                  <td colSpan={userId ? 7 : 8} className="px-3 pb-4 pt-1">
                    <VotersPanel listingId={l.id} liveVersion={liveVersion} toast={toast} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && listings.length === 0 && <p className="text-center text-gray-500 py-8">No submissions found</p>}
      {loading && listings.length === 0 && <p className="text-center text-gray-500 py-8">Loading…</p>}

      {pagination && pagination.pages > 1 && (
        <div className="mt-4">
          <PageNav currentPage={page} totalPages={pagination.pages} onPageChange={setPage} className="!mt-0" />
          <p className="mt-2 text-center text-xs text-gray-500">
            {fmt(pagination.total)} submissions · page {page} of {pagination.pages}
          </p>
        </div>
      )}
    </div>
  );
}

interface AdminVoter {
  voteId: string;
  kind: 'user' | 'guest' | 'unknown';
  email: string | null;
  name: string | null;
  supportType: string | null;
  userId: string | null;
  votedAt: string | null;
  listing: { id: string; title: string; platform: string } | null;
}

const VOTER_KIND: Record<AdminVoter['kind'], { label: string; cls: string }> = {
  user: { label: 'Account', cls: 'bg-blue-100 text-blue-700' },
  guest: { label: 'Guest link', cls: 'bg-amber-100 text-amber-700' },
  unknown: { label: 'Legacy', cls: 'bg-gray-100 text-gray-600' },
};

/** Who voted on one submission: signed-in accounts and guests who voted from a /support link. */
function VotersPanel({
  listingId,
  liveVersion,
  toast,
}: {
  listingId: string;
  liveVersion: string | undefined;
  toast: (m: string, t?: Toast['type']) => void;
}) {
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ listingId, page: String(page), limit: '25' });
  const { data, loading } = useAdminData<{ voters: AdminVoter[]; pagination: Pagination }>(
    `/api/admin/votes?${params}`,
    liveVersion,
    () => toast('Failed to load voters', 'error')
  );
  const voters = data?.voters ?? [];
  const pagination = data?.pagination ?? null;

  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        <Users className="w-3.5 h-3.5" /> Voters{pagination ? ` · ${fmt(pagination.total)}` : ''}
      </div>
      {loading && voters.length === 0 && <p className="text-center text-gray-500 py-4">Loading…</p>}
      {!loading && voters.length === 0 && <p className="text-center text-gray-500 py-4">No votes yet</p>}
      {voters.length > 0 && <VotesTable voters={voters} />}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-2 text-xs">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
          <span>Page {page} of {pagination.pages}</span>
          <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

/** One row per vote. With showSubmission, also says which submission each vote went to. With selected, rows can be ticked. */
function VotesTable({
  voters,
  showSubmission = false,
  selected,
  onToggle,
}: {
  voters: AdminVoter[];
  showSubmission?: boolean;
  selected?: Set<string>;
  onToggle?: (voteIds: string[], on: boolean) => void;
}) {
  const selectable = Boolean(selected && onToggle);
  const allOn = selectable && voters.length > 0 && voters.every((v) => selected!.has(v.voteId));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500 border-b">
          <tr>
            {selectable && (
              <th className="px-2 py-1.5 w-6">
                <input type="checkbox" aria-label="Select all votes on this page" checked={allOn} onChange={(e) => onToggle!(voters.map((v) => v.voteId), e.target.checked)} />
              </th>
            )}
            <th className="px-2 py-1.5 font-semibold">Voter</th>
            <th className="px-2 py-1.5 font-semibold">Email</th>
            <th className="px-2 py-1.5 font-semibold">Type</th>
            {showSubmission && <th className="px-2 py-1.5 font-semibold">Voted for</th>}
            <th className="px-2 py-1.5 font-semibold">Voted</th>
          </tr>
        </thead>
        <tbody>
          {voters.map((v) => (
            <tr key={v.voteId} className="border-b last:border-0 hover:bg-gray-50">
              {selectable && (
                <td className="px-2 py-1.5">
                  <input type="checkbox" aria-label={`Select vote by ${v.email || v.name || 'unknown voter'}`} checked={selected!.has(v.voteId)} onChange={(e) => onToggle!([v.voteId], e.target.checked)} />
                </td>
              )}
              <td className="px-2 py-1.5 font-medium">{v.name || <span className="text-gray-400 italic">Unknown</span>}</td>
              <td className="px-2 py-1.5 text-gray-600">
                {v.email || <span className="text-gray-400 italic">{v.kind === 'user' ? 'Deleted account' : '—'}</span>}
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${VOTER_KIND[v.kind].cls}`}>{VOTER_KIND[v.kind].label}</span>
                {v.supportType && <span className="ml-1.5 text-xs text-gray-500 capitalize">{v.supportType}</span>}
              </td>
              {showSubmission && (
                <td className="px-2 py-1.5 max-w-xs">
                  {v.listing ? (
                    <Link href={`/product/${v.listing.id}`} target="_blank" className="font-semibold text-[#0F3460] hover:underline truncate block">
                      {v.listing.title}
                      <span className="ml-1.5 text-xs font-normal text-gray-500">{PLATFORM_LABELS[normalizePlatform(v.listing.platform)]}</span>
                    </Link>
                  ) : (
                    <span className="text-gray-400 italic">Removed submission</span>
                  )}
                </td>
              )}
              <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap" title={v.votedAt ? new Date(v.votedAt).toLocaleString() : undefined}>
                {v.votedAt ? timeAgo(v.votedAt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Votes tab ----

const VOTE_REMOVAL_REASONS = ['Fake or disposable email', 'Vote ring / coordinated voting', 'Bot activity', 'Self-vote', 'Other rule break'];

/** Every vote on the site, newest first: who voted and which submission they voted for. Fraudulent votes can be removed. */
function VotesTab({ liveVersion, toast, confirmAction }: { liveVersion: string | undefined; toast: (m: string, t?: Toast['type']) => void; confirmAction: ConfirmFn }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState(VOTE_REMOVAL_REASONS[0]);
  const [removing, setRemoving] = useState(false);
  const debouncedSearch = useDebounced(search);

  const toggle = (ids: string[], on: boolean) => setSelected((prev) => {
    const next = new Set(prev);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    return next;
  });

  const removeSelected = async () => {
    const ids = [...selected];
    const ok = await confirmAction({
      title: ids.length === 1 ? 'Remove this vote?' : `Remove ${ids.length} votes?`,
      message: <>Each listing’s total and rank are recounted at once. Reason logged: <span className="font-semibold text-[#1F2937]">{reason}</span>.</>,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    setRemoving(true);
    try {
      const res = await fetch('/api/admin/votes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteIds: ids, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove votes');
      toast(data.removed.length === 1 ? 'Vote removed' : `${data.removed.length} votes removed`, 'success');
      setSelected(new Set());
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to remove votes', 'error');
    } finally {
      setRemoving(false);
    }
  };

  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (debouncedSearch) params.set('search', debouncedSearch);
  const { data, loading, reload } = useAdminData<{ voters: AdminVoter[]; pagination: Pagination }>(
    `/api/admin/votes?${params}`,
    liveVersion,
    () => toast('Failed to load votes', 'error')
  );
  const voters = data?.voters ?? [];
  const pagination = data?.pagination ?? null;

  return (
    <div className="bg-white rounded-3xl p-6">
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search voter by email or name…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0F3460]"
          />
        </div>
        <button onClick={reload} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-3 rounded-xl bg-red-50 border border-red-100 text-sm">
          <span className="font-bold text-red-800">{selected.size} selected</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for removal" className="px-2 py-1.5 border border-gray-300 rounded-lg bg-white">
            {VOTE_REMOVAL_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <button onClick={removeSelected} disabled={removing} className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-60">
            {removing ? 'Removing…' : 'Remove selected'}
          </button>
          <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white font-semibold">Clear</button>
          <span className="text-xs text-gray-600">Tip: search an email to select every vote from it.</span>
        </div>
      )}
      {voters.length > 0 && <VotesTable voters={voters} showSubmission selected={selected} onToggle={toggle} />}
      {!loading && voters.length === 0 && <p className="text-center text-gray-500 py-8">No votes found</p>}
      {loading && voters.length === 0 && <p className="text-center text-gray-500 py-8">Loading…</p>}

      {pagination && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-600">{fmt(pagination.total)} votes</span>
          {pagination.pages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded disabled:opacity-40">Prev</button>
              <span>Page {page} of {pagination.pages}</span>
              <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Users tab ----

function UsersTab({
  onRemove,
  liveVersion,
  toast,
  confirmAction,
}: {
  onRemove: (ids: string[], label: string) => Promise<boolean>;
  liveVersion: string | undefined;
  toast: (m: string, t?: Toast['type']) => void;
  confirmAction: ConfirmFn;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const debouncedSearch = useDebounced(search);

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (debouncedSearch) params.set('search', debouncedSearch);
  const { data, loading, reload: load } = useAdminData<{ users: AdminUser[]; pagination: Pagination }>(
    `/api/admin/users?${params}`,
    liveVersion,
    () => toast('Failed to load users', 'error')
  );
  const users = data?.users ?? [];
  const pagination = data?.pagination ?? null;

  const deleteUser = async (user: AdminUser) => {
    const ok = await confirmAction({
      title: 'Delete user?',
      message: (
        <>
          The account <span className="font-semibold text-[#1F2937]">{user.email}</span> will be deleted along with its votes and
          sessions. Their submissions stay. This cannot be undone.
        </>
      ),
      confirmLabel: 'Delete user',
    });
    if (!ok) return;
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });
    if (res.ok) {
      toast('User deleted', 'success');
      load();
    } else {
      toast('Failed to delete user', 'error');
    }
  };

  const toggleBlock = async (user: AdminUser) => {
    const block = !user.blockedAt;
    const ok = await confirmAction(block
      ? {
          title: 'Block user?',
          message: (
            <>
              <span className="font-semibold text-[#1F2937]">{user.email}</span> will be signed out everywhere and won’t be able
              to sign in, vote or submit until you unblock them. Their submissions stay.
            </>
          ),
          confirmLabel: 'Block user',
        }
      : {
          title: 'Unblock user?',
          message: <><span className="font-semibold text-[#1F2937]">{user.email}</span> will be able to sign in again.</>,
          confirmLabel: 'Unblock',
        });
    if (!ok) return;
    const res = await fetch('/api/admin/users/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, blocked: block }),
    });
    if (res.ok) {
      toast(block ? `${user.email} is blocked` : `${user.email} is unblocked`, 'success');
      load();
    } else {
      toast((await res.json().catch(() => ({}))).error || 'Failed to update the block', 'error');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6">
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by email or name…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0F3460]"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b-2 border-gray-200 text-left">
            <tr>
              <th className="px-3 py-2.5 w-8" />
              <th className="px-3 py-2.5 font-bold">Email</th>
              <th className="px-3 py-2.5 font-bold">Name</th>
              <th className="px-3 py-2.5 font-bold text-right">Submissions</th>
              <th className="px-3 py-2.5 font-bold text-right">Votes received</th>
              <th className="px-3 py-2.5 font-bold">Joined</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                open={expanded === u.id}
                onToggle={() => setExpanded(expanded === u.id ? null : u.id)}
                onDelete={() => deleteUser(u)}
                onEdit={() => setEditing(u)}
                onBlock={() => toggleBlock(u)}
              >
                <SubmissionsTab onRemove={onRemove} liveVersion={liveVersion} toast={toast} userId={u.id} compact />
              </UserRow>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => { setEditing(null); toast(message, 'success'); load(); }}
          toast={toast}
        />
      )}

      {!loading && users.length === 0 && <p className="text-center text-gray-500 py-8">No users found</p>}
      {loading && users.length === 0 && <p className="text-center text-gray-500 py-8">Loading…</p>}

      {pagination && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-600 flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> {fmt(pagination.total)} users</span>
          {pagination.pages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded disabled:opacity-40">Prev</button>
              <span>Page {page} of {pagination.pages}</span>
              <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  open,
  onToggle,
  onDelete,
  onEdit,
  onBlock,
  children,
}: {
  user: AdminUser;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onBlock: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className={`border-b hover:bg-gray-50 ${open ? 'bg-gray-50' : ''} ${user.blockedAt ? 'text-gray-400' : ''}`}>
        <td className="px-3 py-2.5">
          <button onClick={onToggle} aria-label={open ? 'Hide submissions' : 'Show submissions'} disabled={user.submissions === 0} className="disabled:opacity-30">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-3 py-2.5 font-semibold">
          {user.email}
          {user.isAdmin && <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Admin</span>}
          {user.signIn === 'google' && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">Google</span>}
          {!user.emailVerified && <span title="Hasn't opened the confirmation email yet" className="ml-2 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">Unverified</span>}
          {user.blockedAt && (
            <span
              title={`Blocked ${new Date(user.blockedAt).toLocaleString()}${user.blockedReason ? `: ${user.blockedReason}` : ''}`}
              className="ml-2 text-[10px] font-black uppercase tracking-wide text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5"
            >
              Blocked
            </span>
          )}
        </td>
        <td className="px-3 py-2.5">{user.name || '—'}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">
          {user.submissions > 0 ? (
            <button onClick={onToggle} className="font-bold text-[#0F3460] hover:underline">{fmt(user.submissions)}</button>
          ) : (
            <span className="text-gray-400">0</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">{fmt(user.submissionVotes)}</td>
        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <button onClick={onEdit} title="Edit user" aria-label={`Edit ${user.email}`} className="p-1.5 text-gray-400 hover:text-[#0F3460] rounded hover:bg-[#0F3460]/5">
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onBlock}
            title={user.blockedAt ? 'Unblock user' : 'Block user'}
            aria-label={`${user.blockedAt ? 'Unblock' : 'Block'} ${user.email}`}
            className={`p-1.5 rounded ${user.blockedAt ? 'text-red-600 hover:text-emerald-700 hover:bg-emerald-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
          >
            {user.blockedAt ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} title="Delete user" aria-label={`Delete ${user.email}`} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b bg-gray-50">
          <td colSpan={7} className="px-3 pb-4 pt-1">
            <div className="bg-white rounded-lg border p-3">{children}</div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Edit any account: name, email, password and profile fields. Saves only what changed. */
function EditUserModal({ user, onClose, onSaved, toast }: {
  user: AdminUser;
  onClose: () => void;
  onSaved: (message: string) => void;
  toast: (m: string, t?: Toast['type']) => void;
}) {
  const initial = {
    name: user.name ?? '', email: user.email, phone: user.phone ?? '', city: user.city ?? '', country: user.country ?? '', bio: user.bio ?? '',
  };
  const [form, setForm] = useState(initial);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signOut, setSignOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => v.trim() !== initial[k as keyof typeof initial].trim()));
  const credentialsChange = 'email' in changed || password !== '';

  // A strong random password the admin can copy and send to the user.
  const generate = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(14));
    setPassword(Array.from(bytes, b => chars[b % chars.length]).join(''));
    setShowPassword(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!Object.keys(changed).length && !password && !signOut) { setError('Nothing to change'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...changed, ...(password ? { password } : {}), ...(signOut ? { signOut: true } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not save the changes'); return; }
      onSaved(data.signedOut ? 'User updated and signed out everywhere' : 'User updated');
    } catch {
      toast('Could not save the changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-[#0F3460] focus:ring-2 focus:ring-[#0F3460]/15';
  const label = 'block text-xs font-bold text-gray-600 mb-1';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0F3460]/40 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div className="min-w-0">
            <h2 id="edit-user-title" className="text-lg font-black text-[#1F2937]">Edit user</h2>
            <p className="text-xs text-gray-500 truncate">{user.email} · joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 space-y-4">
          {error && <p role="alert" className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {user.isAdmin && <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">This is an admin account. Only the owner can change it.</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block"><span className={label}>Name</span><input value={form.name} onChange={set('name')} maxLength={80} className={input} placeholder="John Smith" /></label>
            <label className="block"><span className={label}>Email</span><input type="email" value={form.email} onChange={set('email')} maxLength={254} required className={input} /></label>
          </div>

          <div>
            <span className={label}>New password</span>
            <div className="flex gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={8}
                maxLength={200}
                autoComplete="new-password"
                placeholder={user.signIn === 'google' ? 'Google sign-in only: set one to allow password login' : 'Leave empty to keep the current one'}
                className={input}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="px-3 text-xs font-bold border border-gray-300 rounded-lg hover:bg-gray-50">{showPassword ? 'Hide' : 'Show'}</button>
              <button type="button" onClick={generate} className="px-3 text-xs font-bold border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap">Generate</button>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">At least 8 characters. The user is emailed that it changed, never the password itself.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block"><span className={label}>Phone</span><input type="tel" value={form.phone} onChange={set('phone')} maxLength={20} className={input} placeholder="+1 201 555 0123" /></label>
            <label className="block"><span className={label}>City</span><input value={form.city} onChange={set('city')} maxLength={80} className={input} placeholder="New York" /></label>
            <label className="block"><span className={label}>Country</span><input value={form.country} onChange={set('country')} maxLength={80} className={input} placeholder="United States" /></label>
          </div>
          <label className="block"><span className={label}>Bio</span><textarea value={form.bio} onChange={set('bio')} maxLength={500} rows={3} className={input} /></label>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={signOut || credentialsChange} disabled={credentialsChange} onChange={e => setSignOut(e.target.checked)} className="mt-0.5" />
            <span>Sign this user out on every device{credentialsChange && <span className="text-gray-500"> (always, when the email or password changes)</span>}</span>
          </label>
        </div>

        <div className="mt-6 px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-[#1F2937] bg-white border border-gray-300 hover:bg-gray-100">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#0F3460] hover:bg-[#0D2A50] disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}

// ---- Sponsored tab ----

interface SponsoredOrder {
  id: string;
  listingId: string;
  productTitle: string | null;
  productUrl: string | null;
  account: { email: string; name: string | null } | null;
  founderName: string | null;
  founderEmail: string | null;
  founderPhone: string | null;
  amountUsd: number;
  status: string;
  paid: boolean;
  rank: number | null;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  stripeUrl: string | null;
}

interface SponsoredSummary {
  totalEarnedUsd: number;
  paidOrders: number;
  payingCustomers: number;
  thisMonthUsd: number;
  activeCount: number;
  activeUsd: number;
  refundCount: number;
  refundUsd: number;
  pendingCount: number;
}

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const ORDER_STATUS: Record<string, { label: string; style: string }> = {
  active: { label: 'Live', style: 'bg-green-100 text-green-700' },
  outbid: { label: 'Ended', style: 'bg-gray-100 text-gray-700' },
  replaced: { label: 'Replaced', style: 'bg-gray-100 text-gray-700' },
  pending: { label: 'Unpaid / pending', style: 'bg-yellow-100 text-yellow-700' },
  needs_refund: { label: 'Needs refund', style: 'bg-orange-100 text-orange-700' },
  rejected: { label: 'Refunded / rejected', style: 'bg-red-100 text-red-700' },
  failed: { label: 'Abandoned / expired', style: 'bg-gray-100 text-gray-600' },
};

type SponsoredFilter = 'paid' | 'active' | 'pending' | 'refunds' | 'all';

function SponsoredTab({ toast }: { toast: (m: string, t?: Toast['type']) => void }) {
  const [filter, setFilter] = useState<SponsoredFilter>('paid');
  const { data, loading, reload } = useAdminData<{ summary: SponsoredSummary; orders: SponsoredOrder[] }>(
    '/api/admin/sponsored',
    undefined,
    () => toast('Failed to load sponsored orders', 'error')
  );
  const summary = data?.summary;
  const orders = (data?.orders ?? []).filter((o) =>
    filter === 'all' ? true
      : filter === 'paid' ? o.paid && ['active', 'outbid', 'replaced'].includes(o.status)
      : filter === 'active' ? o.status === 'active'
      : filter === 'pending' ? o.status === 'pending'
      : o.paid && ['needs_refund', 'rejected'].includes(o.status)
  );

  const cards: [string, string, string][] = summary ? [
    ['Total earned', usd(summary.totalEarnedUsd), `${summary.paidOrders} paid order${summary.paidOrders === 1 ? '' : 's'} · ${summary.payingCustomers} customer${summary.payingCustomers === 1 ? '' : 's'}`],
    ['This month', usd(summary.thisMonthUsd), new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })],
    ['Live now', String(summary.activeCount), `${usd(summary.activeUsd)} in live listings`],
    ['Refunds', usd(summary.refundUsd), `${summary.refundCount} paid order${summary.refundCount === 1 ? '' : 's'} refunded or owed`],
  ] : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {(summary ? cards : Array.from({ length: 4 }, () => ['', '', ''] as [string, string, string])).map(([label, value, note], i) => (
          <div key={i} className={`rounded-xl p-4 sm:p-5 shadow ${i === 0 ? 'bg-gradient-to-br from-[#0F3460] to-[#1a5490] text-white' : 'bg-white'}`}>
            {summary ? (
              <>
                <p className={`text-xs font-bold uppercase ${i === 0 ? 'text-white/70' : 'text-gray-500'}`}>{label}</p>
                <p className={`text-2xl sm:text-3xl font-black mt-1 ${i === 0 ? '' : 'text-[#0F3460]'}`}>{value}</p>
                <p className={`text-xs mt-1 ${i === 0 ? 'text-white/70' : 'text-gray-500'}`}>{note}</p>
              </>
            ) : (
              <div className="h-16 animate-pulse rounded bg-gray-100/50" />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-2">
          {([
            ['paid', 'Paid'],
            ['active', 'Live now'],
            ['pending', `Unpaid${summary?.pendingCount ? ` (${summary.pendingCount})` : ''}`],
            ['refunds', 'Refunds'],
            ['all', 'All'],
          ] as [SponsoredFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${filter === key ? 'bg-[#0F3460] text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {label}
            </button>
          ))}
          <button onClick={reload} className="ml-auto px-3 py-1.5 rounded-lg text-sm font-bold bg-gray-100 hover:bg-gray-200 flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link href="/admin/premium" className="px-3 py-1.5 rounded-lg text-sm font-bold bg-gray-100 hover:bg-gray-200">
            Sponsor orders →
          </Link>
        </div>

        {loading && !data ? (
          <p className="p-8 text-center text-gray-500">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="p-8 text-center text-gray-500">No orders here yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Paid by</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Ends</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => {
                  const st = ORDER_STATUS[o.status] ?? { label: o.status, style: 'bg-gray-100 text-gray-700' };
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {o.rank != null && <span className="text-xs font-black text-amber-600">#{o.rank}</span>}
                          <Link href={`/product/${o.listingId}`} target="_blank" className="font-bold hover:underline">
                            {o.productTitle ?? 'Deleted product'}
                          </Link>
                        </div>
                        {o.productUrl && <p className="text-xs text-gray-500 truncate max-w-[16rem]">{o.productUrl}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{o.account?.name || o.founderName || '—'}</p>
                        <p className="text-xs text-gray-600">{o.account?.email || o.founderEmail}</p>
                        {o.account && o.founderEmail && o.founderEmail !== o.account.email && (
                          <p className="text-xs text-gray-500">Checkout: {o.founderName} · {o.founderEmail}</p>
                        )}
                        {o.founderPhone && <p className="text-xs text-gray-500">{o.founderPhone}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-[#0F3460] whitespace-nowrap">{usd(o.amountUsd)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${st.style}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {o.paidAt ? new Date(o.paidAt).toLocaleString() : <span className="text-gray-400">Ordered {timeAgo(o.createdAt)}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {o.status === 'active' ? (o.expiresAt ? new Date(o.expiresAt).toLocaleDateString() : 'Lifetime') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {o.stripeUrl && (
                          <a href={o.stripeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#635BFF] hover:underline whitespace-nowrap">
                            Stripe <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filter === 'paid' && (
                <tfoot className="bg-gray-50 font-black">
                  <tr>
                    <td className="px-4 py-3" colSpan={2}>Total ({orders.length})</td>
                    <td className="px-4 py-3 text-right text-[#0F3460]">{usd(orders.reduce((n, o) => n + o.amountUsd, 0))}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
