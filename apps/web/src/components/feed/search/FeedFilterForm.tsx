"use client";

import { useMemo, useEffect, useRef, useState } from "react";

import {
  Sparkles,
  DollarSign,
  CalendarDays,
  ArrowUpDown,
  Globe2,
  Monitor,
  GraduationCap,
  Briefcase,
  LucideSearch,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { feedFilterSchema, FeedFilterValues } from "@/validations/feed";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { useMetaFilters } from "@/hooks/use-meta";
import SelectBox from "@/components/SelectBox";
import LocationPicker from "@/components/feed/search/LocationPicker";
import SearchAutocomplete, { SearchAutocompleteHandle } from "@/components/feed/search/SearchAutocomplete";
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
  const { control, handleSubmit, watch, reset, getValues } = useForm<FeedFilterValues>({
    resolver: zodResolver(feedFilterSchema),
    defaultValues: { ...EMPTY_FILTERS, ...initialValues },
  });

  const formRef = useRef<HTMLFormElement>(null);
  const searchAutocompleteRef = useRef<SearchAutocompleteHandle>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  const watchedSources = watch("sources");
  const watchedWorkModes = watch("workModes");
  const watchedExperience = watch("experience");
  const watchedJobTypes = watch("jobTypes");
  const watchedDatePosted = watch("datePosted");
  const watchedSortBy = watch("sortBy");

  const activeFilterCount = [
    watchedSources?.length,
    watchedWorkModes?.length,
    watchedLocation ? 1 : 0,
    watchedExperience?.length,
    watchedJobTypes?.length,
    watchedSalaryMin ? 1 : 0,
    watchedDatePosted ? 1 : 0,
    watchedSortBy ? 1 : 0,
  ].filter(Boolean).length;

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
          ref={formRef}
          onSubmit={handleSubmit((values) => {
            searchAutocompleteRef.current?.pushHistory(values.query ?? "");
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            onSubmit(values);
          })}
          className="space-y-4"
        >
          <p className="text-[10px] text-muted-foreground mb-1">
            Selected filters usually make the search more specific and improve
            result quality.
          </p>

          {/* Search row — stacks on mobile */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Controller
              name="query"
              control={control}
              render={({ field }) => (
                <SearchAutocomplete
                  ref={searchAutocompleteRef}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={loading}
                  profileDefaultQuery={profileDefaults?.query}
                  initialQuery={initialValues?.query}
                />
              )}
            />
            <div className="flex gap-2 sm:contents">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span data-tour="fill-profile-btn" tabIndex={-1} className="flex-1 sm:flex-none">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading || !hasProfileDefaults}
                      className="gap-1.5 h-12 w-full sm:w-auto shrink-0 text-muted-foreground"
                      onClick={() => {
                        const currentQuery = getValues("query");
                        reset({
                          ...EMPTY_FILTERS,
                          ...profileDefaults,
                          query: profileDefaults?.query || currentQuery,
                        });
                      }}
                    >
                      <Sparkles className="size-4" />
                      <span className="hidden sm:inline">Fill from profile</span>
                      <span className="sm:hidden">Fill</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                {!hasProfileDefaults && (
                  <TooltipContent side="bottom" className="max-w-56 text-center">
                    Your profile has no data yet. Add a job title, location, or preferences in your{" "}
                    <span className="font-semibold">Profile</span> page to use this.
                  </TooltipContent>
                )}
              </Tooltip>
              <Button type="submit" disabled={loading} className="gap-2 px-5 h-12 shrink-0 flex-1 sm:flex-none" data-tour="search-btn">
                {loading ? (
                  <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <LucideSearch className="size-4" />
                )}
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
          </div>

          {/* Mobile filter toggle — hidden on md+ where filters are always visible */}
          <div className="flex md:hidden items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 text-xs"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="size-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none shrink-0">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={cn("size-3.5 transition-transform duration-200", filtersOpen && "rotate-180")} />
            </Button>
            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground"
                onClick={() => reset({ ...EMPTY_FILTERS })}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Filter grids — always visible on md+, toggled on mobile */}
          <div className={cn("space-y-3", !filtersOpen && "hidden md:block")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 border-t border-border/60 pt-3.5">
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
          </div>{/* end collapsible filter section */}
        </form>
      </CardContent>
    </Card>
  );
}
