"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Search, History, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const HISTORY_KEY = "jc_search_history";
const MAX_HISTORY = 8;

const SEARCH_RECOMMENDATIONS = [
  "Software Engineer", "Product Manager", "Marketing Manager", "UX Designer",
  "Data Analyst", "Financial Analyst", "HR Recruiter", "Sales Executive",
  "Business Analyst", "Operations Manager", "Content Specialist", "Customer Support",
  "Accountant", "Project Manager",
];

export interface SearchAutocompleteHandle {
  pushHistory: (q: string) => void;
}

interface SearchAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  profileDefaultQuery?: string;
  initialQuery?: string;
}

const SearchAutocomplete = forwardRef<SearchAutocompleteHandle, SearchAutocompleteProps>(function SearchAutocomplete({
  value,
  onChange,
  disabled,
  profileDefaultQuery,
  initialQuery,
}, ref) {
  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const suppressNextOutsideCloseRef = useRef(false);

  const normalizedQuery = (value ?? "").trim().toLowerCase();

  useEffect(() => { setHistoryIndex(-1); }, [showHistory]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suppressNextOutsideCloseRef.current) {
        suppressNextOutsideCloseRef.current = false;
        return;
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pushHistory = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeHistory = (item: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== item);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const visibleHistory = useMemo(() => {
    if (!normalizedQuery) return history;
    return history.filter((item) => item.toLowerCase().includes(normalizedQuery));
  }, [history, normalizedQuery]);

  const recommendations = useMemo(() => {
    const personalized = [profileDefaultQuery, initialQuery]
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item));

    const seen = new Set<string>();
    const pool = [...personalized, ...SEARCH_RECOMMENDATIONS].filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const available = pool
      .filter((item) => item.toLowerCase() !== normalizedQuery)
      .filter((item) => !history.some((h) => h.toLowerCase() === item.toLowerCase()));

    const matched = available.filter(
      (item) => !normalizedQuery || item.toLowerCase().includes(normalizedQuery),
    );

    return (matched.length > 0 ? matched : available).slice(0, normalizedQuery ? 6 : 5);
  }, [history, profileDefaultQuery, initialQuery, normalizedQuery]);

  const dropdownItems = useMemo(
    () => [
      ...visibleHistory.map((item) => ({ type: "history" as const, value: item })),
      ...recommendations.map((item) => ({ type: "recommendation" as const, value: item })),
    ],
    [visibleHistory, recommendations],
  );

  useEffect(() => {
    setHistoryIndex((current) => {
      if (dropdownItems.length === 0) return -1;
      return Math.min(current, dropdownItems.length - 1);
    });
  }, [dropdownItems]);

  useImperativeHandle(ref, () => ({ pushHistory }));

  const fillQuery = (q: string) => {
    onChange(q);
    setShowHistory(false);
  };

  return (
    <div className="relative flex-1" ref={searchRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none z-10" />
      <Input
        value={value}
        disabled={disabled}
        placeholder="Job title or skill..."
        className="pl-10 h-12 text-[15px]"
        autoComplete="off"
        onFocus={() => setShowHistory(true)}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && showHistory && dropdownItems.length > 0) {
            e.preventDefault();
            setHistoryIndex((i) => Math.min(i + 1, dropdownItems.length - 1));
          } else if (e.key === "ArrowUp" && showHistory && dropdownItems.length > 0) {
            e.preventDefault();
            setHistoryIndex((i) => Math.max(i - 1, -1));
          } else if (e.key === "Escape") {
            setShowHistory(false);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (showHistory) setShowHistory(false);
            if (historyIndex >= 0) fillQuery(dropdownItems[historyIndex].value);
          }
        }}
      />

      {showHistory && dropdownItems.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-border/60 bg-popover shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {visibleHistory.length > 0 && (
            <>
              <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 flex items-center gap-1.5">
                  <History className="size-3" /> Recent searches
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-[10px] text-muted-foreground/50 hover:text-destructive hover:bg-transparent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    suppressNextOutsideCloseRef.current = true;
                    setHistory([]);
                    localStorage.removeItem(HISTORY_KEY);
                  }}
                >
                  Clear all
                </Button>
              </div>
              <ul className="py-1">
                {visibleHistory.map((item, i) => (
                  <li
                    key={item}
                    className={cn("flex items-center gap-2 px-3 py-2 cursor-pointer group transition-colors", i === historyIndex ? "bg-muted/80" : "hover:bg-muted/60")}
                    onMouseEnter={() => setHistoryIndex(i)}
                    onMouseLeave={() => setHistoryIndex(-1)}
                    onMouseDown={(e) => { e.preventDefault(); fillQuery(item); }}
                  >
                    <History className="size-3.5 text-muted-foreground/40 shrink-0" />
                    <span className="flex-1 text-sm text-foreground/80 truncate">{item}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-5 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive hover:bg-transparent transition-all shrink-0"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        suppressNextOutsideCloseRef.current = true;
                        removeHistory(item);
                      }}
                    >
                      <X className="size-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {recommendations.length > 0 && (
            <>
              <div className="px-3 pt-2.5 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 flex items-center gap-1.5">
                  <Search className="size-3" /> Recommendations
                </span>
              </div>
              <ul className="py-1">
                {recommendations.map((item, i) => {
                  const itemIndex = visibleHistory.length + i;
                  return (
                    <li
                      key={item}
                      className={cn("flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors", itemIndex === historyIndex ? "bg-muted/80" : "hover:bg-muted/60")}
                      onMouseEnter={() => setHistoryIndex(itemIndex)}
                      onMouseLeave={() => setHistoryIndex(-1)}
                      onMouseDown={(e) => { e.preventDefault(); fillQuery(item); }}
                    >
                      <Search className="size-3.5 text-muted-foreground/40 shrink-0" />
                      <span className="flex-1 text-sm text-foreground/80 truncate">{item}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default SearchAutocomplete;
