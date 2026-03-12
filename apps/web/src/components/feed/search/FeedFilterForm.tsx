"use client";

import { useMemo, useEffect, useState, useRef } from "react";

import {
  Search,
  Sparkles,
  DollarSign,
  CalendarDays,
  ArrowUpDown,
  Globe2,
  Monitor,
  GraduationCap,
  Briefcase,
  LucideSearch,
  History,
  X,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { feedFilterSchema, FeedFilterValues } from "@/validations/feed";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useMetaFilters } from "@/hooks/use-meta";
import SelectBox from "@/components/SelectBox";
import LocationPicker from "@/components/feed/search/LocationPicker";
import { LocationValue } from "@/types";
import { SALARY_PERIOD_OPTIONS } from "@/constants";

const EMPTY_FILTERS: FeedFilterValues = {
  query: "",
  sources: [],
  workModes: [],
  location: undefined,
  experience: [],
  jobTypes: [],
  salaryMin: "",
  salaryPeriod: "annual",
  datePosted: "",
  sortBy: "",
};

interface FeedFilterFormProps {
  onSubmit: (values: FeedFilterValues) => void;
  onChange?: (values: FeedFilterValues) => void;
  loading?: boolean;
  profileDefaults?: Partial<FeedFilterValues>;
  initialValues?: Partial<FeedFilterValues>;
}

export default function FeedFilterForm({
  onSubmit,
  onChange,
  loading,
  profileDefaults,
  initialValues,
}: FeedFilterFormProps) {
  const { data: meta } = useMetaFilters();
  const { control, handleSubmit, watch, reset, setValue } = useForm<FeedFilterValues>({
    resolver: zodResolver(feedFilterSchema),
    defaultValues: { ...EMPTY_FILTERS, ...initialValues },
  });

  const HISTORY_KEY = "jc_search_history";
  const MAX_HISTORY = 8;

  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistoryIndex(-1);
  }, [showHistory]);

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const appliedInitialRef = useRef(false);
  useEffect(() => {
    if (appliedInitialRef.current) return;
    if (!initialValues || Object.keys(initialValues).length === 0) return;
    appliedInitialRef.current = true;
    reset({ ...EMPTY_FILTERS, ...initialValues });
  }, [initialValues, reset]);

  useEffect(() => {
    if (onChange) {
      const subscription = watch((value) => {
        onChange(value as FeedFilterValues);
      });
      return () => subscription.unsubscribe();
    }
  }, [watch, onChange]);

  const hasProfileDefaults = profileDefaults
    ? Object.values(profileDefaults).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)))
    : false;

  const watchedLocation = watch("location");
  const watchedSalaryMin = watch("salaryMin");

  const currency = useMemo(() => {
    if (!meta || !watchedLocation) return "USD";
    if (watchedLocation.type === "region" && watchedLocation.value === "worldwide") return "USD";

    let selectedCountryCode: string | null = null;
    if (watchedLocation.type === "country" && watchedLocation.value) {
      selectedCountryCode = watchedLocation.value;
    } else if (
      watchedLocation.type === "city" &&
      watchedLocation.values &&
      watchedLocation.values.length > 0
    ) {
      const firstCity = watchedLocation.values[0];
      const foundCountry = meta.countries.find((c) =>
        c.cities.some((ci) => ci.value === firstCity),
      );
      if (foundCountry) {
        selectedCountryCode = foundCountry.value;
      }
    }

    if (selectedCountryCode) {
      const country = meta.countries.find((c) => c.value === selectedCountryCode);
      return country?.currency || "USD";
    }

    return "USD";
  }, [meta, watchedLocation]);

  return (
    <Card className="py-0 shadow-sm border-border/60">
      <CardContent className="pt-5 pb-4 space-y-4">
        <form
          onSubmit={handleSubmit((values) => {
            pushHistory(values.query ?? "");
            onSubmit(values);
          })}
          className="space-y-4"
        >
          <div className="flex gap-2">
            <div className="relative flex-1" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none z-10" />
              <Controller
                name="query"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    disabled={loading}
                    placeholder="Job title or skill..."
                    className="pl-10 h-12 text-[15px]"
                    autoComplete="off"
                    onFocus={() => setShowHistory(true)}
                    onKeyDown={(e) => {
                      if (!showHistory || history.length === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHistoryIndex((i) => Math.min(i + 1, history.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHistoryIndex((i) => Math.max(i - 1, -1));
                      } else if (e.key === "Enter" && historyIndex >= 0) {
                        e.preventDefault();
                        setValue("query", history[historyIndex]);
                        setShowHistory(false);
                      } else if (e.key === "Escape") {
                        setShowHistory(false);
                      }
                    }}
                  />
                )}
              />
              {showHistory && history.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-border/60 bg-popover shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 flex items-center gap-1.5">
                      <History className="size-3" />
                      Recent searches
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-[10px] text-muted-foreground/50 hover:text-destructive hover:bg-transparent"
                      onClick={() => {
                        setHistory([]);
                        localStorage.removeItem(HISTORY_KEY);
                      }}
                    >
                      Clear all
                    </Button>
                  </div>
                  <ul className="py-1">
                    {history.map((item, i) => (
                      <li
                        key={item}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 cursor-pointer group transition-colors",
                          i === historyIndex ? "bg-muted/80" : "hover:bg-muted/60",
                        )}
                        onMouseEnter={() => setHistoryIndex(i)}
                        onMouseLeave={() => setHistoryIndex(-1)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setValue("query", item);
                          setShowHistory(false);
                        }}
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
                            removeHistory(item);
                          }}
                        >
                          <X className="size-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {hasProfileDefaults && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                className="gap-1.5 h-12 shrink-0 text-muted-foreground"
                onClick={() => reset({ ...EMPTY_FILTERS, ...profileDefaults })}
              >
                <Sparkles className="size-4" />
                Fill from profile
              </Button>
            )}
            <Button type="submit" disabled={loading} className="gap-2 px-6 h-12 shrink-0">
              {loading ? (
                <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <LucideSearch className="size-4" />
              )}
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
            <Controller
              name="sources"
              control={control}
              render={({ field }) => (
                <SelectBox
                  disabled={loading}
                  icon={<Globe2 className="size-4 text-muted-foreground" />}
                  placeholder="Source"
                  options={meta?.sources ?? []}
                  mode="multiple"
                  value={field.value}
                  onChange={field.onChange}
                  search={{ placeholder: "Search manually..." }}
                />
              )}
            />
            <Controller
              name="workModes"
              control={control}
              render={({ field }) => (
                <SelectBox
                  disabled={loading}
                  icon={<Monitor className="size-4 text-muted-foreground" />}
                  placeholder="Work mode"
                  options={meta?.work_modes ?? []}
                  mode="multiple"
                  value={field.value}
                  onChange={field.onChange}
                  search={{ placeholder: "Search manually..." }}
                />
              )}
            />

            <Controller
              name="location"
              control={control}
              render={({ field: locationField }) => (
                <LocationPicker
                  disabled={loading}
                  value={locationField.value as LocationValue}
                  onChange={locationField.onChange}
                  countries={meta?.countries ?? []}
                />
              )}
            />

            <Controller
              name="experience"
              control={control}
              render={({ field }) => (
                <SelectBox
                  disabled={loading}
                  icon={<GraduationCap className="size-4 text-muted-foreground" />}
                  placeholder="Experience"
                  options={meta?.experience_levels ?? []}
                  mode="multiple"
                  value={field.value}
                  onChange={field.onChange}
                  search={{ placeholder: "Search manually..." }}
                />
              )}
            />

            <Controller
              name="jobTypes"
              control={control}
              render={({ field }) => (
                <SelectBox
                  disabled={loading}
                  icon={<Briefcase className="size-4 text-muted-foreground" />}
                  placeholder="Job type"
                  options={meta?.job_types ?? []}
                  mode="multiple"
                  value={field.value}
                  onChange={field.onChange}
                  search={{ placeholder: "Search manually..." }}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2 border-t border-border/60 pt-3.5">
            <div className="xl:col-span-3 flex flex-col gap-1">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border border-input bg-transparent dark:bg-input/30! px-3 py-0 h-9 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring",
                  loading && "opacity-50 pointer-events-none",
                )}
              >
                <DollarSign className="size-4 text-muted-foreground shrink-0" />

                <Controller
                  name="salaryMin"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      disabled={loading}
                      autoComplete="off"
                      placeholder="Minimum salary"
                      className="dark:bg-transparent rounded-none h-full w-full border-none p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground disabled:opacity-100"
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        if (!raw) {
                          field.onChange("");
                          return;
                        }
                        const formatted = new Intl.NumberFormat("en-US").format(Number(raw));
                        field.onChange(formatted);
                      }}
                    />
                  )}
                />

                <div className="flex items-center gap-0.5 border-l border-border/60 pl-2 shrink-0">
                  <Controller
                    name="salaryPeriod"
                    control={control}
                    render={({ field: pField }) => (
                      <>
                        {SALARY_PERIOD_OPTIONS.map(({ value, label }) => (
                          <Button
                            key={value}
                            type="button"
                            disabled={loading}
                            variant={(pField.value ?? "annual") === value ? "secondary" : "ghost"}
                            className="h-5 min-w-0 px-1.5 text-[10px] font-semibold rounded-sm disabled:opacity-100"
                            onClick={() => pField.onChange(value)}
                          >
                            {label}
                          </Button>
                        ))}
                      </>
                    )}
                  />
                </div>

                <span className="text-xs text-muted-foreground/70 shrink-0">{currency}</span>
              </div>

              {watchedSalaryMin && (
                <p className="text-[10px] text-muted-foreground/50 pl-1 leading-tight">
                  Only filters jobs with salary stated in the title. Most listings don&apos;t
                  include salary data.
                </p>
              )}
            </div>

            <Controller
              name="datePosted"
              control={control}
              render={({ field }) => (
                <SelectBox
                  disabled={loading}
                  icon={<CalendarDays className="size-4 text-muted-foreground" />}
                  placeholder="Date posted"
                  options={meta?.date_posted ?? []}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />

            <Controller
              name="sortBy"
              control={control}
              render={({ field }) => (
                <SelectBox
                  disabled={loading}
                  icon={<ArrowUpDown className="size-3.5 text-muted-foreground" />}
                  placeholder="Sort by"
                  options={meta?.sort_options ?? []}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
