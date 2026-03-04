"use client";

import { FeedFilterValues } from "@/validations/feed";
import TopBar from "@/components/layout/TopBar";
import FeedFilterForm from "@/components/feed/FeedFilterForm";
import FeedResults from "@/components/feed/FeedResults";
import { useFeed } from "@/hooks/use-feed";
import { JobSource } from "@/types";

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

  function onSearchSubmit(values: FeedFilterValues) {
    // Update state for persistence across searches
    if (values.query) {
      setQuery(values.query);
    }
    if (values.sources) {
      setSources(values.sources as JobSource[]);
    }
    if (values.location) {
      setLocation(values.location);
    }

    // Pass all filter values directly to handleSearch - overrides take precedence
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

    console.log("[Feed] Search payload (for analytics/future):", values);
  }

  return (
    <div>
      <TopBar title="Job Feed" />

      <div className="p-6 space-y-5">
        <FeedFilterForm onSubmit={onSearchSubmit} loading={loading} />
        <FeedResults
          highMatch={highMatch}
          needsReview={needsReview}
          loading={loading}
          hasSearched={hasSearched}
        />
      </div>
    </div>
  );
}
