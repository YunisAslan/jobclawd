"use client";

import { FEED_JOBS_MOCK } from "@/lib/data";
import { FeedFilterValues } from "@/validations/feed";
import TopBar from "@/components/layout/TopBar";
import FeedFilterForm from "@/components/feed/FeedFilterForm";
import FeedResults from "@/components/feed/FeedResults";

export default function FeedPage() {
  const highMatch = FEED_JOBS_MOCK.filter((job) => job.match_level === "high");
  const needsReview = FEED_JOBS_MOCK.filter(
    (job) => job.match_level === "review",
  );

  function handleSearch(values: FeedFilterValues) {
    const payload = {
      query: values.query || undefined,
      filters: {
        sources: values.sources?.length ? values.sources : undefined,
        workModes: values.workModes?.length ? values.workModes : undefined,
        experience: values.experience?.length ? values.experience : undefined,
        location: values.location?.value ? values.location : undefined,
        datePosted: values.datePosted || undefined,
        salaryMin: values.salaryMin ? Number(values.salaryMin) : undefined,
        jobTypes: values.jobTypes?.length ? values.jobTypes : undefined,
        sortBy: values.sortBy || undefined,
      },
    };
    console.log("[Feed] Search payload:", payload);
  }

  return (
    <div>
      <TopBar title="Job Feed" />

      <div className="p-6 space-y-5">
        <FeedFilterForm onSubmit={handleSearch} />
        <FeedResults highMatch={highMatch} needsReview={needsReview} />
      </div>
    </div>
  );
}
