"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Activity,
  Bell,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface WaitlistEntry {
  id: number;
  email: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

// ── Login Screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}${ENDPOINTS.ADMIN_LOGIN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Invalid credentials.");
        return;
      }
      const data = await res.json();
      onLogin(data.token);
    } catch {
      setError("Could not reach server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <ShieldAlert className="size-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin Access</h1>
          <p className="text-sm text-zinc-500 mt-1">JobClawd System Console</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 h-11"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 h-11"
          />

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full h-11"
          >
            {loading ? (
              <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}${ENDPOINTS.ADMIN_WAITLIST}?limit=500`, { headers });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchWaitlist();
  }, [fetchWaitlist]);

  const filtered = search.trim()
    ? entries.filter((e) => e.email.toLowerCase().includes(search.toLowerCase()))
    : entries;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-zinc-800/80 bg-[#0d0d0d]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Activity className="size-3.5 text-primary" />
            </div>
            <span className="font-semibold text-sm">JobClawd Admin</span>
          </div>
          <div className="h-4 w-px bg-zinc-800" />

          {/* Nav tabs */}
          <nav className="flex items-center gap-1">
            <Link
              href="/admin/dash"
              className="text-xs px-3 py-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              System Logs
            </Link>
            <span className="text-xs px-3 py-1.5 rounded-md bg-primary/10 text-primary font-semibold border border-primary/20">
              Waitlist
            </span>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5 text-zinc-400"
              onClick={fetchWaitlist}
              disabled={loading}
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-zinc-500 hover:text-zinc-300 gap-1.5"
              onClick={onLogout}
            >
              <LogOut className="size-3" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3">
            <p className="text-[11px] text-zinc-600 uppercase tracking-wide font-medium">Total signups</p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-zinc-300">{total}</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3">
            <p className="text-[11px] text-zinc-600 uppercase tracking-wide font-medium">Showing</p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-zinc-300">{filtered.length}</p>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
            <Bell className="size-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300">Payment launch will notify all {total} users.</p>
          </div>
        </div>

        {/* Search + Table */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
            <Users className="size-3.5 text-zinc-500 shrink-0" />
            <span className="text-xs font-semibold text-zinc-400">Credit Waitlist</span>
            <div className="ml-auto w-56">
              <Input
                placeholder="Filter by email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs bg-zinc-800 border-zinc-700 text-zinc-300 placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[48px_1fr_180px] px-4 py-2 border-b border-zinc-800 bg-zinc-900/60">
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">#</span>
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">Email</span>
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">Signed up</span>
          </div>

          <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
            {loading && entries.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-zinc-600 text-sm gap-2">
                <RefreshCw className="size-4 animate-spin" />
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-600 gap-2">
                <Bell className="size-8 opacity-30" />
                <p className="text-sm">
                  {search ? "No results match your filter." : "No waitlist entries yet."}
                </p>
              </div>
            ) : (
              filtered.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[48px_1fr_180px] px-4 py-2.5 border-b border-zinc-900 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-[11px] text-zinc-600 font-mono tabular-nums pt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-zinc-200 truncate">{entry.email}</span>
                  <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
                    {formatDate(entry.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TOKEN_KEY = "jc_admin_token";

export default function AdminWaitlistPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY);
    setToken(stored);
    setReady(true);
  }, []);

  function handleLogin(t: string) {
    sessionStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }

  function handleLogout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  if (!ready) return null;

  if (!token) return <LoginScreen onLogin={handleLogin} />;

  return <Dashboard token={token} onLogout={handleLogout} />;
}
