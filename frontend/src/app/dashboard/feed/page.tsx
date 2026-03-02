"use client";

import { FeedFilterValues } from "@/validations/feed";
import TopBar from "@/components/layout/TopBar";
import FeedFilterForm from "@/components/feed/FeedFilterForm";
import FeedResults from "@/components/feed/FeedResults";
import { useFeed } from "@/hooks/use-feed";
import { JobSource } from "@/types";

export default function FeedPage() {
  const { highMatch, needsReview, setQuery, setSources, handleSearch } =
    useFeed();

  function onSearchSubmit(values: FeedFilterValues) {
    if (values.query) {
      setQuery(values.query);
    }
    if (values.sources) {
      setSources(values.sources as JobSource[]);
    }

    // Future expansion: we can add location, dates, etc to useFeed parameters

    handleSearch();

    console.log("[Feed] Search payload (for analytics/future):", values);
  }

  return (
    <div>
      <TopBar title="Job Feed" />

      <div className="p-6 space-y-5">
        <FeedFilterForm onSubmit={onSearchSubmit} />
        <FeedResults highMatch={highMatch} needsReview={needsReview} />
      </div>
    </div>
  );
}
