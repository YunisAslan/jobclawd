"use client";

import { useState, useMemo } from "react";
import { FeedFilterValues } from "@/validations/feed";
import TopBar from "@/components/layout/TopBar";
import FeedFilterForm from "@/components/feed/FeedFilterForm";
import FeedResults from "@/components/feed/FeedResults";
import { useFeed } from "@/hooks/use-feed";
import { JobSource, JobListing } from "@/types";

function applyLocalFilters(
  jobs: JobListing[],
  filters: Partial<FeedFilterValues>,
) {
  if (!filters || Object.keys(filters).length === 0) return jobs;

  const filtered = jobs.filter((job) => {
    const titleNorm = (job.title || "").toLowerCase();
    const locNorm = (job.location_str || "").toLowerCase();
    const combined = titleNorm + " " + locNorm;

    // 1. Sources
    if (filters.sources && filters.sources.length > 0) {
      if (!filters.sources.includes(job.source)) return false;
    }

    // 2. Query
    if (filters.query) {
      const qNorm = filters.query.toLowerCase().trim();
      if (qNorm) {
        const qWords = qNorm.split(/\s+/).filter((w) => w.length > 2);
        if (qWords.length > 0) {
          const main = qWords[0];
          if (!titleNorm.includes(main)) return false;
        }
      }
    }

    // 3. Location (Approximate)
    let cityVal = "";
    if (filters.location && filters.location.type === "city") {
      if (filters.location.value) {
        cityVal = filters.location.value;
      } else if (
        filters.location.values &&
        filters.location.values.length > 0
      ) {
        cityVal = filters.location.values[0];
      }
    }

    if (cityVal) {
      if (cityVal.includes("-")) {
        cityVal = cityVal.split("-")[1];
      }
      const cityFilter = cityVal.toLowerCase();
      const otherCities = [
        "sumqayit",
        "sumgayit",
        "sumqayıt",
        "ganja",
        "gence",
        "gəncə",
        "xacmaz",
        "naxcivan",
        "naxçıvan",
      ];

      const hasOtherCity = otherCities.some((c) => combined.includes(c));
      const hasTargetCity =
        combined.includes(cityFilter) ||
        combined.includes(cityFilter.replace("bakı", "baku"));

      if (hasOtherCity && !hasTargetCity) return false;
      if (
        job.location_str &&
        !hasTargetCity &&
        !locNorm.includes("remote") &&
        !locNorm.includes("azerbaijan") &&
        !locNorm.includes("azərbaycan")
      ) {
        return false;
      }
    }

    // 4. Work Modes
    if (filters.workModes && filters.workModes.length > 0) {
      const allowedModes = filters.workModes.map((m) => m.toLowerCase());
      const hasMatch = allowedModes.some((m) => {
        if (combined.includes(m)) return true;
        if (
          m === "onsite" &&
          (combined.includes("office") || combined.includes("on-site"))
        )
          return true;
        return false;
      });

      const mentionsRemote = combined.includes("remote");
      const mentionsHybrid = combined.includes("hybrid");
      const mentionsOnsite =
        combined.includes("onsite") ||
        combined.includes("office") ||
        combined.includes("on-site");

      if (!hasMatch) {
        if (mentionsRemote || mentionsHybrid || mentionsOnsite) {
          return false;
        }
      }
    }

    // 5. Experience
    if (filters.experience && filters.experience.length > 0) {
      const allowedExp = filters.experience.map((e) => e.toLowerCase());
      const mentionsJunior =
        combined.includes("junior") ||
        combined.includes("intern") ||
        combined.includes("stajyor") ||
        combined.includes("təcrübəçi");
      const mentionsSenior =
        combined.includes("senior") ||
        combined.includes("lead") ||
        combined.includes("manager") ||
        combined.includes("head") ||
        combined.includes("director");

      let isAllowed = true;
      if (
        mentionsSenior &&
        !allowedExp.includes("senior") &&
        !allowedExp.includes("lead")
      ) {
        isAllowed = false;
      }
      if (
        mentionsJunior &&
        !allowedExp.some((e) => ["junior", "intern", "freshmen"].includes(e))
      ) {
        isAllowed = false;
      }
      if (!isAllowed) return false;
    }

    // 6. Job Types
    if (filters.jobTypes && filters.jobTypes.length > 0) {
      const allowedJt = filters.jobTypes.map((jt) => jt.toLowerCase());
      const mentionsIntern =
        combined.includes("intern") ||
        combined.includes("stajyor") ||
        combined.includes("təcrübəçi");

      if (mentionsIntern && !allowedJt.includes("internship")) {
        return false;
      }
      if (
        allowedJt.includes("internship") &&
        !allowedJt.includes("full-time") &&
        !mentionsIntern
      ) {
        if (
          combined.includes("senior") ||
          combined.includes("lead") ||
          combined.includes("head")
        ) {
          return false;
        }
      }
    }

    // 7. Salary Min
    if (filters.salaryMin) {
      // Very naive frontend check: if the job explicitly mentions a number lower than we want
      // It's mostly handled by AI backend, but we can do a raw string check if we want
      // For now, allow all if not explicitly failing
    }

    return true;
  });

  // 8. Sorting
  if (filters.sortBy) {
    if (filters.sortBy === "job-title-ascending") {
      filtered.sort((a: JobListing, b: JobListing) =>
        a.title.localeCompare(b.title),
      );
    } else if (filters.sortBy === "job-title-descending") {
      filtered.sort((a: JobListing, b: JobListing) =>
        b.title.localeCompare(a.title),
      );
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

  const [localFilters, setLocalFilters] = useState<Partial<FeedFilterValues>>(
    {},
  );

  const filteredHighMatch = useMemo(
    () => applyLocalFilters(highMatch, localFilters),
    [highMatch, localFilters],
  );
  const filteredNeedsReview = useMemo(
    () => applyLocalFilters(needsReview, localFilters),
    [needsReview, localFilters],
  );

  function onSearchSubmit(values: FeedFilterValues) {
    if (values.query) {
      setQuery(values.query);
    }
    if (values.sources) {
      setSources(values.sources as JobSource[]);
    }
    if (values.location) {
      setLocation(values.location);
    }

    handleSearch({
      q: values.query,
      srcs: values.sources as JobSource[],
      loc: values.location,
      workModes: values.workModes,
      experience: values.experience,
      jobTypes: values.jobTypes,
      datePosted: values.datePosted,
      salaryMin: values.salaryMin?.replace(/,/g, ""),
      sortBy: values.sortBy,
    });

    // reset local filters since backend result will naturally reflect it
    setLocalFilters({});
    console.log("[Feed] Search payload (for analytics/future):", values);
  }

  return (
    <div>
      <TopBar title="Job Feed" />

      <div className="p-6 space-y-5">
        <FeedFilterForm
          onSubmit={onSearchSubmit}
          onChange={setLocalFilters}
          loading={loading}
        />
        <FeedResults
          highMatch={filteredHighMatch}
          needsReview={filteredNeedsReview}
          loading={loading}
          hasSearched={hasSearched}
        />
      </div>
    </div>
  );
}
