"use client";

import { useState, useMemo, Suspense, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { FeedFilterValues } from "@/validations/feed";
import { paramsToFilters, filtersToParams } from "@/lib/feed-params";
import TopBar from "@/components/layout/TopBar";
import FeedFilterForm from "@/components/feed/search/FeedFilterForm";
import FeedResults from "@/components/feed/FeedResults";
import VacancyPanel from "@/components/feed/vacancy/VacancyPanel";
import { useFeed } from "@/hooks/use-feed";
import { useSavedCheck, useSavedVacancies } from "@/hooks/use-saved-vacancies";
import { useProfile } from "@/contexts/ProfileContext";
import { useFeedUrl } from "@/contexts/FeedUrlContext";
import { JobSource, JobListing } from "@/types";

const DATE_RANGES: Record<string, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "1m": 31,
};

// Refinement layer — runs client-side on already-fetched results.
function applyLocalFilters(jobs: JobListing[], filters: Partial<FeedFilterValues>) {
  if (!filters) return jobs;

  let filtered = jobs.filter((job) => {
    const titleNorm = (job.title || "").toLowerCase();
    const locNorm = (job.location_str || "").toLowerCase();
    const snippetNorm = (job.description_snippet || "").toLowerCase();
    const combined = `${titleNorm} ${locNorm} ${snippetNorm}`;

    // Sources
    if (filters.sources && filters.sources.length > 0) {
      if (!filters.sources.includes(job.source as JobSource)) return false;
    }

    // Work modes
    if (filters.workModes && filters.workModes.length > 0) {
      const allowed = filters.workModes.map((m) => m.toLowerCase());
      const mentionsRemote = combined.includes("remote");
      const mentionsHybrid = combined.includes("hybrid");
      const mentionsOnsite =
        combined.includes("onsite") || combined.includes("on-site") || combined.includes("office");
      const mentionsAnyMode = mentionsRemote || mentionsHybrid || mentionsOnsite;

      if (mentionsAnyMode) {
        const hasAllowedMode =
          (allowed.includes("remote") && mentionsRemote) ||
          (allowed.includes("hybrid") && mentionsHybrid) ||
          (allowed.includes("onsite") && mentionsOnsite);
        if (!hasAllowedMode) return false;
      }
    }

    // Experience
    if (filters.experience && filters.experience.length > 0) {
      const allowed = filters.experience.map((e) => e.toLowerCase());
      const seniorWords = [
        "senior", "lead", "head", "director", "principal", "manager", "expert", "sr",
      ];
      const internWords = [
        "intern", "internship", "trainee", "graduate", "fresher", "freshmen", "stajyer", "entry",
      ];

      const isSenior = seniorWords.some((w) => new RegExp(`\\b${w}\\b`).test(titleNorm));
      const isInternSignal = internWords.some(
        (w) =>
          new RegExp(`\\b${w}\\b`).test(titleNorm) || new RegExp(`\\b${w}\\b`).test(snippetNorm),
      );

      if (isSenior && !allowed.some((e) => ["senior", "lead"].includes(e))) return false;

      const onlyIntern =
        allowed.includes("intern") &&
        !["junior", "mid", "senior", "lead"].some((e) => allowed.includes(e));
      if (onlyIntern && !isInternSignal) return false;

      const onlySenior = allowed.every((e) => ["senior", "lead"].includes(e));
      if (onlySenior && isInternSignal && !isSenior) return false;
    }

    // Job types
    if (filters.jobTypes && filters.jobTypes.length > 0) {
      const allowed = filters.jobTypes.map((jt) => jt.toLowerCase());
      const isContract = /\b(contract|contractor|freelance|temporary|temp|consulting)\b/i.test(combined);
      const isPartTime = /\b(part[\s-]?time|p\/t)\b/i.test(combined);
      if (isContract && !allowed.includes("contract")) return false;
      if (isPartTime && !allowed.includes("part-time")) return false;
    }

    // Salary
    if (filters.salaryMin) {
      const annualMin = parseInt(filters.salaryMin.replace(/,/g, ""), 10);
      if (!isNaN(annualMin) && annualMin > 0) {
        const salaryText = `${titleNorm} ${snippetNorm}`;
        let foundSalary = false;
        let passesSalary = true;

        const rangeKK = salaryText.match(
          /[\$£€]?\s*\d+(?:\.\d+)?\s*k\s*[-–]\s*[\$£€]?\s*(\d+(?:\.\d+)?)\s*k/,
        );
        if (rangeKK) {
          foundSalary = true;
          if (parseFloat(rangeKK[1]) * 1000 < annualMin) passesSalary = false;
        }
        if (!foundSalary) {
          const rangeK = salaryText.match(/[\$£€]?\s*\d+\s*[-–]\s*[\$£€]?\s*(\d+(?:\.\d+)?)\s*k/);
          if (rangeK) {
            foundSalary = true;
            if (parseFloat(rangeK[1]) * 1000 < annualMin) passesSalary = false;
          }
        }
        if (!foundSalary) {
          const hourly = salaryText.match(
            /[\$£€]?\s*(\d+(?:[.,]\d+)?)\s*(?:\/\s*h(?:r|our)?|per\s*h(?:r|our))/,
          );
          if (hourly) {
            foundSalary = true;
            const rate = parseFloat(hourly[1].replace(",", "."));
            if (!isNaN(rate) && rate * 2080 < annualMin) passesSalary = false;
          }
        }
        if (!foundSalary) {
          const annualK = salaryText.match(/[\$£€]?\s*(\d+(?:\.\d+)?)\s*k(?:\/yr)?/);
          if (annualK) {
            foundSalary = true;
            if (parseFloat(annualK[1]) * 1000 < annualMin) passesSalary = false;
          }
        }

        if (foundSalary && !passesSalary) return false;
      }
    }

    // Date posted
    if (filters.datePosted && DATE_RANGES[filters.datePosted]) {
      const maxDays = DATE_RANGES[filters.datePosted];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - maxDays);
      if (job.date_posted) {
        try {
          const jobDate = new Date(job.date_posted.replace("Z", "").split(".")[0]);
          if (!isNaN(jobDate.getTime()) && jobDate < cutoff) return false;
        } catch {
          // Keep job if date unparseable
        }
      }
    }

    return true;
  });

  // Sorting
  if (filters.sortBy) {
    if (filters.sortBy === "job-title-ascending") {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    } else if (filters.sortBy === "job-title-descending") {
      filtered = [...filtered].sort((a, b) => b.title.localeCompare(a.title));
    } else if (filters.sortBy === "date-desc" || filters.sortBy === "latest") {
      filtered = [...filtered].sort((a, b) => {
        const da = new Date(a.date_posted || "").getTime() || 0;
        const db = new Date(b.date_posted || "").getTime() || 0;
        return db - da;
      });
    } else if (filters.sortBy === "date-asc") {
      filtered = [...filtered].sort((a, b) => {
        const da = new Date(a.date_posted || "").getTime() || 0;
        const db = new Date(b.date_posted || "").getTime() || 0;
        return da - db;
      });
    }
  }

  return filtered;
}

function FeedPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlFilters = useMemo(() => paramsToFilters(searchParams), [searchParams]);
  const [localFilters, setLocalFilters] = useState<Partial<FeedFilterValues>>(urlFilters);

  const {
    highMatch,
    needsReview,
    error,
    panelJob,
    setPanelJob,
    loading,
    progress,
    hasSearched,
    creditsLeft,
    maxCredits,
    outOfCredits,
    dataUpdatedAt,
    invalidateFeed,
    refreshFeed,
  } = useFeed(urlFilters);

  const { profile } = useProfile();
  const { setFeedUrl } = useFeedUrl();

  // Saved vacancies integration
  const allJobUrls = useMemo(() => {
    return [...highMatch, ...needsReview].map((j) => j.url);
  }, [highMatch, needsReview]);

  const { savedSet } = useSavedCheck(allJobUrls);
  const { saveMutation, unsaveMutation } = useSavedVacancies();
  const [savePendingUrl, setSavePendingUrl] = useState<string | null>(null);

  const handleToggleSave = (job: JobListing) => {
    setSavePendingUrl(job.url);
    if (savedSet.has(job.url)) {
      unsaveMutation.mutate(job.url, {
        onSettled: () => setSavePendingUrl(null),
      });
    } else {
      saveMutation.mutate(
        { job_url: job.url, job_data: job },
        { onSettled: () => setSavePendingUrl(null) },
      );
    }
  };

  useEffect(() => {
    const qs = searchParams.toString();
    setFeedUrl(qs ? `/dashboard/feed?${qs}` : "/dashboard/feed");
  }, [searchParams, setFeedUrl]);

  const profileDefaults = useMemo<Partial<FeedFilterValues>>(() => {
    const result: Partial<FeedFilterValues> = {};
    if (profile.headline) {
      result.query = profile.headline;
    }
    if (profile.work_modes?.length) result.workModes = profile.work_modes as string[];
    if (profile.experience_level?.length) result.experience = profile.experience_level;
    if (profile.job_types?.length) result.jobTypes = profile.job_types;
    if (
      profile.preferred_location?.value ||
      (profile.preferred_location?.values?.length ?? 0) > 0
    ) {
      result.location = profile.preferred_location;
    }
    if (profile.salary_min) {
      result.salaryMin = profile.salary_min;
      result.salaryPeriod = (profile.salary_period as FeedFilterValues["salaryPeriod"]) ?? "annual";
    }
    return result;
  }, [profile]);

  const filteredHighMatch = useMemo(
    () => applyLocalFilters(highMatch, localFilters),
    [highMatch, localFilters],
  );
  const filteredNeedsReview = useMemo(
    () => applyLocalFilters(needsReview, localFilters),
    [needsReview, localFilters],
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (localFilters.sources?.length) n++;
    if (localFilters.workModes?.length) n++;
    if (localFilters.location?.value || (localFilters.location?.values?.length ?? 0) > 0) n++;
    if (localFilters.experience?.length) n++;
    if (localFilters.jobTypes?.length) n++;
    if (localFilters.salaryMin) n++;
    if (localFilters.datePosted) n++;
    if (localFilters.sortBy) n++;
    return n;
  }, [localFilters]);

  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  function onSearchSubmit(values: FeedFilterValues) {
    setLocalFilters(values);
    invalidateFeed();

    const qs = filtersToParams(values).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    clearTimeout(flashTimer.current!);
    setFlash(true);
    flashTimer.current = setTimeout(() => setFlash(false), 600);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <TopBar title="Job Feed" />

      <div className="p-6 space-y-5">
        <div data-tour="feed-filter">
          <FeedFilterForm
            onSubmit={onSearchSubmit}
            onChange={setLocalFilters}
            loading={loading}
            profileDefaults={profileDefaults}
            initialValues={urlFilters}
          />
        </div>
        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div ref={resultsRef} data-tour="feed-results">
          <FeedResults
            highMatch={filteredHighMatch}
            needsReview={filteredNeedsReview}
            loading={loading}
            progress={progress}
            hasSearched={hasSearched}
            flash={flash}
            activeFilterCount={activeFilterCount}
            creditsLeft={creditsLeft}
            maxCredits={maxCredits}
            outOfCredits={outOfCredits}
            dataUpdatedAt={dataUpdatedAt}
            onRefresh={refreshFeed}
            savedUrls={savedSet}
            onToggleSave={handleToggleSave}
            savePending={savePendingUrl}
            onDetails={(job) => setPanelJob(job)}
          />
        </div>
      </div>

      <VacancyPanel job={panelJob} onClose={() => setPanelJob(null)} />
    </>
  );
}

export default function FeedPage() {
  return (
    <Suspense>
      <FeedPageInner />
    </Suspense>
  );
}
