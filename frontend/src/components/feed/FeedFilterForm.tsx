"use client";

import { useMemo } from "react";

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
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { feedFilterSchema, FeedFilterValues } from "@/validations/feed";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useMetaFilters } from "@/hooks/use-meta";
import SelectBox from "@/components/SelectBox";
import LocationPicker from "@/components/feed/LocationPicker";

interface FeedFilterFormProps {
  onSubmit: (values: FeedFilterValues) => void;
}

export default function FeedFilterForm({ onSubmit }: FeedFilterFormProps) {
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
      datePosted: "",
      sortBy: "",
    },
  });

  const workModes = watch("workModes") ?? [];
  const location = watch("location");

  const currency = useMemo(() => {
    if (!meta || !location) return "USD";
    if (location.type === "region" && location.value === "worldwide")
      return "USD";

    let selectedCountryCode: string | null = null;
    if (location.type === "country" && location.value) {
      selectedCountryCode = location.value;
    } else if (
      location.type === "city" &&
      location.values &&
      location.values.length > 0
    ) {
      const firstCity = location.values[0];
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
  }, [meta, location]);

  return (
    <Card className="py-0 shadow-sm border-border/60">
      <CardContent className="pt-5 pb-4 space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
              <Controller
                name="query"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="Job title or skill..."
                    className="pl-10 h-12 text-[15px]"
                  />
                )}
              />
            </div>
            <Button type="submit" className="gap-2 px-6 h-12 shrink-0">
              <Sparkles className="size-4" />
              Search
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
            <Controller
              name="sources"
              control={control}
              render={({ field }) => (
                <SelectBox
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
                  value={locationField.value}
                  onChange={locationField.onChange}
                  workModes={workModes}
                  countries={meta?.countries ?? []}
                />
              )}
            />

            <Controller
              name="experience"
              control={control}
              render={({ field }) => (
                <SelectBox
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2 border-t border-border/60 pt-3.5">
            <div className="inline-flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-0 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-0">
              <DollarSign className="size-4 text-muted-foreground shrink-0" />
              <Controller
                name="salaryMin"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    autoComplete="off"
                    placeholder="Minimum salary"
                    className="rounded-none h-8.5 w-full border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
                  />
                )}
              />
              <span className="text-sm text-muted-foreground">{currency}</span>
            </div>

            <Controller
              name="datePosted"
              control={control}
              render={({ field }) => (
                <SelectBox
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
