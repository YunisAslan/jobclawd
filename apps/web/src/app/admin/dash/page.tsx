"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, ENDPOINTS } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  LogOut,
  RefreshCw,
  ServerCrash,
  ShieldAlert,
  Zap,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface AdminLog {
  id: number;
  created_at: string;
  level: "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "CRITICAL";
  source: string;
  event: string;
  message: string;
  details?: Record<string, unknown> | null;
}

// ── Level config ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  INFO: {
    label: "INFO",
    icon: Info,
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
    dot: "bg-blue-400",
  },
  SUCCESS: {
    label: "OK",
    icon: CheckCircle2,
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  WARNING: {
    label: "WARN",
    icon: AlertTriangle,
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/20",
    dot: "bg-yellow-400",
  },
  ERROR: {
    label: "ERR",
    icon: ServerCrash,
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    dot: "bg-red-400",
  },
  CRITICAL: {
    label: "CRIT",
    icon: ShieldAlert,
    bg: "bg-rose-500/15",
    text: "text-rose-300",
    border: "border-rose-400/30",
    dot: "bg-rose-400 animate-pulse",
  },
} as const;

const LEVEL_FILTERS = ["ALL", "INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function sourceColor(source: string) {
  const map: Record<string, string> = {
    linkedin: "bg-[#0A66C2]/20 text-[#60a5fa]",
    indeed: "bg-[#2557a7]/20 text-blue-300",
    glassdoor: "bg-emerald-600/20 text-emerald-300",
    ziprecruiter: "bg-green-700/20 text-green-300",
    remoteok: "bg-red-600/20 text-red-300",
    simplify: "bg-violet-600/20 text-violet-300",
    dice: "bg-rose-700/20 text-rose-300",
    jobgether: "bg-teal-600/20 text-teal-300",
    weworkremotely: "bg-orange-600/20 text-orange-300",
    jobsearch: "bg-zinc-600/20 text-zinc-300",
    cache: "bg-indigo-600/20 text-indigo-300",
    ai_filter: "bg-pink-600/20 text-pink-300",
    system: "bg-zinc-600/20 text-zinc-300",
  };
  return map[source] ?? "bg-zinc-700/30 text-zinc-300";
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
          <div>
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 h-11"
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 h-11"
            />
          </div>

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

// ── Log Row ───────────────────────────────────────────────────────────────────

function LogRow({ log, prevDate }: { log: AdminLog; prevDate: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = LEVEL_CONFIG[log.level] ?? LEVEL_CONFIG.INFO;
  const Icon = cfg.icon;
  const thisDate = formatDate(log.created_at);
  const showDateSep = prevDate !== thisDate;

  return (
    <>
      {showDateSep && (
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest">{thisDate}</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>
      )}
      <div
        className={cn(
          "group flex items-start gap-3 px-4 py-2.5 border-b border-zinc-900 hover:bg-white/[0.02] transition-colors",
          log.level === "CRITICAL" && "bg-rose-950/10 hover:bg-rose-950/15",
        )}
      >
        {/* Level badge */}
        <div className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 border text-[10px] font-bold shrink-0 w-[62px] justify-center", cfg.bg, cfg.text, cfg.border)}>
          <Icon className="size-2.5" />
          {cfg.label}
        </div>

        {/* Source badge */}
        <span className={cn("rounded-md px-2 py-1 text-[10px] font-semibold shrink-0", sourceColor(log.source))}>
          {log.source}
        </span>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200 leading-snug">{log.message}</p>
          {log.event && (
            <span className="text-[10px] text-zinc-600 font-mono">{log.event}</span>
          )}
          {log.details && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-400 mt-1"
            >
              <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
              details
            </button>
          )}
          {expanded && log.details && (
            <pre className="mt-1.5 text-[10px] text-zinc-400 bg-zinc-900 rounded-md p-2 overflow-x-auto leading-relaxed font-mono">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-zinc-600 font-mono shrink-0 pt-0.5 tabular-nums">
          {formatTime(log.created_at)}
        </span>
      </div>
    </>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>("ALL");
  const [filterSource, setFilterSource] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "300" });
      if (filterLevel !== "ALL") params.set("level", filterLevel);
      if (filterSource !== "ALL") params.set("source", filterSource);

      const res = await fetch(`${API_BASE_URL}${ENDPOINTS.ADMIN_LOGS}?${params}`, { headers });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      setLogs(data.logs ?? []);
      setLastRefresh(new Date());
    } catch {
      // non-fatal
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filterLevel, filterSource, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}${ENDPOINTS.ADMIN_LOGS_SOURCES}`, { headers });
      const data = await res.json();
      setSources(data.sources ?? []);
    } catch {
      // non-fatal
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLogs();
    fetchSources();
  }, [fetchLogs, fetchSources]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchLogs(true);
        fetchSources();
      }, 8000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs, fetchSources]);

  // Stats
  const stats = {
    total: logs.length,
    critical: logs.filter((l) => l.level === "CRITICAL").length,
    errors: logs.filter((l) => l.level === "ERROR").length,
    warnings: logs.filter((l) => l.level === "WARNING").length,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-zinc-800/80 bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Activity className="size-3.5 text-primary" />
            </div>
            <span className="font-semibold text-sm">JobClawd Admin</span>
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <span className="text-xs text-zinc-500">System Monitor</span>

          <div className="ml-auto flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[10px] text-zinc-600 tabular-nums">
                Last updated {lastRefresh.toLocaleTimeString("en-US", { hour12: false })}
              </span>
            )}
            <Button
              size="sm"
              variant={autoRefresh ? "secondary" : "outline"}
              className="h-7 text-xs gap-1.5"
              onClick={() => setAutoRefresh((v) => !v)}
            >
              <Zap className={cn("size-3", autoRefresh && "text-yellow-400")} />
              {autoRefresh ? "Live" : "Paused"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5 text-zinc-400"
              onClick={() => fetchLogs()}
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

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total logs", value: stats.total, color: "text-zinc-300" },
            { label: "Critical", value: stats.critical, color: stats.critical > 0 ? "text-rose-400" : "text-zinc-500" },
            { label: "Errors", value: stats.errors, color: stats.errors > 0 ? "text-red-400" : "text-zinc-500" },
            { label: "Warnings", value: stats.warnings, color: stats.warnings > 0 ? "text-yellow-400" : "text-zinc-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-[11px] text-zinc-600 uppercase tracking-wide font-medium">{label}</p>
              <p className={cn("text-2xl font-bold tabular-nums mt-1", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Logs panel */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 flex-wrap">
            <span className="text-xs font-semibold text-zinc-400 mr-1">Level:</span>
            {LEVEL_FILTERS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={cn(
                  "text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors",
                  filterLevel === lvl
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400",
                )}
              >
                {lvl}
              </button>
            ))}

            <div className="h-4 w-px bg-zinc-800 mx-1" />

            <span className="text-xs font-semibold text-zinc-400">Source:</span>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="text-[11px] bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-md px-2 py-1 outline-none"
            >
              <option value="ALL">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <span className="ml-auto text-[11px] text-zinc-600">
              {logs.length} entr{logs.length === 1 ? "y" : "ies"}
            </span>
          </div>

          {/* Log rows */}
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            {loading && logs.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-zinc-600 text-sm gap-2">
                <RefreshCw className="size-4 animate-spin" />
                Loading logs…
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-600 gap-2">
                <Activity className="size-8 opacity-30" />
                <p className="text-sm">No logs yet. Trigger a search to see activity here.</p>
              </div>
            ) : (
              logs.map((log, idx) => (
                <LogRow
                  key={log.id}
                  log={log}
                  prevDate={idx > 0 ? formatDate(logs[idx - 1].created_at) : null}
                />
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

export default function AdminDashPage() {
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
