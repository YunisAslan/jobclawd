"use client";

import { useMemo, useEffect } from "react";

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
  Info,
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
import LocationPicker from "@/components/feed/LocationPicker";

interface FeedFilterFormProps {
  onSubmit: (values: FeedFilterValues) => void;
  onChange?: (values: FeedFilterValues) => void;
  loading?: boolean;
}

const PERIOD_OPTIONS = [
  { value: "annual", label: "yr" },
  { value: "monthly", label: "mo" },
  { value: "hourly", label: "hr" },
] as const;

export default function FeedFilterForm({
  onSubmit,
  onChange,
  loading,
}: FeedFilterFormProps) {
  const { data: meta } = useMetaFilters();
  const { control, handleSubmit, watch } = useForm<FeedFilterValues>({
    resolver: zodResolver(feedFilterSchema),
    defaultValues: {
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
    },
  });

  useEffect(() => {
    if (onChange) {
      const subscription = watch((value) => {
        onChange(value as FeedFilterValues);
      });
      return () => subscription.unsubscribe();
    }
  }, [watch, onChange]);

  const watchedLocation = watch("location");
  const watchedSalaryMin = watch("salaryMin");

  const currency = useMemo(() => {
    if (!meta || !watchedLocation) return "USD";
    if (
      watchedLocation.type === "region" &&
      watchedLocation.value === "worldwide"
    )
      return "USD";

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
      const country = meta.countries.find(
        (c) => c.value === selectedCountryCode,
      );
      return country?.currency || "USD";
    }

    return "USD";
  }, [meta, watchedLocation]);

  return (
    <Card className="py-0 shadow-sm border-border/60">
      <CardContent className="pt-5 pb-4 space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Search row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
              <Controller
                name="query"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    disabled={loading}
                    placeholder="Job title or skill..."
                    className="pl-10 h-12 text-[15px]"
                  />
                )}
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="gap-2 px-6 h-12 shrink-0"
            >
              {loading ? (
                <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>

          {/* Primary filters */}
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
                  value={locationField.value}
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
                  icon={
                    <GraduationCap className="size-4 text-muted-foreground" />
                  }
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
                />
              )}
            />
          </div>

          {/* Secondary filters — salary / date / sort */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2 border-t border-border/60 pt-3.5">

            {/* Salary — spans 3 cols to make room for period selector */}
            <div className="xl:col-span-3 flex flex-col gap-1">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-0 h-9 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring",
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
                      className="rounded-none h-full w-full border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground disabled:opacity-100"
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        if (!raw) {
                          field.onChange("");
                          return;
                        }
                        const formatted = new Intl.NumberFormat("en-US").format(
                          Number(raw),
                        );
                        field.onChange(formatted);
                      }}
                    />
                  )}
                />

                {/* Period selector */}
                <div className="flex items-center gap-0.5 border-l border-border/60 pl-2 shrink-0">
                  <Controller
                    name="salaryPeriod"
                    control={control}
                    render={({ field: pField }) => (
                      <>
                        {PERIOD_OPTIONS.map(({ value, label }) => (
                          <Button
                            key={value}
                            type="button"
                            disabled={loading}
                            variant={
                              (pField.value ?? "annual") === value
                                ? "secondary"
                                : "ghost"
                            }
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

                <span className="text-xs text-muted-foreground/70 shrink-0">
                  {currency}
                </span>
              </div>

              {/* Salary disclaimer — only visible when a value is entered */}
              {watchedSalaryMin && (
                <p className="text-[10px] text-muted-foreground/50 pl-1 leading-tight">
                  Only filters jobs with salary stated in the title. Most listings don&apos;t include salary data.
                </p>
              )}
            </div>

            <Controller
              name="datePosted"
              control={control}
              render={({ field }) => (
                <SelectBox
                  disabled={loading}
                  icon={
                    <CalendarDays className="size-4 text-muted-foreground" />
                  }
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
                  icon={
                    <ArrowUpDown className="size-3.5 text-muted-foreground" />
                  }
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
