"use client";

import { useState, useMemo } from "react";
import { FeedFilterValues } from "@/validations/feed";
import TopBar from "@/components/layout/TopBar";
import FeedFilterForm from "@/components/feed/FeedFilterForm";
import FeedResults from "@/components/feed/FeedResults";
import { useFeed } from "@/hooks/use-feed";
import { useProfile } from "@/contexts/ProfileContext";
import { JobSource, JobListing } from "@/types";

const DATE_RANGES: Record<string, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "1m": 31,
};

// Refinement layer — runs client-side on already-fetched results.
// Does NOT re-apply query or location (those require a new backend search).
// Only narrows by sources, workModes, experience, jobTypes, datePosted, sortBy.
function applyLocalFilters(
  jobs: JobListing[],
  filters: Partial<FeedFilterValues>,
) {
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

    // Work modes — only filter if the job explicitly mentions a mode we don't want
    if (filters.workModes && filters.workModes.length > 0) {
      const allowed = filters.workModes.map((m) => m.toLowerCase());
      const mentionsRemote = combined.includes("remote");
      const mentionsHybrid = combined.includes("hybrid");
      const mentionsOnsite =
        combined.includes("onsite") ||
        combined.includes("on-site") ||
        combined.includes("office");
      const mentionsAnyMode = mentionsRemote || mentionsHybrid || mentionsOnsite;

      if (mentionsAnyMode) {
        const hasAllowedMode =
          (allowed.includes("remote") && mentionsRemote) ||
          (allowed.includes("hybrid") && mentionsHybrid) ||
          (allowed.includes("onsite") && mentionsOnsite);
        if (!hasAllowedMode) return false;
      }
    }

    // Experience — check title and snippet
    if (filters.experience && filters.experience.length > 0) {
      const allowed = filters.experience.map((e) => e.toLowerCase());
      const seniorWords = ["senior", "lead", "head", "director", "principal", "manager", "expert", "sr"];
      const internWords = ["intern", "internship", "trainee", "graduate", "fresher", "freshmen", "stajyer", "entry"];

      const isSenior = seniorWords.some((w) => new RegExp(`\\b${w}\\b`).test(titleNorm));
      const isInternSignal = internWords.some(
        (w) => new RegExp(`\\b${w}\\b`).test(titleNorm) || new RegExp(`\\b${w}\\b`).test(snippetNorm),
      );

      // Reject explicitly senior jobs when user wants entry-level
      if (isSenior && !allowed.some((e) => ["senior", "lead"].includes(e))) return false;

      // When "intern" is the only selected level, require a positive intern signal
      const onlyIntern = allowed.includes("intern") && !["junior", "mid", "senior", "lead"].some((e) => allowed.includes(e));
      if (onlyIntern && !isInternSignal) return false;

      // Reject intern/trainee signals when user only wants senior
      const onlySenior = allowed.every((e) => ["senior", "lead"].includes(e));
      if (onlySenior && isInternSignal && !isSenior) return false;
    }

    // Job types — only filter if the job explicitly signals a type we don't want
    if (filters.jobTypes && filters.jobTypes.length > 0) {
      const allowed = filters.jobTypes.map((jt) => jt.toLowerCase());
      const isContract = /\b(contract|contractor|freelance|temporary|temp|consulting)\b/i.test(combined);
      const isPartTime = /\b(part[\s-]?time|p\/t)\b/i.test(combined);
      if (isContract && !allowed.includes("contract")) return false;
      if (isPartTime && !allowed.includes("part-time")) return false;
    }

    // Salary — best-effort via title + snippet. Ranges use the MAX value.
    if (filters.salaryMin) {
      const annualMin = parseInt(filters.salaryMin.replace(/,/g, ""), 10);
      if (!isNaN(annualMin) && annualMin > 0) {
        const salaryText = `${titleNorm} ${snippetNorm}`;
        let foundSalary = false;
        let passesSalary = true;

        // Range k–k: "30k-50k", "$30k - $50k"
        const rangeKK = salaryText.match(/[\$£€]?\s*\d+(?:\.\d+)?\s*k\s*[-–]\s*[\$£€]?\s*(\d+(?:\.\d+)?)\s*k/);
        if (rangeKK) {
          foundSalary = true;
          if (parseFloat(rangeKK[1]) * 1000 < annualMin) passesSalary = false;
        }
        // Range plain–k: "30-50k"
        if (!foundSalary) {
          const rangeK = salaryText.match(/[\$£€]?\s*\d+\s*[-–]\s*[\$£€]?\s*(\d+(?:\.\d+)?)\s*k/);
          if (rangeK) {
            foundSalary = true;
            if (parseFloat(rangeK[1]) * 1000 < annualMin) passesSalary = false;
          }
        }
        // Hourly: "$40/hr"
        if (!foundSalary) {
          const hourly = salaryText.match(/[\$£€]?\s*(\d+(?:[.,]\d+)?)\s*(?:\/\s*h(?:r|our)?|per\s*h(?:r|our))/);
          if (hourly) {
            foundSalary = true;
            const rate = parseFloat(hourly[1].replace(",", "."));
            if (!isNaN(rate) && rate * 2080 < annualMin) passesSalary = false;
          }
        }
        // Annual k: "$80k"
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

export default function FeedPage() {
  const {
    highMatch,
    needsReview,
    setQuery,
    setSources,
    setLocation,
    handleSearch,
    loading,
    hasSearched,
  } = useFeed();

  const { profile } = useProfile();

  const profileDefaults = useMemo<Partial<FeedFilterValues>>(() => {
    const result: Partial<FeedFilterValues> = {};
    if (profile.headline) {
      result.query = profile.headline;
    }
    if (profile.work_modes?.length) result.workModes = profile.work_modes as string[];
    if (profile.experience_level?.length) result.experience = profile.experience_level;
    if (profile.job_types?.length) result.jobTypes = profile.job_types;
    if (profile.preferred_location?.value || (profile.preferred_location?.values?.length ?? 0) > 0) {
      result.location = profile.preferred_location;
    }
    if (profile.salary_min) {
      result.salaryMin = profile.salary_min;
      result.salaryPeriod = (profile.salary_period as FeedFilterValues["salaryPeriod"]) ?? "annual";
    }
    return result;
  }, [profile]);

  const [localFilters, setLocalFilters] = useState<Partial<FeedFilterValues>>({});

  const filteredHighMatch = useMemo(
    () => applyLocalFilters(highMatch, localFilters),
    [highMatch, localFilters],
  );
  const filteredNeedsReview = useMemo(
    () => applyLocalFilters(needsReview, localFilters),
    [needsReview, localFilters],
  );

  // Count every active filter except the free-text query
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

  function onSearchSubmit(values: FeedFilterValues) {
    if (values.query) setQuery(values.query);
    if (values.sources) setSources(values.sources as JobSource[]);
    if (values.location) setLocation(values.location);

    // Normalize salary to annual so the backend always receives a consistent unit.
    // Most job boards list salaries annually; monthly × 12, hourly × 2080 (52w × 40h).
    let salaryMin = values.salaryMin?.replace(/,/g, "");
    if (salaryMin) {
      const n = parseInt(salaryMin, 10);
      if (!isNaN(n)) {
        if (values.salaryPeriod === "monthly") salaryMin = String(n * 12);
        else if (values.salaryPeriod === "hourly") salaryMin = String(n * 2080);
      }
    }

    handleSearch({
      q: values.query,
      srcs: values.sources as JobSource[],
      loc: values.location,
      workModes: values.workModes,
      experience: values.experience,
      jobTypes: values.jobTypes,
      datePosted: values.datePosted,
      salaryMin,
      sortBy: values.sortBy,
    });

    setLocalFilters(values);
  }

  return (
    <div>
      <TopBar title="Job Feed" />

      <div className="p-6 space-y-5">
        <FeedFilterForm
          onSubmit={onSearchSubmit}
          onChange={setLocalFilters}
          loading={loading}
          profileDefaults={profileDefaults}
        />
        <FeedResults
          highMatch={filteredHighMatch}
          needsReview={filteredNeedsReview}
          loading={loading}
          hasSearched={hasSearched}
          activeFilterCount={activeFilterCount}
        />
      </div>
    </div>
  );
}
